import crypto from "node:crypto";
import net from "node:net";
import { getAppAccessToken, getRecentSignIns, getSignInsSince } from "@/lib/graph";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Intel = {
  ip_address: string;
  asn: string | null;
  provider: string | null;
  domain: string | null;
  network_type: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  is_vpn: boolean | null;
  is_proxy: boolean | null;
  is_tor: boolean | null;
  is_relay: boolean | null;
  is_hosting: boolean | null;
  is_anonymous: boolean | null;
  privacy_service: string | null;
  privacy_available: boolean;
  source: string;
  last_checked_at: string;
  raw?: any;
};

function cleanIp(value: unknown) {
  const s = String(value || "").trim();
  return net.isIP(s) ? s : null;
}

function invalidOrLocal(ip: string) {
  const kind = net.isIP(ip);
  if (!kind) return true;

  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  const s = ip.toLowerCase();
  return (
    s === "::1" ||
    s.startsWith("fe80:") ||
    s.startsWith("fc") ||
    s.startsWith("fd")
  );
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function normalizeIntel(ip: string, data: any, source: "lookup" | "lite"): Intel {
  const geo = data?.geo || data || {};
  const as = data?.as || {};
  const anon = data?.anonymous || data?.privacy || {};

  const vpn = boolOrNull(anon?.is_vpn ?? anon?.vpn);
  const proxy = boolOrNull(anon?.is_proxy ?? anon?.proxy);
  const tor = boolOrNull(anon?.is_tor ?? anon?.tor);
  const relay = boolOrNull(anon?.is_relay ?? anon?.relay);
  const hosting = boolOrNull(
    data?.is_hosting ??
      anon?.hosting ??
      (as?.type === "hosting" ? true : undefined)
  );
  const anonymous = boolOrNull(
    data?.is_anonymous ??
      (vpn === true || proxy === true || tor === true || relay === true
        ? true
        : undefined)
  );

  // We only call a record "privacy available" when the response actually
  // contains the privacy/anonymization booleans. A Lite response should not
  // block a future paid privacy lookup.
  const privacyAvailable =
    source === "lookup" &&
    [vpn, proxy, tor, relay].some(
      (v) => typeof v === "boolean"
    );

  return {
    ip_address: ip,
    city: String(geo?.city || data?.city || "") || null,
    region: String(geo?.region || data?.region || "") || null,
    country: String(geo?.country || data?.country || "") || null,
    country_code:
      String(geo?.country_code || data?.country_code || "") || null,
    asn: String(as?.asn || data?.asn || "") || null,
    provider:
      String(
        as?.name ||
          data?.as_name ||
          data?.org ||
          data?.company?.name ||
          ""
      ) || null,
    domain:
      String(
        as?.domain ||
          data?.as_domain ||
          data?.company?.domain ||
          ""
      ) || null,
    network_type:
      String(
        as?.type ||
          data?.company?.type ||
          data?.type ||
          ""
      ) || null,
    is_vpn: vpn,
    is_proxy: proxy,
    is_tor: tor,
    is_relay: relay,
    is_hosting: hosting,
    is_anonymous: anonymous,
    privacy_service:
      String(
        anon?.name ||
          anon?.service ||
          data?.privacy?.service ||
          ""
      ) || null,
    privacy_available: privacyAvailable,
    source,
    last_checked_at: new Date().toISOString(),
    raw: data,
  };
}

async function fetchJson(url: string) {
  let last: { ok: boolean; status: number; data: any } = { ok: false, status: 0, data: {} };

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const text = await r.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      last = { ok: r.ok, status: r.status, data };
      if (r.ok) return last;

      // Retry temporary throttling/server failures. Honor Retry-After when present.
      if (r.status !== 429 && r.status < 500) return last;
      const retryAfter = Number(r.headers.get("retry-after") || "0");
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 8000)));
    } catch (error: any) {
      last = { ok: false, status: 0, data: { message: error?.message || "IP lookup failed" } };
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }

  return last;
}

function cacheIsComplete(cached: any) {
  if (!cached) return false;

  // Old Lite/basic cache records often have provider/ASN but no privacy data.
  // Do not reuse those now that a paid token is configured.
  if (cached.privacy_available !== true) return false;

  // If all privacy columns are NULL, treat it as incomplete even if an older
  // version accidentally marked privacy_available true.
  // Hosting/ASN classification alone is not enough to call privacy detection
  // complete. A hosting IP may also be a commercial or self-hosted VPN.
  // Require the specific anonymization classifiers to have been returned.
  const returnedClassificationFields = [
    cached.is_vpn,
    cached.is_proxy,
    cached.is_tor,
    cached.is_relay,
  ];

  // Hosting/datacenter and is_anonymous are NOT substitutes for the specific
  // VPN/proxy/Tor/relay classifiers. IPinfo can report an address as hosting
  // and VPN at the same time. If the specific privacy fields are missing,
  // refresh the record instead of trusting a hosting-only cached result.
  return returnedClassificationFields.some((v) => typeof v === "boolean");
}

