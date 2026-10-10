import {dateBounds} from "@/lib/dateRange";
import { getSupabaseAdmin, getOrCreateDevOrganization } from "@/lib/supabaseAdmin";

export type HistoryRow = {
  id: string;
  microsoft_tenant_id: string | null;
  google_workspace_tenant_id?: string | null;
  source_platform?: string | null;
  source: string | null;
  event_time: string | null;
  user_principal_name: string | null;
  user_display_name: string | null;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  app_name: string | null;
  status: string | null;
  failure_reason: string | null;
  microsoft_risk: string | null;
  risk_score?: number | null;
  risk_level?: string | null;
  reasons?: string[] | null;
  tenant_name?: string | null;

  intel_provider?: string | null;
  intel_asn?: string | null;
  intel_network_type?: string | null;
  intel_city?: string | null;
  intel_region?: string | null;
  intel_country?: string | null;
  intel_vpn?: boolean | null;
  intel_proxy?: boolean | null;
  intel_tor?: boolean | null;
  intel_relay?: boolean | null;
  intel_hosting?: boolean | null;
  intel_anonymous?: boolean | null;
  intel_privacy_service?: string | null;
  intel_privacy_available?: boolean | null;
  intel_last_checked_at?: string | null;
};

export async function getDevOrganization() {
  // Legacy function name retained for callers, but customer-facing history must always
  // resolve from the authenticated user's organization membership. Never fall back to
  // DEV_ORGANIZATION_SLUG here: the admin service-role client bypasses RLS.
  return getOrCreateDevOrganization();
}

