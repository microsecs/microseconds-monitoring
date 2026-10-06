import { getSupabaseAdmin, getOrCreateDevOrganization } from "@/lib/supabaseAdmin";
import { createIncidentAnalysis } from "@/lib/aiIncident";
import { sendIncidentAlerts } from "@/lib/emailAlerts";
import { getEffectiveNotificationSettings, getOrganizationNotificationSettings } from "@/lib/notificationSettings";
import { getIncidentCriteria, IncidentCriteria } from "@/lib/incidentCriteria";

const uniq=(a:any[])=>Array.from(new Set(a));
const severity=(n:number)=>n>=70?"critical":n>=40?"suspicious":"review";
type Provider="microsoft"|"google";
function countryKey(v:any){
 const x=String(v||"").trim().toUpperCase();
 const map:any={"US":"US","USA":"US","UNITED STATES":"US","UNITED STATES OF AMERICA":"US",
 "CA":"CA","CAN":"CA","CANADA":"CA","GB":"GB","UK":"GB","UNITED KINGDOM":"GB","GREAT BRITAIN":"GB"};
 return map[x]||x;
}

async function intel(ip:any){
 if(!ip)return null;
 const {data}=await getSupabaseAdmin().from("ip_intelligence").select("*").eq("ip_address",String(ip)).maybeSingle();
 return data||null;
}

async function baseline(s:any,provider:Provider,tenantRecordId:string,criteria:IncidentCriteria){
 const db=getSupabaseAdmin(),u=s.user_principal_name;
 if(!u)return {priorCount:0,knownCountries:[],knownCities:[],knownIps:[],knownProviders:[],knownAsns:[]};
 const since=new Date(Date.now()-criteria.baseline_days*86400000).toISOString();
 let q=db.from("signins").select("id,ip_address,country,city,status").eq("organization_id",s.organization_id)
   .eq("user_principal_name",u).ilike("status","success").lt("event_time",s.event_time).gte("event_time",since).neq("id",s.id).limit(criteria.baseline_max_events);
 q=provider==="google"?q.eq("google_workspace_tenant_id",tenantRecordId):q.eq("microsoft_tenant_id",tenantRecordId);
 const {data:p,error}=await q;if(error)throw error;
 const ips=uniq((p||[]).map((x:any)=>String(x.ip_address||"")).filter(Boolean)) as string[];

 // Resolve prior countries using the same data sources as the current event. Raw provider
 // country values are preferred, with IP intelligence as a fallback. This prevents an empty
 // or differently formatted Google Reports country from being compared against enriched data
 // for the current event and incorrectly becoming "New country".
 const priorIntel=new Map<string,any>();
 const providers:any[]=[],asns:any[]=[];
 for(let i=0;i<ips.length;i+=40){
  const {data}=await db.from("ip_intelligence").select("ip_address,provider,asn,country,country_code,city").in("ip_address",ips.slice(i,i+40));
  for(const x of data||[]){
   priorIntel.set(String(x.ip_address),x);
   if(x.provider)providers.push(String(x.provider).toLowerCase());
   if(x.asn)asns.push(String(x.asn).toUpperCase());
  }
 }
 const countries=uniq((p||[]).map((x:any)=>{
   const pi=x.ip_address?priorIntel.get(String(x.ip_address)):null;
   return countryKey(x.country||pi?.country_code||pi?.country||"");
 }).filter(Boolean)) as string[];
 const cities=uniq((p||[]).map((x:any)=>{
   const pi=x.ip_address?priorIntel.get(String(x.ip_address)):null;
   return String(x.city||pi?.city||"").trim().toLowerCase();
 }).filter(Boolean)) as string[];
 return {priorCount:p?.length||0,knownCountries:countries,knownCities:cities,knownIps:ips,knownProviders:uniq(providers),knownAsns:uniq(asns)};
}

