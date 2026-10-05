import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import net from "node:net";
import { requireWritableOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Incoming = {
  time?: string;
  user?: string;
  displayName?: string;
  ip?: string;
  city?: string;
  state?: string;
  country?: string;
  application?: string;
  status?: string;
  failureReason?: string;
  microsoftRisk?: string;
  errorCode?: string;
  score?: number;
  level?: string;
  reasons?: string[];
};

function normalizeDate(v?: string) {
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.valueOf()) ? new Date().toISOString() : d.toISOString();
}
function cleanIp(v?: string) {
  const s = String(v || "").trim();
  return net.isIP(s) ? s : null;
}
function fingerprint(r: Incoming) {
  return crypto
    .createHash("sha256")
    .update(
      [
        r.time || "",
        (r.user || "").toLowerCase(),
        cleanIp(r.ip) || r.ip || "",
        r.application || "",
        r.status || "",
        r.errorCode || "",
      ].join("|")
    )
    .digest("hex");
}
function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const x = e as Record<string, unknown>;
    return (
      [x.message, x.details, x.hint, x.code].filter(Boolean).join(" | ") ||
      JSON.stringify(e)
    );
  }
  return String(e || "Could not save import.");
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "The save request could not be read as JSON. Try the import again after refreshing the page.",
        },
        { status: 400 }
      );
    }

    const supplied = Array.isArray(body) ? body : body?.records;
    const records: Incoming[] = Array.isArray(supplied)
      ? supplied.slice(0, 10000)
      : [];
    const fileName = String(
      (Array.isArray(body) ? "Microsoft sign-in export.csv" : body?.fileName) ||
        "Microsoft sign-in export.csv"
    ).slice(0, 255);
    const microsoftTenantId = String(body?.microsoftTenantId || "").trim();

    if (!records.length) {
      return NextResponse.json(
        { error: "No sign-in records were supplied to the save API." },
        { status: 400 }
      );
    }

    if (!microsoftTenantId) {
      return NextResponse.json(
        { error: "Select the Microsoft 365 tenant this CSV belongs to before saving." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const org = await requireWritableOrganization();

    const { data: tenant, error: tenantError } = await supabase
      .from("microsoft_tenants")
      .select("id,tenant_name,tenant_id")
      .eq("id", microsoftTenantId)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (tenantError) throw tenantError;
    if (!tenant) {
      return NextResponse.json(
        { error: "The selected Microsoft tenant was not found." },
        { status: 400 }
      );
    }

    const { data: imp, error: importError } = await supabase
      .from("imports")
      .insert({
        organization_id: org.id,
        microsoft_tenant_id: tenant.id,
        file_name: fileName,
        source: "csv",
        row_count: records.length,
      })
      .select("id")
      .single();

    if (importError) throw importError;

    const rowsRaw = records.map((r) => ({
      organization_id: org.id,
      microsoft_tenant_id: tenant.id,
      import_id: imp.id,
      source: "csv",
      fingerprint: fingerprint(r),
      user_principal_name: r.user || null,
      user_display_name: r.displayName || null,
      event_time: normalizeDate(r.time),
      ip_address: cleanIp(r.ip),
      city: r.city || null,
      region: r.state || null,
      country: r.country || null,
      app_name: r.application || null,
      status: r.status || null,
      failure_reason: r.failureReason || null,
      error_code: r.errorCode || null,
      microsoft_risk: r.microsoftRisk || null,
      raw: r,
    }));

    const rows = Array.from(
      new Map(rowsRaw.map((r) => [r.fingerprint, r])).values()
    );

    let inserted = 0;

    for (let i = 0; i < rows.length; i += 250) {
      const chunk = rows.slice(i, i + 250);

      // Insert with ignoreDuplicates against the new tenant-aware unique index.
      const { data, error } = await supabase
        .from("signins")
        .upsert(chunk, {
          onConflict: "organization_id,microsoft_tenant_id,fingerprint",
          ignoreDuplicates: true,
        })
        .select("id,fingerprint");

      if (error) throw error;
      inserted += data?.length || 0;
    }

    const idByFingerprint = new Map<string, string>();
    const fingerprintLookupBatchSize = 40;

    for (let i = 0; i < rows.length; i += fingerprintLookupBatchSize) {
      const fps = rows
        .slice(i, i + fingerprintLookupBatchSize)
        .map((r) => r.fingerprint);

      const { data: saved, error: savedError } = await supabase
        .from("signins")
        .select("id,fingerprint")
        .eq("organization_id", org.id)
        .eq("microsoft_tenant_id", tenant.id)
        .in("fingerprint", fps);

      if (savedError) throw savedError;

      for (const x of saved || []) idByFingerprint.set(x.fingerprint, x.id);
    }

    const findingsRaw = records
      .map((r) => ({
        organization_id: org.id,
        signin_id: idByFingerprint.get(fingerprint(r)),
        risk_score: Math.max(0, Math.min(100, Number(r.score || 0))),
        risk_level: ["normal", "review", "suspicious", "critical"].includes(
          String(r.level)
        )
          ? String(r.level)
          : "normal",
        reasons: Array.isArray(r.reasons) ? r.reasons : [],
      }))
      .filter((x) => x.signin_id);

    const findingsMap = new Map<string, (typeof findingsRaw)[number]>();
    for (const f of findingsRaw) {
      if (!f.signin_id) continue;
      const existing = findingsMap.get(f.signin_id);
      if (!existing || Number(f.risk_score) >= Number(existing.risk_score)) {
        findingsMap.set(f.signin_id, f);
      }
    }

    const findings = Array.from(findingsMap.values());

    if (findings.length) {
      for (let i = 0; i < findings.length; i += 250) {
        const { error } = await supabase
          .from("security_findings")
          .upsert(findings.slice(i, i + 250), { onConflict: "signin_id" });
        if (error) throw error;
      }
    }

    const { error: updateError } = await supabase
      .from("imports")
      .update({ saved_count: inserted })
      .eq("id", imp.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      organization: org.name,
      tenant: tenant.tenant_name || tenant.tenant_id,
      importId: imp.id,
      submitted: records.length,
      inserted,
      duplicatesIgnored: Math.max(0, records.length - inserted),
    });
  } catch (e) {
    const message = errorMessage(e);
    console.error("POST /api/imports/save failed:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
