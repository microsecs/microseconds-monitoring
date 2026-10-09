import Link from "next/link";
import {requireProductAdmin} from "@/lib/productAdmin";
import {getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {DEFAULT_INCIDENT_CRITERIA} from "@/lib/incidentCriteria";
export const dynamic="force-dynamic";
type Filters={organization?:string;tenant?:string;days?:string;changed?:string;page?:string};
const PER_PAGE=50;
function url(f:Filters){const q=new URLSearchParams();Object.entries(f).forEach(([k,v])=>{if(v)q.set(k,v)});return `/admin/behavioral-learning?${q}`;}
export default async function Page({searchParams}:{searchParams:Promise<Filters>}){
 await requireProductAdmin();const f=await searchParams;const db=getSupabaseAdmin();
 const days=[7,30,90].includes(Number(f.days))?Number(f.days):30;
 const page=Math.max(1,Math.min(10000,parseInt(f.page||"1",10)||1));
 const since=new Date(Date.now()-days*86400000).toISOString();
 const [or,ms,gs,membersResult]=await Promise.all([db.from("organizations").select("id,name").order("name"),db.from("microsoft_tenants").select("id,organization_id,tenant_name"),db.from("google_workspace_tenants").select("id,organization_id,display_name,primary_domain"),db.from("organization_members").select("organization_id,user_id,role")]);
 const orgs=or.data||[];const organization=orgs.some(x=>x.id===f.organization)?f.organization||"":"";
 const tenants=[...(ms.data||[]).map(x=>({id:x.id,organization_id:x.organization_id,name:x.tenant_name||"Microsoft",provider:"Microsoft"})),...(gs.data||[]).map(x=>({id:x.id,organization_id:x.organization_id,name:x.display_name||x.primary_domain||"Google",provider:"Google"}))].filter(x=>!organization||x.organization_id===organization);
 const tenant=tenants.some(x=>x.id===f.tenant)?f.tenant||"":"";const changed=f.changed==="1";
 const base=(head=false)=>{let q=db.from("behavior_shadow_assessments").select("*",{count:"exact",head}).gte("event_time",since);if(organization)q=q.eq("organization_id",organization);if(tenant)q=q.eq("tenant_record_id",tenant);return q;};
 const [all,changedResult,records]=await Promise.all([base(true),base(true).neq("adjustment",0),changed?base().neq("adjustment",0).order("event_time",{ascending:false}).range((page-1)*PER_PAGE,page*PER_PAGE-1):base().order("event_time",{ascending:false}).range((page-1)*PER_PAGE,page*PER_PAGE-1)]);
 const error=all.error||changedResult.error||records.error;const total=all.count||0;const changedCount=changedResult.count||0;const filtered=changed?changedCount:total;const rows=records.data||[];
 // Validation is based on the visible page only, never misrepresented as global accuracy.
 // Match incidents by sign-in ID AND organization ID; shared external tenants are independent.
 const rowIds=rows.map(r=>r.signin_id).filter(Boolean);
 const [incidentLookup,thresholdLookup]=await Promise.all([
   rowIds.length?db.from("security_incidents").select("signin_id,organization_id,resolution").in("signin_id",rowIds):Promise.resolve({data:[],error:null}),
   db.from("incident_criteria_settings").select("organization_id,incident_threshold")
 ]);
 const validationError=incidentLookup.error||thresholdLookup.error;
 const incidentByKey=new Map<string,string>();
 for(const inc of incidentLookup.data||[]){incidentByKey.set(`${inc.organization_id}:${inc.signin_id}`,String(inc.resolution||""));}
 const thresholdByOrg=new Map<string,number>();
 for(const setting of thresholdLookup.data||[]){thresholdByOrg.set(setting.organization_id,Number(setting.incident_threshold));}
 const thresholdFor=(orgId:string)=>thresholdByOrg.get(orgId)??DEFAULT_INCIDENT_CRITERIA.incident_threshold;
 const outcomeFor=(r:any)=>incidentByKey.get(`${r.organization_id}:${r.signin_id}`)||"";
 const impactFor=(r:any)=>{const threshold=thresholdFor(r.organization_id);const live=Number(r.live_score)>=threshold;const proposed=Number(r.proposed_score)>=threshold;return live===proposed?"No change":proposed?"Would cross threshold":"Would fall below threshold";};
 const reviewed=rows.filter(r=>["marked_safe","confirmed_suspicious"].includes(outcomeFor(r)));
 const safe=reviewed.filter(r=>outcomeFor(r)==="marked_safe").length;
 const suspicious=reviewed.filter(r=>outcomeFor(r)==="confirmed_suspicious").length;
 const newCrossings=rows.filter(r=>impactFor(r)==="Would cross threshold").length;
 const lostCrossings=rows.filter(r=>impactFor(r)==="Would fall below threshold").length;
 // Resolve the account owner's login email using the same membership relationship as Product Admin.
 const members=membersResult.data||[];
 const ownerByOrg=new Map<string,string>();
 for(const member of members){
   if(member.role==="owner" && !ownerByOrg.has(member.organization_id))ownerByOrg.set(member.organization_id,member.user_id);
 }
 for(const member of members){if(!ownerByOrg.has(member.organization_id))ownerByOrg.set(member.organization_id,member.user_id);}
 const ownerIds=new Set(ownerByOrg.values());
 const emailByUser=new Map<string,string>();
 if(ownerIds.size){
   for(let userPage=1;userPage<=10;userPage++){
     const {data,error:userError}=await db.auth.admin.listUsers({page:userPage,perPage:1000});
     if(userError)break;
     for(const user of data?.users||[]){if(ownerIds.has(user.id)&&user.email)emailByUser.set(user.id,user.email);}
     if((data?.users?.length||0)<1000 || emailByUser.size===ownerIds.size)break;
   }
 }
 const customerEmail=new Map(orgs.map(org=>[org.id,emailByUser.get(ownerByOrg.get(org.id)||"")||"Unknown customer"]));
 // Scope tenant lookups by both organization and internal connection ID.
 const tenantName=new Map(tenants.map(x=>[`${x.organization_id}:${x.id}`,x.name]));
 const query={organization,tenant,days:String(days),changed:changed?"1":""};
 return <><div className="adminBack"><Link href="/admin">← Product Admin</Link></div><div className="topbar"><div><div className="title">Behavioral Learning</div><div className="subtitle">Shadow mode · No impact on live risk scores, incidents or alerts</div></div></div>
 <div className="grid4 adminMetrics"><div className="card"><div className="label">Assessments · {days} days</div><div className="metric">{total.toLocaleString()}</div></div><div className="card"><div className="label">Proposed changes</div><div className="metric">{changedCount.toLocaleString()}</div></div><div className="card"><div className="label">Unchanged</div><div className="metric">{(total-changedCount).toLocaleString()}</div></div><div className="card"><div className="label">Changed share</div><div className="metric">{total?(100*changedCount/total).toFixed(1):"0.0"}%</div></div></div>
 <div className="section card"><h2>Learning validation · current page</h2><div className="muted">These metrics cover only the {rows.length} assessments displayed on this page, not all {filtered.toLocaleString()} matching records. Decisions are verified administrator outcomes; unreviewed and dismissed incidents are excluded. Threshold comparison uses each customer’s current configured threshold, not necessarily the threshold at event time. Live is the deterministic pre-AI score.</div>
 <div className="grid4 adminMetrics" style={{marginTop:14}}><div className="card"><div className="label">Verified Safe</div><div className="metric">{safe}</div></div><div className="card"><div className="label">Confirmed Suspicious</div><div className="metric">{suspicious}</div></div><div className="card"><div className="label">Would cross threshold</div><div className="metric">{newCrossings}</div></div><div className="card"><div className="label">Would fall below threshold</div><div className="metric">{lostCrossings}</div></div></div>
 {validationError?<div className="muted">Validation lookup unavailable: {validationError.message}</div>:null}
 <div className="muted">{reviewed.length?`${reviewed.length} reviewed outcomes on this page. These counts do not establish predictive accuracy or a false-positive rate.`:"No verified Safe or Suspicious decisions on this page yet; accuracy cannot be evaluated."}</div></div>
 <div className="section card"><div className="adminTableHeader"><div><h2>Shadow assessments</h2><div className="muted">UTC timestamps. A proposed adjustment does not necessarily mean improved accuracy.</div></div></div>
 <form method="get" action="/admin/behavioral-learning" className="learningFilters"><label>Period<select name="days" defaultValue={String(days)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><label>Customer<select name="organization" defaultValue={organization}><option value="">All customers</option>{orgs.map(x=><option key={x.id} value={x.id}>{customerEmail.get(x.id)||"Unknown customer"}</option>)}</select></label><label>Tenant<select name="tenant" defaultValue={tenant}><option value="">All tenants</option>{tenants.map(x=><option key={x.id} value={x.id}>{x.name} ({x.provider})</option>)}</select></label><label>Changes<select name="changed" defaultValue={changed?"1":""}><option value="">All</option><option value="1">Changed only</option></select></label><button type="submit" className="btn">Apply</button></form>
 {error?<div className="adminComingSoon">Unable to load assessments: {error.message}. Verify the Phase 2B SQL migration.</div>:rows.length?<><div className="tableScroll"><table className="table learningTable"><thead><tr><th>Sign-in (UTC)</th><th>Customer Email</th><th>Tenant</th><th>Sign-in User</th><th>Live</th><th>Proposed</th><th>Change</th><th>Admin Decision</th><th>Threshold Impact</th><th>Evidence</th></tr></thead><tbody>{rows.map(r=><tr key={r.signin_id}><td>{new Date(r.event_time).toLocaleString("en-US",{timeZone:"UTC",timeZoneName:"short"})}</td><td className="learningUser">{customerEmail.get(r.organization_id)||"Unknown customer"}</td><td>{tenantName.get(`${r.organization_id}:${r.tenant_record_id}`)||"Unknown tenant"}</td><td className="learningUser">{r.user_principal_name}</td><td>{r.live_score}</td><td>{r.proposed_score}</td><td>{r.adjustment>0?"+":""}{r.adjustment}</td><td>{outcomeFor(r)==="marked_safe"?"Verified Safe":outcomeFor(r)==="confirmed_suspicious"?"Confirmed Suspicious":outcomeFor(r)==="dismissed"?"Dismissed (neutral)":"Unreviewed / no incident"}</td><td>{impactFor(r)}<div className="muted">Threshold: {thresholdFor(r.organization_id)}</div></td><td>{Array.isArray(r.reasons)&&r.reasons.length?r.reasons.join("; "):"No adjustment"}<div className="muted">Historical sign-ins: {r.history_count}</div></td></tr>)}</tbody></table></div><div className="learningPages"><span>Page {page} · {filtered.toLocaleString()} matching</span><div>{page>1&&<Link className="btn" href={url({...query,page:String(page-1)})}>Previous</Link>}{page*PER_PAGE<filtered&&<Link className="btn" href={url({...query,page:String(page+1)})}>Next</Link>}</div></div></>:<div className="empty">No assessments match these filters.</div>}</div><div className="adminComingSoon">Shadow scoring remains observation-only. Administrator decisions are not ground-truth labels for every sign-in; validate larger samples before changing production scoring.</div></>;
}
