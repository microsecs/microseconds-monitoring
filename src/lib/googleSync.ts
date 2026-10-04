import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { refreshGoogleAccessToken, googleLoginActivities, googleDirectoryUsers } from "@/lib/googleWorkspace";
import { getIpIntel, mapLimit } from "@/lib/graphSync";

function parameters(activity:any){
 const m=new Map<string,any>();
 for(const e of activity.events||[])for(const p of e.parameters||[])
  m.set(p.name,p.boolValue ?? p.value ?? p.intValue ?? p.multiValue ?? null);
 return m;
}
function names(activity:any){return (activity.events||[]).map((e:any)=>e.name).filter(Boolean);}
function classify(eventNames:string[]){
 if(eventNames.includes("login_success"))return {status:"success",failure:null};
 const failed=eventNames.find(n=>n.includes("failure")||n.includes("failed"));
 return failed?{status:"failure",failure:failed}:{status:eventNames[0]||"event",failure:null};
}
export async function syncGoogleWorkspaceTenant(tenant:any){
 const sb=getSupabaseAdmin();
 const token=await refreshGoogleAccessToken(tenant.refresh_token_encrypted);
 const start=tenant.last_sync_at
  ? new Date(new Date(tenant.last_sync_at).getTime()-2*60*60*1000).toISOString()
  : new Date(Date.now()-30*24*60*60*1000).toISOString();
 const [activities, directoryUsers]=await Promise.all([
  googleLoginActivities(token,start),
  googleDirectoryUsers(token)
 ]);
 const directoryNameMap=new Map(
  directoryUsers.map(u=>[u.primaryEmail.toLowerCase(),u.fullName])
 );
 const rows:any[]=[];
 for(const a of activities){
  const p=parameters(a),eventNames=names(a),classification=classify(eventNames);
  const externalId=String(a.id?.uniqueQualifier||crypto.createHash("sha256").update(JSON.stringify(a)).digest("hex"));
  const fingerprint=crypto.createHash("sha256").update(`google|${tenant.id}|${externalId}`).digest("hex");
  const suspicious=p.get("is_suspicious")===true||p.get("is_suspicious")==="true";
  const row:any={
   organization_id:tenant.organization_id,
   microsoft_tenant_id:null,
   google_workspace_tenant_id:tenant.id,
   import_id:null,
   source:"google",
   source_platform:"google",
   external_id:externalId,
   fingerprint,
   user_principal_name:a.actor?.email||p.get("affected_email_address")||null,
   user_display_name:(()=>{
     const email=String(a.actor?.email||p.get("affected_email_address")||"").toLowerCase();
     return directoryNameMap.get(email)||a.actor?.email||p.get("affected_email_address")||null;
   })(),
   event_time:a.id?.time||new Date().toISOString(),
   ip_address:a.ipAddress||null,
   city:null,region:null,country:null,
   app_name:"Google Workspace",
   client_app:p.get("login_type")||null,
   browser:null,operating_system:null,
   status:classification.status,
   failure_reason:classification.failure,
   error_code:null,
   microsoft_risk:suspicious?"high":null,
   raw:a
  };
  rows.push(row);
 }

 // Deduplicate in memory first, then ask Supabase for existing IDs in chunks.
 // This avoids one database round-trip for every Google event.
 const uniqueRows = Array.from(new Map(rows.map(r => [r.external_id, r])).values());

 // Enrich every unique public Google sign-in IP through the same IPinfo/cache
 // pipeline used by Microsoft Graph. History joins this cache automatically.
 const uniqueIps = Array.from(new Set(
   uniqueRows.map(r => r.ip_address).filter(Boolean)
 )) as string[];
 const intelResults = await mapLimit(uniqueIps, 4, async (ip) => {
   try {
     const intel = await getIpIntel(ip);
     return intel ? { ip, ok: true } : { ip, ok: false };
   } catch (e) {
     console.error("Google IP intelligence lookup failed", ip, e);
     return { ip, ok: false };
   }
 });
 const ipIntelCached = intelResults.filter(x => x.ok).length;

 // Repair historical Google sign-ins that were saved before IP enrichment
 // succeeded (notably older IPv6 events). This intentionally scans stored
 // rows with missing geo fields rather than only the current Reports API window.
 const historicalIps = new Set<string>();
 let histFrom = 0;
 const histPageSize = 1000;
 while (true) {
   const { data: histRows, error: histError } = await sb.from("signins")
     .select("ip_address,city,region,country")
     .eq("organization_id", tenant.organization_id)
     .eq("google_workspace_tenant_id", tenant.id)
     .not("ip_address", "is", null)
     .range(histFrom, histFrom + histPageSize - 1);
   if (histError) throw histError;
   for (const r of histRows || []) {
     if (r.ip_address && (!r.city || !r.region || !r.country)) historicalIps.add(String(r.ip_address));
   }
   if (!histRows || histRows.length < histPageSize) break;
   histFrom += histPageSize;
 }

 let historicalIpsRepaired = 0;
 const historicalResults = await mapLimit(Array.from(historicalIps), 4, async (ip) => {
   try {
     const intel = await getIpIntel(ip);
     if (!intel) return false;
     const geo: Record<string, string> = {};
     if (intel.city) geo.city = intel.city;
     if (intel.region) geo.region = intel.region;
     if (intel.country) geo.country = intel.country;
     if (!Object.keys(geo).length) return false;
     const { error } = await sb.from("signins")
       .update(geo)
       .eq("organization_id", tenant.organization_id)
       .eq("google_workspace_tenant_id", tenant.id)
       .eq("ip_address", ip);
     if (error) throw error;
     return true;
   } catch (e) {
     console.error("Historical Google sign-in enrichment failed", ip, e);
     return false;
   }
 });
 historicalIpsRepaired = historicalResults.filter(Boolean).length;

 const existingIds = new Set<string>();
 for (let i=0;i<uniqueRows.length;i+=100) {
   const ids=uniqueRows.slice(i,i+100).map(r=>r.external_id);
   const {data,error}=await sb.from("signins").select("external_id")
     .eq("organization_id",tenant.organization_id)
     .eq("google_workspace_tenant_id",tenant.id)
     .in("external_id",ids);
   if(error)throw error;
   for(const r of data||[]) if(r.external_id) existingIds.add(r.external_id);
 }
 const newRows=uniqueRows.filter(r=>!existingIds.has(r.external_id));
 let processed=0;
 for(let i=0;i<newRows.length;i+=100){
   const {error}=await sb.from("signins").insert(newRows.slice(i,i+100));
   if(error)throw error;
   processed+=Math.min(100,newRows.length-i);
 }
 const now=new Date().toISOString();
 const {error:updateError}=await sb.from("google_workspace_tenants")
  .update({last_sync_at:now,last_verified_at:now,updated_at:now}).eq("id",tenant.id);
 if(updateError)throw updateError;
 return {eventsReturned:activities.length,processed,duplicatesIgnored:uniqueRows.length-newRows.length,uniqueIps:uniqueIps.length,ipIntelCached,historicalIpsChecked:historicalIps.size,historicalIpsRepaired};
}