export async function getIpIntel(ip: string): Promise<Intel | null> {
  if (invalidOrLocal(ip)) return null;

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: cached, error: cachedError } = await supabase
    .from("ip_intelligence")
    .select("*")
    .eq("ip_address", ip)
    .maybeSingle();

  if (cachedError) throw cachedError;

  const cacheFresh =
    cached?.last_checked_at &&
    cached.last_checked_at >= cutoff;

  if (cacheFresh && cacheIsComplete(cached)) {
    return cached as Intel;
  }

  const token = process.env.IPINFO_TOKEN;
  if (!token) {
    // If no token is configured, return whatever basic cache data exists.
    return cached ? (cached as Intel) : null;
  }

  // IPinfo accepts IPv6 addresses directly as a URL path segment (for example
  // /lookup/2a00::1). Percent-encoding the colons can cause IPv6 lookups to
  // miss even though IPv4 continues to work. Keep IPv4 URL-encoded, but pass
  // a validated IPv6 address through with its colon separators intact.
  const ipKind = net.isIP(ip);
  const lookupPathIp = ipKind === 6 ? ip : encodeURIComponent(ip);

  // Always try the paid unified lookup first.
  const lookup = await fetchJson(
    `https://api.ipinfo.io/lookup/${lookupPathIp}?token=${encodeURIComponent(token)}`
  );

  let intel: Intel | null = null;

  if (lookup.ok) {
    let lookupData = lookup.data;

    // IPinfo documents the detailed VPN/proxy/Tor/relay object under
    // /lookup/{ip}/anonymous. Some plan/response combinations expose only
    // is_anonymous in the full lookup. Try the specific endpoint before
    // accepting an anonymous-but-unclassified result.
    const initial = normalizeIntel(ip, lookupData, "lookup");
    if (
      initial.privacy_available !== true &&
      lookupData?.is_anonymous === true
    ) {
      const anonymousLookup = await fetchJson(
        `https://api.ipinfo.io/lookup/${lookupPathIp}/anonymous?token=${encodeURIComponent(token)}`
      );
      if (anonymousLookup.ok && anonymousLookup.data && typeof anonymousLookup.data === "object") {
        lookupData = { ...lookupData, anonymous: anonymousLookup.data };
      }
    }

    intel = normalizeIntel(ip, lookupData, "lookup");
  } else {
    // Lite is useful as a fallback for provider/ASN/country, but it is
    // deliberately marked privacy_available=false so a later paid lookup
    // will retry rather than treating this as complete.
    const lite = await fetchJson(
      `https://api.ipinfo.io/lite/${lookupPathIp}?token=${encodeURIComponent(token)}`
    );

    if (lite.ok) {
      intel = normalizeIntel(ip, lite.data, "lite");
    }
  }

  if (!intel) {
    return cached ? (cached as Intel) : null;
  }

  const { error } = await supabase
    .from("ip_intelligence")
    .upsert(intel, { onConflict: "ip_address" });

  if (error) throw error;

  return intel;
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );

  return out;
}

function statusText(signin: any) {
  const code = Number(signin?.status?.errorCode || 0);
  return code === 0 ? "Success" : "Failed";
}

function fingerprint(signin: any) {
  return crypto
    .createHash("sha256")
    .update(
      [
        signin?.createdDateTime || "",
        String(signin?.userPrincipalName || "").toLowerCase(),
        cleanIp(signin?.ipAddress) || "",
        signin?.appDisplayName || "",
        statusText(signin),
        signin?.status?.errorCode ?? "",
      ].join("|")
    )
    .digest("hex");
}

function scoreGraphSignin(signin: any, intel: Intel | null) {
  let score = 0;
  const reasons: string[] = [];

  const risk = String(
    signin?.riskLevelDuringSignIn ||
      signin?.riskLevelAggregated ||
      ""
  ).toLowerCase();

  if (risk === "high") {
    score += 40;
    reasons.push("Microsoft classified the sign-in risk as high");
  } else if (risk === "medium") {
    score += 25;
    reasons.push("Microsoft classified the sign-in risk as medium");
  } else if (risk === "low") {
    score += 10;
    reasons.push("Microsoft classified the sign-in risk as low");
  }

  if (statusText(signin) === "Failed") {
    score += 8;
    reasons.push("Failed sign-in");
  }

  if (intel?.is_tor) {
    score += 35;
    reasons.push("Tor exit node detected");
  } else if (intel?.is_vpn || intel?.is_proxy) {
    score += 15;
    reasons.push(
      intel.is_vpn
        ? `VPN detected${intel.privacy_service ? ` (${intel.privacy_service})` : ""}`
        : `Proxy detected${intel.privacy_service ? ` (${intel.privacy_service})` : ""}`
    );
  }

  if (intel?.is_hosting) {
    score += 10;
    reasons.push("Hosting/datacenter network detected");
  }

  if (intel?.is_relay) {
    score += 5;
    reasons.push("Privacy relay detected");
  }

  score = Math.min(100, score);

  return {
    score,
    level:
      score >= 60
        ? "critical"
        : score >= 30
        ? "suspicious"
        : score >= 15
        ? "review"
        : "normal",
    reasons: Array.from(new Set(reasons)),
  };
}