export async function processProviderIncidents(x:{
 organizationId:string; provider:Provider; tenantRecordId:string; tenantName:string; since?:string; sendAlerts?:boolean
}){
 const db=getSupabaseAdmin();
 const criteria=await getIncidentCriteria(x.organizationId);
 // Notification policy is organization-wide for all Microsoft 365 and Google Workspace tenants.
 const settings=await getOrganizationNotificationSettings(x.organizationId);
 if(criteria.incidents_enabled===false){
   return {created:0,alerted:0,notificationSource:"organization",incidentsDisabled:true};
 }

 const requested=x.since?new Date(x.since).getTime():Date.now()-7200000;
 const since=new Date(Math.min(requested,Date.now()-7200000)).toISOString();

 let q=db.from("signins")
  .select("id,organization_id,microsoft_tenant_id,google_workspace_tenant_id,source_platform,event_time,user_principal_name,user_display_name,ip_address,city,region,country,app_name,status,microsoft_risk")
  .eq("organization_id",x.organizationId).gte("event_time",since)
  .order("event_time",{ascending:false}).limit(1000);
 q=x.provider==="google"?q.eq("google_workspace_tenant_id",x.tenantRecordId):q.eq("microsoft_tenant_id",x.tenantRecordId);
 const {data:rows,error}=await q;if(error)throw error;

 let created=0,alerted=0;
 for(const s of rows||[]){
  const {data:old}=await db.from("security_incidents").select("id").eq("signin_id",s.id).maybeSingle();if(old)continue;
  const {data:f}=await db.from("security_findings").select("risk_score,reasons").eq("signin_id",s.id).maybeSingle();
  const b=await baseline(s,x.provider,x.tenantRecordId,criteria),ii=await intel(s.ip_address),extra:string[]=[];

  if(b.priorCount>=criteria.baseline_min_signins){
   const c=countryKey(s.country||ii?.country_code||ii?.country||"");
   if(criteria.new_country_enabled&&c&&!b.knownCountries.includes(c))extra.push(`New country for this user: ${ii?.country||s.country||c}`);
   const city=String(s.city||ii?.city||"").trim();
   if(criteria.new_city_enabled&&city&&!b.knownCities.includes(city.toLowerCase()))extra.push(`New city for this user: ${city}`);
   if(criteria.first_seen_ip_enabled&&s.ip_address&&!b.knownIps.includes(String(s.ip_address)))extra.push("First-seen IP address for this user");
   const pr=String(ii?.provider||"").trim();
   if(criteria.new_provider_enabled&&pr&&b.knownProviders.length&&!b.knownProviders.includes(pr.toLowerCase()))extra.push(`New network provider for this user: ${pr}`);
   const asn=String(ii?.asn||"").trim();
   if(criteria.first_seen_asn_enabled&&asn&&b.knownAsns.length&&!b.knownAsns.includes(asn.toUpperCase()))extra.push(`First-seen ASN for this user: ${asn}`);
  }

  // Failed sign-ins remain in Sign-in History but never create incidents by themselves.
  // They remain available as telemetry for future correlation/detection logic.
  const success=String(s.status||"").toLowerCase()==="success";
  if(!success) continue;

  const baselineEstablished=b.priorCount>=criteria.baseline_min_signins;
  const rawFindingReasons:any[]=[...(Array.isArray(f?.reasons)?f.reasons:[])];
  // Legacy security_findings may contain behavioral scores computed before a user had a baseline.
  // During learning, remove those behavioral components so a first/new user cannot create
  // an incident merely because country/IP/region is first-seen.
  const learningBehavior=[
    {test:(r:string)=>r.toLowerCase().includes("new country"),points:30},
    {test:(r:string)=>r.toLowerCase().includes("new region"),points:15},
    {test:(r:string)=>r.toLowerCase().includes("first-seen ip"),points:8},
    {test:(r:string)=>r.toLowerCase().includes("repeated failed"),points:15}
  ];
  let score=Number(f?.risk_score||0);
  let reasons:any[]=rawFindingReasons;
  if(!baselineEstablished){
    for(const rule of learningBehavior){
      if(reasons.some((r:any)=>rule.test(String(r)))) score=Math.max(0,score-rule.points);
    }
    reasons=reasons.filter((r:any)=>!learningBehavior.some(rule=>rule.test(String(r))));
  }

  // Provider-native signal: Google Reports can mark an event suspicious.
  if(criteria.google_suspicious_enabled&&x.provider==="google"&&String(s.microsoft_risk||"").toLowerCase()==="high"){
    score=Math.max(score,criteria.google_suspicious_points);
    reasons.push("Google marked this login activity as suspicious");
  }
  if(criteria.tor_enabled&&ii?.is_tor){score+=criteria.tor_points;reasons.push("Tor exit node detected");}
  else if(criteria.vpn_proxy_enabled&&(ii?.is_vpn||ii?.is_proxy)){score+=criteria.vpn_proxy_points;reasons.push(ii?.is_vpn?"VPN detected":"Proxy detected");}
  if(criteria.hosting_enabled&&ii?.is_hosting){score+=criteria.hosting_points;reasons.push("Hosting/datacenter network detected");}

  if(extra.some(r=>r.startsWith("New country")))score+=criteria.new_country_points;
  if(extra.some(r=>r.startsWith("New city")))score+=criteria.new_city_points;
  if(extra.some(r=>r.includes("First-seen IP")))score+=criteria.first_seen_ip_points;
  if(extra.some(r=>r.startsWith("New network provider")))score+=criteria.new_provider_points;
  if(extra.some(r=>r.startsWith("First-seen ASN")))score+=criteria.first_seen_asn_points;
  score=Math.min(100,score);if(score<criteria.incident_threshold)continue;

  const allReasons=uniq([...reasons,...extra]);
  const fallback=x.provider==="google"?"Google Workspace user":"Microsoft 365 user";
  const user=s.user_display_name||s.user_principal_name||fallback;
  const title=`Suspicious successful sign-in for ${user}`;
  const summary=`Successful ${x.provider==="google"?"Google Workspace":"Microsoft 365"} sign-in from ${s.country||ii?.country||"an unknown country"} using ${s.ip_address||"an unknown IP"}. ${allReasons.join("; ")}`;
  const ai=await createIncidentAnalysis({cloudProvider:x.provider==="google"?"Google Workspace":"Microsoft 365",user,time:s.event_time,ip:s.ip_address,country:s.country||ii?.country||null,city:s.city||ii?.city||null,provider:ii?.provider||null,asn:ii?.asn||null,app:s.app_name,status:s.status,riskScore:score,reasons:allReasons,baseline:b});

  const incidentRow:any={
   organization_id:x.organizationId,signin_id:s.id,severity:severity(score),risk_score:score,
   title,summary,ai_summary:ai,reasons:allReasons,baseline:b
  };
  if(x.provider==="google"){
   incidentRow.microsoft_tenant_id=null;
   incidentRow.google_workspace_tenant_id=x.tenantRecordId;
  }else{
   incidentRow.microsoft_tenant_id=x.tenantRecordId;
   incidentRow.google_workspace_tenant_id=null;
  }
  const {data:inc,error:ie}=await db.from("security_incidents").insert(incidentRow).select("*").single();
  if(ie){if(String(ie.message).toLowerCase().includes("duplicate"))continue;throw ie;}created++;

  if(x.sendAlerts!==false&&settings.enabled&&score>=settings.min_risk_score&&
    settings.alert_successful_suspicious){
   const r=await sendIncidentAlerts({organizationId:x.organizationId,incident:inc,signin:s,tenantName:x.tenantName,recipients:settings.alert_emails});
   if(r.sent){alerted+=r.sent;await db.from("security_incidents").update({alerted_at:new Date().toISOString()}).eq("id",inc.id);}
  }
 }
 return {created,alerted,notificationSource:settings.source};
}

