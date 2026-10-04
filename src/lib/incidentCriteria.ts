import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export type IncidentCriteria={
 incidents_enabled:boolean; new_country_enabled:boolean;new_country_points:number;new_city_enabled:boolean;new_city_points:number;first_seen_ip_enabled:boolean;first_seen_ip_points:number;
 new_provider_enabled:boolean;new_provider_points:number;first_seen_asn_enabled:boolean;first_seen_asn_points:number;
 vpn_proxy_enabled:boolean;vpn_proxy_points:number;tor_enabled:boolean;tor_points:number;hosting_enabled:boolean;hosting_points:number;
 google_suspicious_enabled:boolean;google_suspicious_points:number;incident_threshold:number;
 baseline_min_signins:number;baseline_days:number;baseline_max_events:number;retention_days:number;incident_retention_days:number;
};
export const DEFAULT_INCIDENT_CRITERIA:IncidentCriteria={
 incidents_enabled:true, new_country_enabled:true,new_country_points:20,new_city_enabled:true,new_city_points:10,first_seen_ip_enabled:true,first_seen_ip_points:8,
 new_provider_enabled:true,new_provider_points:8,first_seen_asn_enabled:true,first_seen_asn_points:6,
 vpn_proxy_enabled:true,vpn_proxy_points:15,tor_enabled:true,tor_points:35,hosting_enabled:true,hosting_points:10,
 google_suspicious_enabled:true,google_suspicious_points:40,incident_threshold:15,
 baseline_min_signins:3,baseline_days:90,baseline_max_events:500,retention_days:365,incident_retention_days:365
};
export async function getIncidentCriteria(organizationId:string):Promise<IncidentCriteria>{
 const {data,error}=await getSupabaseAdmin().from("incident_criteria_settings").select("*").eq("organization_id",organizationId).maybeSingle();
 if(error)throw error;
 return {...DEFAULT_INCIDENT_CRITERIA,...(data||{})};
}
