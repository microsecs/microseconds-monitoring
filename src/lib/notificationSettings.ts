import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export type EffectiveNotificationSettings={
 source:"organization";enabled:boolean;alert_emails:string[];
 alert_successful_suspicious:boolean;alert_failed_suspicious:boolean;
 min_risk_score:number;immediate_critical:boolean;hourly_digest_review:boolean;
 recipient_time_zones:Record<string,string>;
};
const DEFAULTS:EffectiveNotificationSettings={source:"organization",enabled:true,alert_emails:[],
 alert_successful_suspicious:true,alert_failed_suspicious:false,min_risk_score:50,
 immediate_critical:true,hourly_digest_review:true,recipient_time_zones:{}};
function normalize(row:any):EffectiveNotificationSettings{return {source:"organization",
 enabled:row?.enabled!==false,alert_emails:Array.isArray(row?.alert_emails)?row.alert_emails:[],
 alert_successful_suspicious:row?.alert_successful_suspicious!==false,
 alert_failed_suspicious:row?.alert_failed_suspicious===true,
 min_risk_score:Math.max(0,Math.min(100,Number(row?.min_risk_score??50))),
 immediate_critical:row?.immediate_critical!==false,hourly_digest_review:row?.hourly_digest_review!==false,
 recipient_time_zones:row?.recipient_time_zones&&typeof row.recipient_time_zones==="object"&&!Array.isArray(row.recipient_time_zones)?row.recipient_time_zones:{}};}
export async function getOrganizationNotificationSettings(organizationId:string){
 const {data,error}=await getSupabaseAdmin().from("organization_notification_settings").select("*").eq("organization_id",organizationId).maybeSingle();
 if(error)throw error;return data?normalize(data):DEFAULTS;
}
// Backward-compatible: tenant-specific overrides are intentionally ignored.
export async function getEffectiveNotificationSettings(organizationId:string,_tenantId?:string){return getOrganizationNotificationSettings(organizationId);}
export async function getTenantNotificationRecord(_organizationId:string,_tenantId:string){return null;}