export async function getGoogleTenants() {
  const supabase = getSupabaseAdmin();
  const org = await getDevOrganization();
  if (!org) return [];

  const { data, error } = await supabase
    .from("google_workspace_tenants")
    .select("id,display_name,primary_domain,last_sync_at,last_verified_at")
    .eq("organization_id", org.id)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTenants() {
  const supabase = getSupabaseAdmin();
  const org = await getDevOrganization();
  if (!org) return [];

  const { data, error } = await supabase
    .from("microsoft_tenants")
    .select("id,tenant_id,tenant_name,automatic_monitoring_available,last_sync_at,connected_at")
    .eq("organization_id", org.id)
    .order("tenant_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getRecentHistoryPage(opts:{
  page?:number; pageSize?:number; microsoftTenantId?:string; googleTenantId?:string;
  platform?:string; includeUnsuccessful?:boolean; search?:string; range?:string; from?:string; to?:string;
}): Promise<{rows:HistoryRow[];total:number;page:number;pageSize:number}> {
  const page=Math.max(1,opts.page||1),pageSize=Math.min(250,Math.max(25,opts.pageSize||100));
  const microsoftTenantId=opts.microsoftTenantId,googleTenantId=opts.googleTenantId,platform=opts.platform;
  const supabase = getSupabaseAdmin();
  const org = await getDevOrganization();
  if (!org) return {rows:[],total:0,page,pageSize};

  let query = supabase
    .from("signins")
    .select(
       "id,microsoft_tenant_id,google_workspace_tenant_id,source_platform,source,event_time,user_principal_name,user_display_name,ip_address,city,region,country,app_name,status,failure_reason,microsoft_risk,incident:security_incidents(risk_score,reasons,ai_recommended_risk_score,ai_summary,ai_classification)",
       {count:"exact"}
    )
    .eq("organization_id", org.id)
    .order("event_time", { ascending: false })
    .range((page-1)*pageSize,page*pageSize-1);

  const bounds=dateBounds(opts);
  if(bounds.start)query=query.gte("event_time",bounds.start);
  if(bounds.end)query=query.lt("event_time",bounds.end);
  if (googleTenantId) {
    query = query.eq("google_workspace_tenant_id", googleTenantId);
  } else if (microsoftTenantId) {
    query = query.eq("microsoft_tenant_id", microsoftTenantId);
  } else if (platform === "google") {
    query = query.eq("source_platform", "google");
  } else if (platform === "microsoft") {
    query = query.neq("source_platform", "google");
  }

  // Microsoft Graph historically stores "Success" while Google stores "success".
  // PostgREST equality is case-sensitive, so a lowercase-only filter hides Microsoft successes.
  // ilike performs a case-insensitive exact match here (no wildcard characters).
  const search=(opts.search||"").trim();
  if (search) {
    const escaped=search.replace(/[%_,()]/g," ");
    const textFilters=[`user_principal_name.ilike.%${escaped}%`,`user_display_name.ilike.%${escaped}%`,`city.ilike.%${escaped}%`,`region.ilike.%${escaped}%`,`country.ilike.%${escaped}%`,`app_name.ilike.%${escaped}%`];
    const {data:intelMatches,error:intelSearchError}=await supabase.from("ip_intelligence").select("ip_address")
      .or([`provider.ilike.%${escaped}%`,`asn.ilike.%${escaped}%`,`network_type.ilike.%${escaped}%`,`privacy_service.ilike.%${escaped}%`,`city.ilike.%${escaped}%`,`region.ilike.%${escaped}%`,`country.ilike.%${escaped}%`].join(",")).limit(1000);
    if(intelSearchError) throw new Error(intelSearchError.message);
    const intelIps=Array.from(new Set((intelMatches||[]).map((x:any)=>String(x.ip_address||"")).filter(Boolean)));
    const ipSearch=/^[0-9a-fA-F:.]+$/.test(search) && (search.includes(".") || search.includes(":"));
    if(ipSearch) textFilters.push(`ip_address.eq.${search}`);
    if(intelIps.length) textFilters.push(`ip_address.in.(${intelIps.join(",")})`);
    query=query.or(textFilters.join(","));
  }
  if (!opts.includeUnsuccessful) query=query.ilike("status","success");
  const { data: signins, error, count } = await query;
  if (error) throw new Error(error.message);
  if (!signins?.length) return {rows:[],total:count||0,page,pageSize};

  const ids = signins.map((x: any) => x.id);
  const googleTenantIds = Array.from(
    new Set(signins.map((x: any) => x.google_workspace_tenant_id).filter(Boolean))
  ) as string[];
  const tenantIds = Array.from(
    new Set(signins.map((x: any) => x.microsoft_tenant_id).filter(Boolean))
  ) as string[];
  const ips = Array.from(
    new Set(signins.map((x: any) => String(x.ip_address || "")).filter(Boolean))
  );

  const findingMap = new Map<string, any>();
  const incidentMap = new Map<string, any>();
  const tenantMap = new Map<string, string>();
  const googleTenantMap = new Map<string, string>();
  const intelMap = new Map<string, any>();

  for (let i = 0; i < ids.length; i += 40) {
    const { data: findings, error: ferr } = await supabase
      .from("security_findings")
      .select("signin_id,risk_score,risk_level,reasons")
      .in("signin_id", ids.slice(i, i + 40));

    if (ferr) throw new Error(ferr.message);
    for (const f of findings || []) findingMap.set(f.signin_id, f);
  }

  const incidentRows: any[] = [];
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 40) {
      const { data: incidents, error: ierr } = await supabase
        .from("security_incidents")
        .select("signin_id,risk_score,reasons,ai_recommended_risk_score,ai_summary,ai_classification")
        .eq("organization_id", org.id)
        .in("signin_id", ids.slice(i, i + 40));
      if (ierr) throw new Error(ierr.message);
      incidentRows.push(...(incidents || []));
      for (const incident of incidents || []) incidentMap.set(incident.signin_id, incident);
    }
  }

  // Historical fallback: incident queue is authoritative. Pull tenant incidents and their
  // referenced sign-ins, then correlate to this page by provider + user + exact time + IP.
  const candidateIncidents: any[] = [];
  for (let i = 0; i < tenantIds.length; i += 40) {
    const { data, error } = await supabase.from("security_incidents")
      .select("signin_id,risk_score,reasons,ai_recommended_risk_score,ai_summary,ai_classification,microsoft_tenant_id,google_workspace_tenant_id")
      .eq("organization_id", org.id)
      .in("microsoft_tenant_id", tenantIds.slice(i, i + 40));
    if (error) throw new Error(error.message);
    candidateIncidents.push(...(data || []));
  }
  for (let i = 0; i < googleTenantIds.length; i += 40) {
    const { data, error } = await supabase.from("security_incidents")
      .select("signin_id,risk_score,reasons,ai_recommended_risk_score,ai_summary,ai_classification,microsoft_tenant_id,google_workspace_tenant_id")
      .eq("organization_id", org.id)
      .in("google_workspace_tenant_id", googleTenantIds.slice(i, i + 40));
    if (error) throw new Error(error.message);
    candidateIncidents.push(...(data || []));
  }
  const incidentSigninIds = Array.from(new Set(candidateIncidents.map((x:any)=>x.signin_id).filter(Boolean)));
  const incidentSignins: any[] = [];
  for (let i = 0; i < incidentSigninIds.length; i += 100) {
    const { data, error } = await supabase.from("signins")
      .select("id,event_time,user_principal_name,ip_address,source_platform")
      .in("id", incidentSigninIds.slice(i, i + 100));
    if (error) throw new Error(error.message);
    incidentSignins.push(...(data || []));
  }
  const riskBySignin = new Map(candidateIncidents.map((x:any)=>[x.signin_id,x]));
  const incidentFallbackCandidates = incidentSignins.map((s:any) => ({
    signin: s,
    incident: riskBySignin.get(s.id)
  })).filter((x:any)=>x.incident);

  for (let i = 0; i < tenantIds.length; i += 40) {
    const { data: tenants, error: terr } = await supabase
      .from("microsoft_tenants")
      .select("id,tenant_name,tenant_id")
      .in("id", tenantIds.slice(i, i + 40));

    if (terr) throw new Error(terr.message);
    for (const t of tenants || []) {
      tenantMap.set(t.id, t.tenant_name || t.tenant_id);
    }
  }

  for (let i = 0; i < googleTenantIds.length; i += 40) {
    const { data: tenants, error: terr } = await supabase
      .from("google_workspace_tenants")
      .select("id,display_name,primary_domain")
      .in("id", googleTenantIds.slice(i, i + 40));

    if (terr) throw new Error(terr.message);
    for (const t of tenants || []) {
      googleTenantMap.set(t.id, t.display_name || t.primary_domain || "Google Workspace");
    }
  }

  for (let i = 0; i < ips.length; i += 40) {
    const { data: intel, error: ierr } = await supabase
      .from("ip_intelligence")
      .select(
        "ip_address,provider,asn,network_type,city,region,country,is_vpn,is_proxy,is_tor,is_relay,is_hosting,is_anonymous,privacy_service,privacy_available,last_checked_at"
      )
      .in("ip_address", ips.slice(i, i + 40));

    if (ierr) throw new Error(ierr.message);
    for (const x of intel || []) intelMap.set(String(x.ip_address), x);
  }

  const rows=signins.map((s: any) => {
    const intel = s.ip_address ? intelMap.get(String(s.ip_address)) : null;
    const { incident: _incidentRelation, ...signinFields } = s;

    return {
      ...signinFields,
      tenant_name: s.google_workspace_tenant_id
        ? googleTenantMap.get(s.google_workspace_tenant_id) || "Google Workspace"
        : s.microsoft_tenant_id
          ? tenantMap.get(s.microsoft_tenant_id) || null
          : "Legacy / Unassigned",
      ...(findingMap.get(s.id) || {}),
      finding_risk_score: findingMap.get(s.id)?.risk_score ?? null,
      finding_risk_reasons: findingMap.get(s.id)?.reasons ?? [],
      ...(() => {
        const joined = Array.isArray(s.incident) ? s.incident[0] : s.incident;
        if (joined && (joined.risk_score != null || (Array.isArray(joined.reasons) && joined.reasons.length))) {
          return {...joined, incident_risk_score: joined.risk_score, incident_risk_reasons: joined.reasons};
        }

        const direct = incidentMap.get(s.id);
        if (direct) return {...direct, incident_risk_score: direct.risk_score, incident_risk_reasons: direct.reasons};

        const user = String(s.user_principal_name || "").toLowerCase();
        const ip = String(s.ip_address || "");
        const currentTime = s.event_time ? new Date(s.event_time).getTime() : NaN;
        let best: any = null;
        let bestDelta = Infinity;

        for (const candidate of incidentFallbackCandidates) {
          const cs = candidate.signin;
          if (String(cs.user_principal_name || "").toLowerCase() !== user) continue;
          if (String(cs.ip_address || "") !== ip) continue;

          const candidateTime = cs.event_time ? new Date(cs.event_time).getTime() : NaN;
          const delta = Number.isFinite(currentTime) && Number.isFinite(candidateTime)
            ? Math.abs(currentTime - candidateTime)
            : Infinity;

          // Only correlate duplicate/history rows representing the same login window.
          if (delta <= 5 * 60 * 1000 && delta < bestDelta) {
            best = candidate.incident;
            bestDelta = delta;
          }
        }
        return best ? {...best, incident_risk_score: best.risk_score, incident_risk_reasons: best.reasons} : {};
      })(),
      intel_provider: intel?.provider ?? null,
      intel_asn: intel?.asn ?? null,
      intel_network_type: intel?.network_type ?? null,
      intel_city: intel?.city ?? null,
      intel_region: intel?.region ?? null,
      intel_country: intel?.country ?? null,
      intel_vpn: intel?.is_vpn ?? null,
      intel_proxy: intel?.is_proxy ?? null,
      intel_tor: intel?.is_tor ?? null,
      intel_relay: intel?.is_relay ?? null,
      intel_hosting: intel?.is_hosting ?? null,
      intel_anonymous: intel?.is_anonymous ?? null,
      intel_privacy_service: intel?.privacy_service ?? null,
      intel_privacy_available: intel?.privacy_available ?? null,
      intel_last_checked_at: intel?.last_checked_at ?? null,
    };
  });
  return {rows,total:count||0,page,pageSize};
}
