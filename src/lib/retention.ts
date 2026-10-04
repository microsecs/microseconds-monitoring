import {getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {getIncidentCriteria} from "@/lib/incidentCriteria";

async function chunks<T>(items:T[],size=100){
 const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out;
}

export async function enforceDataRetention(organizationId:string){
 const db=getSupabaseAdmin(),settings=await getIncidentCriteria(organizationId);
 const signInCutoff=new Date(Date.now()-settings.retention_days*86400000).toISOString();
 const incidentCutoff=new Date(Date.now()-settings.incident_retention_days*86400000).toISOString();
 let signinsDeleted=0,incidentsDeleted=0;

 // Purge raw sign-ins in bounded batches. security_incidents.signin_id is ON DELETE SET NULL,
 // so historical incidents survive even after the underlying raw event expires.
 for(let pass=0;pass<20;pass++){
  const {data:old,error}=await db.from("signins").select("id")
    .eq("organization_id",organizationId).lt("event_time",signInCutoff)
    .order("event_time",{ascending:true}).limit(500);
  if(error)throw error;
  const ids=(old||[]).map((x:any)=>x.id); if(!ids.length)break;

  // Findings and alert delivery logs are event-level data and can age out with the raw event.
  for(const group of await chunks(ids,100)){
   await db.from("email_alert_log").delete().in("signin_id",group);
   await db.from("security_findings").delete().in("signin_id",group);
   const {error:de}=await db.from("signins").delete().in("id",group);if(de)throw de;
   signinsDeleted+=group.length;
  }
  if(ids.length<500)break;
 }

 // Incidents have their own longer retention window.
 for(let pass=0;pass<20;pass++){
  const {data:old,error}=await db.from("security_incidents").select("id")
    .eq("organization_id",organizationId).lt("created_at",incidentCutoff)
    .order("created_at",{ascending:true}).limit(500);
  if(error)throw error;
  const ids=(old||[]).map((x:any)=>x.id);if(!ids.length)break;
  for(const group of await chunks(ids,100)){
   const {error:de}=await db.from("security_incidents").delete().in("id",group);if(de)throw de;
   incidentsDeleted+=group.length;
  }
  if(ids.length<500)break;
 }

 return {
  signinsDeleted,incidentsDeleted,
  signInRetentionDays:settings.retention_days,
  incidentRetentionDays:settings.incident_retention_days,
  signInCutoff,incidentCutoff
 };
}

// Backward-compatible name for any code from the previous retention patch.
export const enforceSignInRetention=enforceDataRetention;