// Backward-compatible wrapper for Microsoft/CSV routes.
export async function processTenantIncidents(x:{organizationId:string;microsoftTenantRecordId:string;tenantName:string;since?:string;sendAlerts?:boolean}){
 return processProviderIncidents({
  organizationId:x.organizationId,provider:"microsoft",tenantRecordId:x.microsoftTenantRecordId,
  tenantName:x.tenantName,since:x.since,sendAlerts:x.sendAlerts
 });
}

export async function getIncidentQueuePage(opts:{page?:number;pageSize?:number;includeDismissed?:boolean;includeFailed?:boolean;search?:string}={}){
 const db=getSupabaseAdmin();
 const page=Math.max(1,opts.page||1),pageSize=Math.min(250,Math.max(25,opts.pageSize||100));
 // Resolve the organization from the authenticated user's membership. The admin client
 // bypasses RLS, so every customer-facing incident query must explicitly carry this ID.
 const o:any=await getOrCreateDevOrganization();
 if(!o)return {rows:[],total:0,page,pageSize};

 // We must apply the failed-login filter BEFORE pagination. security_incidents does not
 // contain sign-in status, so fetch candidate incidents in chunks, join sign-ins, filter,
 // then slice the requested page. This prevents page 1 from being empty while the count
 // still says incidents exist.
 let candidates:any[]=[];
 const chunkSize=500;
 for(let offset=0;;offset+=chunkSize){
   let q=db.from("security_incidents").select("*").eq("organization_id",o.id);
   if(!opts.includeDismissed)q=q.neq("status","dismissed");
   const {data,error}=await q.order("created_at",{ascending:false}).range(offset,offset+chunkSize-1);
   if(error)throw error;
   candidates.push(...(data||[]));
   if(!data||data.length<chunkSize)break;
 }

 const sids=uniq(candidates.map((i:any)=>i.signin_id).filter(Boolean)) as string[];
 const ss:any[]=[];
 for(let i=0;i<sids.length;i+=100){
   const {data,error}=await db.from("signins").select("id,event_time,user_principal_name,user_display_name,ip_address,city,region,country,app_name,status,source_platform").in("id",sids.slice(i,i+100));
   if(error)throw error; ss.push(...(data||[]));
 }
 const sm0=new Map(ss.map((s:any)=>[s.id,s]));
 let filtered=candidates;
 if(!opts.includeFailed){
   // Incidents whose raw sign-in has aged out are historical incidents, not failed logins,
   // so retain them. Only exclude a row when its retained sign-in explicitly says non-success.
   filtered=filtered.filter((x:any)=>{
     const s=sm0.get(x.signin_id);
     return !s || String(s.status||"").toLowerCase()==="success";
   });
 }

 const total=filtered.length,start=(page-1)*pageSize;
 const incidents=filtered.slice(start,start+pageSize);
 if(!incidents.length)return {rows:[],total,page,pageSize};

 const pageSids=uniq(incidents.map((i:any)=>i.signin_id).filter(Boolean)) as string[];
 const pageSs=ss.filter((s:any)=>pageSids.includes(s.id));
 const mts:any[]=[],gts:any[]=[],intel:any[]=[];
 const mtids=uniq(incidents.map((i:any)=>i.microsoft_tenant_id).filter(Boolean)) as string[];
 const gtids=uniq(incidents.map((i:any)=>i.google_workspace_tenant_id).filter(Boolean)) as string[];
 for(let i=0;i<mtids.length;i+=40){const {data}=await db.from("microsoft_tenants").select("id,tenant_name,tenant_id").eq("organization_id",o.id).in("id",mtids.slice(i,i+40));mts.push(...(data||[]));}
 for(let i=0;i<gtids.length;i+=40){const {data}=await db.from("google_workspace_tenants").select("id,display_name,primary_domain").eq("organization_id",o.id).in("id",gtids.slice(i,i+40));gts.push(...(data||[]));}
 const ips=uniq(pageSs.map((s:any)=>String(s.ip_address||"")).filter(Boolean)) as string[];
 for(let i=0;i<ips.length;i+=40){const {data}=await db.from("ip_intelligence").select("ip_address,provider,asn,city,region,country,country_code,is_vpn,is_proxy,is_tor,is_relay,is_hosting,privacy_service,privacy_available").in("ip_address",ips.slice(i,i+40));intel.push(...(data||[]));}
 const im=new Map(intel.map((x:any)=>[String(x.ip_address),x]));
 const sm=new Map(pageSs.map((s:any)=>[s.id,{...s,intel:im.get(String(s.ip_address||""))||null}]));
 const mtm=new Map(mts.map((t:any)=>[t.id,t.tenant_name||t.tenant_id])),gtm=new Map(gts.map((t:any)=>[t.id,t.display_name||t.primary_domain||"Google Workspace"]));
 const rows=incidents.map((x:any)=>({...x,signin:sm.get(x.signin_id)||null,tenant_name:x.google_workspace_tenant_id?(gtm.get(x.google_workspace_tenant_id)||"Google Workspace Tenant"):x.microsoft_tenant_id?(mtm.get(x.microsoft_tenant_id)||"Microsoft 365 Tenant"):"Unassigned"}));
 return {rows,total,page,pageSize};
}
// Backward compatibility
export async function getIncidentQueue(limit=250){return (await getIncidentQueuePage({page:1,pageSize:Math.min(limit,250),includeDismissed:true,includeFailed:true})).rows;}
