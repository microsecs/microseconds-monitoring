import IncidentActions from "./IncidentActions";
import DismissAllButton from "./DismissAllButton";
import {getIncidentQueuePage} from "@/lib/incidents";
import IncidentStatusPopup from "./IncidentStatusPopup";
import LocalDateTime from "@/components/LocalDateTime";
export const dynamic="force-dynamic";
function cleanRiskReasons(input:any[] = []) {
  const out:string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    let text = String(raw || "").trim();
    if (!text) continue;
    let key = text.toLowerCase().replace(/[.;]+$/g, "").trim();
    if (key === "hosting/datacenter network" || key === "hosting/datacenter network detected") {
      key = "hosting/datacenter network";
      text = "Hosting/datacenter network detected";
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function privacyLabel(intel:any){
 if(!intel)return "Unknown";
 if(intel.is_tor)return "Yes";
 if(intel.is_vpn)return intel.privacy_service?`Yes — ${intel.privacy_service}`:"Yes";
 if(intel.is_proxy)return intel.privacy_service?`Yes — ${intel.privacy_service}`:"Yes";
 if(intel.is_relay)return "Yes";
 if(intel.is_anonymous===true)return "Yes";
 if(intel.is_hosting)return "Hosting/datacenter";
 if(intel.privacy_available===true)return "None detected";
 return "Unknown";
}
function href(params:any,page:number){const p=new URLSearchParams();if(params.failed==="1")p.set("failed","1");if(params.dismissed==="1")p.set("dismissed","1");if(params.q)p.set("q",params.q);p.set("page",String(page));return `/incidents?${p.toString()}`;}
export default async function IncidentsPage({searchParams}:{searchParams:Promise<{failed?:string;dismissed?:string;page?:string;q?:string}>}){
 const params=await searchParams,includeFailed=params.failed==="1",includeDismissed=params.dismissed==="1",search=(params.q||"").trim();
 const page=Math.max(1,Number(params.page||"1")||1),pageSize=100;
 const result=await getIncidentQueuePage({page,pageSize,includeDismissed,includeFailed,search:search||undefined});
 const rows=result.rows,total=result.total,totalPages=Math.max(1,Math.ceil(total/pageSize));
 const first=rows.length?(page-1)*pageSize+1:0,last=rows.length?first+rows.length-1:0;
 const active=rows.filter((x:any)=>x.status!=="dismissed");
 const critical=active.filter((x:any)=>x.severity==="critical");
 const suspicious=active.filter((x:any)=>x.severity==="suspicious");
 return <>
  <IncidentStatusPopup />
  <div className="topbar"><div><div className="title">Security Incidents</div><div className="subtitle">Microsoft 365 and Google Workspace sign-ins that deserve attention</div></div>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
    <div style={{display:"flex",gap:6,alignItems:"center",paddingRight:12,borderRight:"1px solid var(--line)"}}>
     <form method="get" style={{display:"flex",gap:6,alignItems:"center"}}>
      {includeFailed?<input type="hidden" name="failed" value="1"/>:null}
      {includeDismissed?<input type="hidden" name="dismissed" value="1"/>:null}
      <input className="input" type="search" name="q" defaultValue={search} placeholder="Search incidents…" aria-label="Search incidents" style={{width:220,height:38,padding:"0 12px",fontSize:14,borderRadius:8}}/>
      <button className="button" type="submit">Search</button>
      {search?<a className="button deleteAction" title="Clear search" aria-label="Clear search" href={`/incidents?failed=${includeFailed?"1":"0"}&dismissed=${includeDismissed?"1":"0"}&page=1`}>×</a>:null}
     </form>
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center",paddingRight:12,borderRight:"1px solid var(--line)"}}>
     <a className="button" style={{fontSize:14}} href={`/incidents?failed=${includeFailed?"0":"1"}&dismissed=${includeDismissed?"1":"0"}${search?`&q=${encodeURIComponent(search)}`:""}&page=1`}>{includeFailed?"Hide Failed Logins":"Include Failed Logins"}</a>
     <a className="button" style={{fontSize:14}} href={`/incidents?failed=${includeFailed?"1":"0"}&dismissed=${includeDismissed?"0":"1"}${search?`&q=${encodeURIComponent(search)}`:""}&page=1`}>{includeDismissed?"Hide Dismissed":"Show Dismissed"}</a>
    </div>
    <div style={{display:"flex",alignItems:"center"}}>
     {!includeDismissed?<DismissAllButton ids={rows.filter((x:any)=>x.status!=="dismissed").map((x:any)=>x.id)}/>:null}
    </div>
   </div>
  </div>

  <div className="tenantSummary" aria-label="Incident summary">
   {[
    ["Incidents on This Page",rows.length,"Incidents shown in the current view"],
    ["Active",active.length,"Incidents that still need review"],
    ["Critical",critical.length,"Highest-risk incidents on this page"],
    ["Suspicious",suspicious.length,"Suspicious incidents on this page"]
   ].map(([label,value,description]:any)=>
    <div className="tenantMetric" key={label}>
     <div className="tenantMetricValue">{value}</div>
     <div className="tenantMetricLabel">{label}</div>
     <div className="tenantMetricHint">{description}</div>
    </div>)}
  </div>

  {!rows.length?<div className="card"><h2 style={{marginTop:0}}>No incidents found</h2><p className="subtitle">No incidents match the current view.</p></div>:
  <div style={{display:"grid",gap:14}}>
   {rows.map((row:any)=>{const s=row.signin||{},reasons=cleanRiskReasons(Array.isArray(row.reasons)?row.reasons:[]),success=String(s.status||"").toLowerCase()==="success";
    const platform=s.source_platform==="google"?"Google Workspace":"Microsoft 365";
    const location=[s.city||s.intel?.city,s.region||s.intel?.region,s.country||s.intel?.country].filter(Boolean).join(", ")||"Unknown";
    return <div className="card" key={row.id} style={{fontSize:14,lineHeight:1.45}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
       <span className={`pill ${row.severity==="critical"?"critical":row.severity==="suspicious"?"warning":"normal"}`}>{String(row.severity).toUpperCase()}</span>
       {success?<span className="pill normal">SUCCESSFUL SIGN-IN</span>:null}<span className="pill">{String(row.status||"open").replaceAll("_"," ").toUpperCase()}</span>
       {row.alerted_at?<span className="pill">ALERT SENT</span>:null}
      </div>
      <h2 style={{marginBottom:5,fontSize:20}}>{row.title}</h2><div className="subtitle">{row.tenant_name} · {platform} · <LocalDateTime value={s.event_time||row.created_at} fallback="Unknown time" /></div></div>
      <div style={{textAlign:"right"}}><div className="subtitle">Risk Score</div><div style={{fontSize:26,fontWeight:700}}>{row.risk_score}/100</div></div>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",columnGap:28,rowGap:16,marginTop:18}}>
      <div><div className="subtitle">User</div><div>{s.user_display_name||s.user_principal_name||"Historical incident"}</div>{s.user_display_name&&s.user_principal_name?<div className="subtitle">{s.user_principal_name}</div>:null}</div>
      <div style={{minWidth:0}}><div className="subtitle">IP Address</div><div style={{overflowWrap:"anywhere",wordBreak:"break-word"}}>{s.ip_address||"Not retained"}</div></div>
      <div style={{minWidth:0}}><div className="subtitle">Location</div><div>{location}</div></div>
      <div><div className="subtitle">Network</div><div>{s.intel?.provider||s.intel?.asn||"Unknown"}</div></div>
      <div><div className="subtitle">VPN / Privacy</div><div>{privacyLabel(s.intel)}</div></div>
      <div><div className="subtitle">Application</div><div>{s.app_name||platform}</div></div>
     </div>
     {reasons.length?<div style={{marginTop:18}}><div className="subtitle">Why it was flagged</div><div style={{display:"grid",gap:4,marginTop:7}}>{reasons.map((r:string,i:number)=><div key={i} style={{color:"#fde68a",fontSize:"inherit",fontWeight:400}}>• {r}</div>)}</div></div>:null}
     {row.ai_reviewed?<div style={{marginTop:18,padding:"14px 16px",border:"1px solid var(--line)",borderRadius:10,background:"rgba(15,23,42,.45)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
       <div className="subtitle" style={{marginRight:2}}>AI Review</div>
       <span className={`pill ${String(row.ai_classification||"").toLowerCase()==="critical"?"critical":String(row.ai_classification||"").toLowerCase()==="suspicious"?"warning":"normal"}`}>{String(row.ai_classification||"Reviewed").toUpperCase()}</span>
       {row.ai_confidence!=null?<span className="pill">{Number(row.ai_confidence)}% CONFIDENCE</span>:null}
      </div>
      {row.ai_summary?<div style={{marginTop:9,lineHeight:1.55}}>{row.ai_summary}</div>:null}
      <div className="subtitle" style={{marginTop:8}}>AI provides a second-stage assessment. The rules-based detection remains the underlying incident trigger.</div>
     </div>:null}
     <IncidentActions incidentId={row.id} currentStatus={row.status}/>
    </div>})}
  </div>}
  <div className="card" style={{marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div className="subtitle">Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} incidents</div>
   <div style={{display:"flex",gap:8,alignItems:"center"}}>
    {page>1?<a className="button" href={href(params,page-1)}>Previous</a>:null}
    <span className="subtitle">Page {Math.min(page,totalPages)} of {totalPages}</span>
    {page<totalPages?<a className="button" href={href(params,page+1)}>Next</a>:null}
   </div>
  </div>
 </>;
}
