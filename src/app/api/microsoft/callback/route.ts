import { NextRequest, NextResponse } from "next/server";
import {
  getAppAccessToken,
  getOrganizationProfile,
  getRecentSignIns,
} from "@/lib/graph";
import { requireWritableOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";

function isPermissionPropagationError(message: string) {
  const s = String(message || "").toLowerCase();
  return (
    s.includes("authentication_msgraphpermissionmissing") ||
    (s.includes("auditlog.read.all") && s.includes("permission"))
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrganizationProfileWithRetry(accessToken: string) {
  const delays = [0, 1500, 3000, 6000];
  let lastError: unknown = null;
  for (const delay of delays) {
    if (delay) await sleep(delay);
    try {
      return await getOrganizationProfile(accessToken);
    } catch (error) {
      lastError = error;
    }
  }
  // Friendly naming must never block connecting a tenant. A later refresh can repair it.
  console.warn("Microsoft organization profile lookup failed after consent", lastError);
  return null;
}

async function verifySignInAccessWithRetry(accessToken: string) {
  const delays = [0, 2000, 4000, 8000];
  let lastError: any = null;

  for (const delay of delays) {
    if (delay) await sleep(delay);
    try {
      await getRecentSignIns(accessToken, 1);
      return { available: true as const, permissionPending: false };
    } catch (e: any) {
      lastError = e;
      if (!isPermissionPropagationError(e?.message || "")) throw e;
    }
  }

  return {
    available: null,
    permissionPending: true,
    error: lastError?.message || "Microsoft Graph permission is still propagating.",
  };
}

function isNonPremiumError(message: string) {
  const s = message.toLowerCase();
  return (
    s.includes("authentication_requestfromnonpremiumtenantorb2ctenant") ||
    s.includes("premium license") ||
    s.includes("nonpremiumtenant")
  );
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.json(
      { error, description: errorDescription },
      { status: 400 }
    );
  }

  const returnedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("ms_admin_consent_state")?.value;

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.json(
      { error: "Microsoft authorization state validation failed." },
      { status: 400 }
    );
  }

  const adminConsent = req.nextUrl.searchParams.get("admin_consent");
  const tenantId = req.nextUrl.searchParams.get("tenant");

  if (adminConsent !== "True" || !tenantId) {
    return NextResponse.json(
      { error: "Microsoft 365 authorization was not completed." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const org = await requireWritableOrganization();

  const { data: existing, error: findError } = await supabase
    .from("microsoft_tenants")
    .select("id,tenant_name")
    .eq("organization_id", org.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  let automaticMonitoringAvailable: boolean | null = null;
  let graphFriendlyName: string | null = null;

  try {
    const accessToken = await getAppAccessToken(tenantId);

    const profile = await getOrganizationProfileWithRetry(accessToken);
    graphFriendlyName =
      profile?.displayName ||
      profile?.defaultDomain ||
      null;

    try {
      const verification = await verifySignInAccessWithRetry(accessToken);
      automaticMonitoringAvailable = verification.available;
    } catch (e: any) {
      if (isNonPremiumError(e?.message || "")) {
        automaticMonitoringAvailable = false;
      } else {
        throw e;
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not validate Microsoft Graph access." },
      { status: 500 }
    );
  }

  let tenantRecordId = existing?.id;

  if (existing) {
    const update: any = {
      automatic_monitoring_available: automaticMonitoringAvailable,
      connected_at: new Date().toISOString(),
    };

    // Only replace the existing name when Microsoft actually returned a real
    // organization name/domain. This preserves manual friendly-name overrides.
    if (graphFriendlyName) {
      update.tenant_name = graphFriendlyName;
    }

    const { error: updateError } = await supabase
      .from("microsoft_tenants")
      .update(update)
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from("microsoft_tenants")
      .insert({
        organization_id: org.id,
        tenant_id: tenantId,
        tenant_name:
          graphFriendlyName || `Microsoft Tenant ${tenantId.slice(0, 8)}`,
        automatic_monitoring_available: automaticMonitoringAvailable,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    tenantRecordId = created.id;
  }

  const response = NextResponse.redirect(
    new URL(
      `/tenants?connected=${encodeURIComponent(tenantRecordId || "")}&readyToSync=${
        automaticMonitoringAvailable === true ? "1" : "0"
      }&permissionPending=${automaticMonitoringAvailable === null ? "1" : "0"}`,
      req.url
    )
  );

  response.cookies.delete("ms_admin_consent_state");
  return response;
}