export async function syncMicrosoftTenant(params: {
  organizationId: string;
  microsoftTenantRecordId: string;
  microsoftTenantId: string;
  top?: number;
  since?: string;
}) {
  const supabase = getSupabaseAdmin();
  const accessToken = await getAppAccessToken(params.microsoftTenantId);
  // Hourly monitoring is incremental. A 10-minute overlap protects against late
  // provider records; the existing fingerprint constraint safely removes overlap duplicates.
  const rawRows = params.since
    ? await getSignInsSince(accessToken, new Date(new Date(params.since).getTime() - 10 * 60 * 1000).toISOString(), 10000)
    : await getRecentSignIns(accessToken, params.top || 250);

  const byFingerprint = new Map<string, any>();
  for (const row of rawRows) {
    byFingerprint.set(fingerprint(row), row);
  }
  const graphRows = Array.from(byFingerprint.values());

  const ips = Array.from(
    new Set(
      graphRows
        .map((s: any) => cleanIp(s?.ipAddress))
        .filter(Boolean)
    )
  ) as string[];

  const intelResults = await mapLimit(ips, 8, getIpIntel);
  const intelMap = new Map<string, Intel>();

  ips.forEach((ip, i) => {
    const intel = intelResults[i];
    if (intel) intelMap.set(ip, intel);
  });

  const signinRows = graphRows.map((s: any) => ({
    organization_id: params.organizationId,
    microsoft_tenant_id: params.microsoftTenantRecordId,
    source: "graph",
    external_id: s?.id || null,
    fingerprint: fingerprint(s),
    user_principal_name: s?.userPrincipalName || null,
    user_display_name: s?.userDisplayName || null,
    event_time: s?.createdDateTime || new Date().toISOString(),
    ip_address: cleanIp(s?.ipAddress),
    city: s?.location?.city || null,
    region: s?.location?.state || null,
    country: s?.location?.countryOrRegion || null,
    app_name: s?.appDisplayName || null,
    client_app: s?.clientAppUsed || null,
    browser: s?.deviceDetail?.browser || null,
    operating_system: s?.deviceDetail?.operatingSystem || null,
    status: statusText(s),
    failure_reason: s?.status?.failureReason || null,
    error_code:
      s?.status?.errorCode != null ? String(s.status.errorCode) : null,
    microsoft_risk:
      s?.riskLevelDuringSignIn ||
      s?.riskLevelAggregated ||
      null,
    raw: s,
  }));

  const savedRows: any[] = [];

  for (let i = 0; i < signinRows.length; i += 100) {
    const { data, error } = await supabase
      .from("signins")
      .upsert(signinRows.slice(i, i + 100), {
        onConflict: "organization_id,microsoft_tenant_id,fingerprint",
        ignoreDuplicates: false,
      })
      .select("id,fingerprint,ip_address");

    if (error) throw error;
    savedRows.push(...(data || []));
  }

  const findingMap = new Map<string, any>();

  for (const row of savedRows) {
    const graph = byFingerprint.get(row.fingerprint);
    if (!graph) continue;

    const ip = row.ip_address ? String(row.ip_address) : "";
    const intel = ip ? intelMap.get(ip) || null : null;
    const result = scoreGraphSignin(graph, intel);

    findingMap.set(row.id, {
      organization_id: params.organizationId,
      signin_id: row.id,
      risk_score: result.score,
      risk_level: result.level,
      reasons: result.reasons,
    });
  }

  const findings = Array.from(findingMap.values());

  for (let i = 0; i < findings.length; i += 100) {
    const { error } = await supabase
      .from("security_findings")
      .upsert(findings.slice(i, i + 100), { onConflict: "signin_id" });

    if (error) throw error;
  }

  const { error: tenantUpdateError } = await supabase
    .from("microsoft_tenants")
    .update({
      automatic_monitoring_available: true,
      last_sync_at: new Date().toISOString(),
    })
    .eq("id", params.microsoftTenantRecordId);

  if (tenantUpdateError) throw tenantUpdateError;

  const completePrivacyCount = Array.from(intelMap.values()).filter(
    (x) => x.privacy_available === true
  ).length;

  return {
    retrieved: rawRows.length,
    unique: graphRows.length,
    uniqueIps: ips.length,
    intelExamined: intelMap.size,
    privacyExamined: completePrivacyCount,
    insertedOrUpdated: savedRows.length,
    updatedFindings: findings.length,
  };
}
