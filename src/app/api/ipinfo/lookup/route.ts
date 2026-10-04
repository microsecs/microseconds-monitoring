import { NextRequest, NextResponse } from "next/server";
import net from "node:net";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Normalized = {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  asn: string;
  provider: string;
  domain: string;
  networkType: string;
  vpn: boolean | null;
  proxy: boolean | null;
  tor: boolean | null;
  relay: boolean | null;
  hosting: boolean | null;
  anonymous: boolean | null;
  privacyService: string;
  privacyAvailable: boolean;
  source: "lookup" | "lite";
  error?: string;
};

const cache = new Map<string, { at: number; value: Normalized }>();
const CACHE_MS = 24 * 60 * 60 * 1000;
const DB_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function normalize(ip: string, data: any, source: "lookup" | "lite"): Normalized {
  const geo = data?.geo || data || {};
  const as = data?.as || {};
  const anon = data?.anonymous || data?.privacy || {};
  const privacyKeys = [
    anon?.is_vpn, anon?.vpn,
    anon?.is_proxy, anon?.proxy,
    anon?.is_tor, anon?.tor,
    anon?.is_relay, anon?.relay,
  ];
  // Hosting/datacenter is independent from VPN/proxy detection. Do not mark
  // privacy detection complete just because IPinfo returned is_hosting.
  const privacyAvailable =
    source === "lookup" &&
    privacyKeys.some((v) => typeof v === "boolean");

  return {
    ip,
    city: String(geo?.city || data?.city || ""),
    region: String(geo?.region || data?.region || ""),
    country: String(geo?.country || data?.country || ""),
    countryCode: String(geo?.country_code || data?.country_code || ""),
    asn: String(as?.asn || data?.asn || ""),
    provider: String(as?.name || data?.as_name || data?.org || ""),
    domain: String(as?.domain || data?.as_domain || ""),
    networkType: String(as?.type || ""),
    vpn: boolOrNull(anon?.is_vpn ?? anon?.vpn),
    proxy: boolOrNull(anon?.is_proxy ?? anon?.proxy),
    tor: boolOrNull(anon?.is_tor ?? anon?.tor),
    relay: boolOrNull(anon?.is_relay ?? anon?.relay),
    hosting: boolOrNull(data?.is_hosting ?? anon?.hosting ?? (as?.type === "hosting" ? true : undefined)),
    anonymous: boolOrNull(data?.is_anonymous),
    privacyService: String(anon?.name || anon?.service || ""),
    privacyAvailable,
    source,
  };
}

function invalidOrLocal(ip: string) {
  const kind = net.isIP(ip);
  if (!kind) return true;
  if (kind === 4) {
    const [a,b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const s = ip.toLowerCase();
  return s === "::1" || s.startsWith("fe80:") || s.startsWith("fc") || s.startsWith("fd");
}

async function fetchJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  return { ok: r.ok, status: r.status, data };
}

async function lookupOne(ip: string, token: string): Promise<Normalized> {
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  // Persistent cache: reuse prior IP intelligence for 30 days before spending
  // another IPinfo request. If Supabase is not configured yet, continue normally.
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("ip_intelligence").select("*").eq("ip_address", ip).maybeSingle();
    const specificPrivacyCached = data &&
      data.privacy_available === true &&
      [data.is_vpn, data.is_proxy, data.is_tor, data.is_relay].some((v:any) => typeof v === "boolean");
    if (data && specificPrivacyCached && data.last_checked_at && Date.now() - new Date(data.last_checked_at).getTime() < DB_CACHE_MS) {
      const value: Normalized = {
        ip, city:data.city||"", region:data.region||"", country:data.country||"", countryCode:data.country_code||"",
        asn:data.asn||"", provider:data.provider||"", domain:data.domain||"", networkType:data.network_type||"",
        vpn:data.is_vpn, proxy:data.is_proxy, tor:data.is_tor, relay:data.is_relay, hosting:data.is_hosting, anonymous:data.is_anonymous,
        privacyService:data.privacy_service||"", privacyAvailable:Boolean(data.privacy_available), source:(data.source||"lookup") as "lookup"|"lite"
      };
      cache.set(ip,{at:Date.now(),value});
      return value;
    }
  } catch {}

  if (invalidOrLocal(ip)) {
    const value: Normalized = {
      ip, city:"", region:"", country:"", countryCode:"", asn:"", provider:"Private/local address", domain:"", networkType:"private",
      vpn:null, proxy:null, tor:null, relay:null, hosting:null, anonymous:null, privacyService:"", privacyAvailable:false, source:"lite", error:"Private, local, or invalid IP address"
    };
    cache.set(ip, { at: Date.now(), value });
    return value;
  }

  const ipKind = net.isIP(ip);
  const encoded = ipKind === 6 ? ip : encodeURIComponent(ip);
  const lookup = await fetchJson(`https://api.ipinfo.io/lookup/${encoded}?token=${encodeURIComponent(token)}`);
  if (lookup.ok) {
    let lookupData = lookup.data;
    let value = normalize(ip, lookupData, "lookup");

    // The full Core lookup can expose is_anonymous without the detailed
    // classifier object. Ask the documented /anonymous endpoint as a second
    // step; if the token is entitled to it, merge those exact classifiers.
    if (value.privacyAvailable !== true && lookupData?.is_anonymous === true) {
      const detail = await fetchJson(
        `https://api.ipinfo.io/lookup/${encoded}/anonymous?token=${encodeURIComponent(token)}`
      );
      if (detail.ok && detail.data && typeof detail.data === "object") {
        lookupData = { ...lookupData, anonymous: detail.data };
        value = normalize(ip, lookupData, "lookup");
      }
    }

    cache.set(ip, { at: Date.now(), value });
    await persistIntel(value, lookupData);
    return value;
  }

  // Free/Lite accounts may not have access to /lookup. Still retrieve the
  // country/ASN fields rather than treating privacy signals as false.
  const lite = await fetchJson(`https://api.ipinfo.io/lite/${encoded}?token=${encodeURIComponent(token)}`);
  if (lite.ok) {
    const value = normalize(ip, lite.data, "lite");
    value.error = "IPinfo privacy/VPN detection is not available on this API plan.";
    cache.set(ip, { at: Date.now(), value });
    await persistIntel(value, lite.data);
    return value;
  }

  return {
    ip, city:"", region:"", country:"", countryCode:"", asn:"", provider:"", domain:"", networkType:"",
    vpn:null, proxy:null, tor:null, relay:null, hosting:null, anonymous:null, privacyService:"", privacyAvailable:false, source:"lite",
    error:`IPinfo lookup failed (${lookup.status}/${lite.status}). Check the token and IPinfo plan.`
  };
}

async function persistIntel(value: Normalized, raw: unknown = null) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("ip_intelligence").upsert({
      ip_address:value.ip, asn:value.asn||null, provider:value.provider||null, domain:value.domain||null, network_type:value.networkType||null,
      city:value.city||null, region:value.region||null, country:value.country||null, country_code:value.countryCode||null,
      is_vpn:value.vpn, is_proxy:value.proxy, is_tor:value.tor, is_relay:value.relay, is_hosting:value.hosting, is_anonymous:value.anonymous,
      privacy_service:value.privacyService||null, privacy_available:value.privacyAvailable, source:value.source, last_checked_at:new Date().toISOString(), raw
    },{onConflict:"ip_address"});
  } catch {}
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item:T)=>Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function POST(req: NextRequest) {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return NextResponse.json({ error: "IPINFO_TOKEN is not configured in .env.local." }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const ips: string[] = Array.from(new Set<string>((Array.isArray(body?.ips) ? body.ips : []).map((x: unknown) => String(x).trim()).filter((x: string) => Boolean(x)))).slice(0, 250);
  if (!ips.length) return NextResponse.json({ results: [] });

  const results = await mapLimit(ips, 8, (ip) => lookupOne(ip, token));
  return NextResponse.json({ results });
}
