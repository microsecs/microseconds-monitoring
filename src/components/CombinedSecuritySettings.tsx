"use client";
import {useEffect,useState} from "react";

import PageLoading from "@/components/PageLoading";
const indicators:any={
 new_country:["New country","Country has not appeared in the user\'s established baseline."],
 new_city:["New city","City has not appeared in the user\'s established baseline."],
 first_seen_ip:["First-seen IP","IP address has not appeared in the user's established baseline."],
 new_provider:["New network provider","Network provider has not appeared in the user's established baseline."],
 first_seen_asn:["First-seen ASN","ASN has not appeared in the user's established baseline."],
 vpn_proxy:["VPN / Proxy","IP intelligence identifies a VPN or proxy."],
 tor:["Tor","IP intelligence identifies a Tor exit node."],
 hosting:["Hosting / Datacenter","IP belongs to a hosting or datacenter network."],
 google_suspicious:["Google suspicious activity","Google marks the login activity as suspicious."]
};

function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){
 return <button type="button" aria-pressed={checked} aria-label={label} onClick={()=>onChange(!checked)}
  style={{width:46,height:24,borderRadius:999,border:"1px solid rgba(255,255,255,.18)",padding:2,cursor:"pointer",
   background:checked?"#2563eb":"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:checked?"flex-end":"flex-start"}}>
   <span style={{width:18,height:18,borderRadius:"50%",background:"#fff",display:"block"}}/>
 </button>;
}
function Range({value,min,max,step=1,onChange}:{value:number;min:number;max:number;step?:number;onChange:(v:number)=>void}){
 return <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%"}}/>;
}

export default function CombinedSecuritySettings({showPageHeader=false}:{showPageHeader?:boolean}){
 const [criteria,setCriteria]=useState<any>(null),[defaults,setDefaults]=useState<any>(null),[notify,setNotify]=useState<any>(null),[monitoring,setMonitoring]=useState<boolean|null>(null);
 const [msg,setMsg]=useState(""),[err,setErr]=useState(""),[saving,setSaving]=useState(false);
 const c=(k:string,v:any)=>setCriteria((x:any)=>({...x,[k]:v}));
 const n=(k:string,v:any)=>setNotify((x:any)=>({...x,[k]:v}));

 useEffect(()=>{Promise.all([
  fetch("/api/settings/incident-criteria",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j;}),
  fetch("/api/notifications",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j;}),
  fetch("/api/settings/automatic-monitoring",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j;})
 ]).then(([a,b,m])=>{setCriteria(a.settings);setDefaults(a.defaults);setNotify(b.settings);setMonitoring(m.enabled===true);}).catch(e=>setErr(e.message));},[]);

 async function save(){
  if(!criteria||!notify||monitoring===null)return;
  setSaving(true);setMsg("");setErr("");
  try{
   const [a,b,m]=await Promise.all([
    fetch("/api/settings/incident-criteria",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(criteria)}),
    fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
     enabled:notify.enabled,alertEmails:(notify.alert_emails||[]).join("\n"),
     alertSuccessfulSuspicious:notify.alert_successful_suspicious,
     minRiskScore:criteria.incident_threshold,
     immediateCritical:notify.immediate_critical,hourlyDigestReview:notify.hourly_digest_review,
     notificationTimeZone:notify.notification_time_zone||"America/Los_Angeles"
    })}),
    fetch("/api/settings/automatic-monitoring",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:monitoring})})
   ]);
   const aj=await a.json(),bj=await b.json(),mj=await m.json();
   if(!a.ok)throw new Error(aj.error);if(!b.ok)throw new Error(bj.error);if(!m.ok)throw new Error(mj.error);
   setCriteria(aj.settings);setNotify(bj.settings);setMonitoring(mj.enabled===true);setMsg("Settings saved.");
  }catch(e:any){setErr(e.message)}finally{setSaving(false)}
 }

 if(!criteria||!notify||monitoring===null)return err ? <div className="errorBox">{err}</div> : <PageLoading/>;

 const disabled=!criteria.incidents_enabled;
 return <>
  {showPageHeader ? <div className="topbar"><div><div className="title">Settings</div><div className="subtitle">Incident detection, email alerts, baselines, and data retention</div></div></div> : null}
  <div style={{display:"grid",gap:16}}>
  {err?<div className="errorBox">{err}</div>:null}{msg?<div className="infoBox">{msg}</div>:null}

  <div className="card" id="automatic-monitoring" style={{padding:22}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
    <div>
     <h2 style={{margin:"0 0 5px"}}>Automatic Monitoring</h2>
     <div className="subtitle">Automatically monitor all eligible Microsoft 365 and Google Workspace tenants.</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
     <strong>{monitoring?"On":"Off"}</strong>
     <Toggle checked={monitoring} onChange={setMonitoring} label="Automatic monitoring"/>
    </div>
   </div>
   <div className="subtitle" style={{marginTop:12}}>When enabled, scheduled monitoring syncs eligible tenants, analyzes new successful sign-ins, creates incidents using your risk settings, and sends enabled email alerts. CSV-only tenants are ignored. Manual Sync and Sync All do not send email alerts.</div>
  </div>

  <div className="card" id="incidents" style={{padding:22}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
    <div><h2 style={{margin:"0 0 5px"}}>Incident Threshold</h2><div className="subtitle">Choose when suspicious activity becomes a security incident.</div></div>
    <div style={{display:"flex",alignItems:"center",gap:10}}><strong>Create incidents</strong><Toggle checked={!!criteria.incidents_enabled} onChange={v=>c("incidents_enabled",v)} label="Create security incidents"/></div>
   </div>
   <div style={{opacity:disabled?.5:1,pointerEvents:disabled?"none":"auto",marginTop:22}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12}}><strong>Risk score required</strong><strong style={{fontSize:22}}>{criteria.incident_threshold}/100</strong></div>
    <Range value={criteria.incident_threshold} min={5} max={100} step={5} onChange={v=>c("incident_threshold",v)}/>
    <div className="subtitle" style={{marginTop:7}}>A successful sign-in reaching this score will create an incident.</div>
   </div>
  </div>

  <div className="card" style={{padding:22}}>
   <h2 style={{margin:"0 0 5px"}}>Risk Indicators</h2>
   <div className="subtitle">Turn indicators on or off and choose how many points each contributes.</div>
   <div style={{opacity:disabled?.5:1,pointerEvents:disabled?"none":"auto",marginTop:12}}>
    {Object.entries(indicators).map(([k,v]:any)=><div key={k} style={{display:"grid",gridTemplateColumns:"minmax(220px,1.4fr) 54px minmax(180px,1fr) 58px",gap:14,alignItems:"center",padding:"13px 0",borderTop:"1px solid rgba(255,255,255,.08)"}}>
     <div><strong>{v[0]}</strong><div className="subtitle">{v[1]}</div></div>
     <Toggle checked={!!criteria[k+"_enabled"]} onChange={x=>c(k+"_enabled",x)} label={`Enable ${v[0]}`}/>
     <div style={{opacity:criteria[k+"_enabled"]?1:.35}}><Range value={criteria[k+"_points"]} min={0} max={50} step={1} onChange={x=>c(k+"_points",x)}/></div>
     <div style={{textAlign:"right",fontWeight:700}}>{criteria[k+"_points"]} pts</div>
    </div>)}
   </div>
  </div>

  <div className="card" id="notifications" style={{padding:22}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",flexWrap:"wrap"}}>
    <div><h2 style={{margin:"0 0 5px"}}>Email Incident Alerts</h2><div className="subtitle">Optionally send an email whenever the incident threshold is reached.</div></div>
    <div style={{display:"flex",alignItems:"center",gap:10}}><strong>Send email alert</strong><Toggle checked={!!notify.enabled&&notify.alert_successful_suspicious!==false} onChange={v=>{n("enabled",v);n("alert_successful_suspicious",v)}} label="Send email alerts"/></div>
   </div>
   <div style={{opacity:notify.enabled&&notify.alert_successful_suspicious!==false?1:.5,pointerEvents:notify.enabled&&notify.alert_successful_suspicious!==false?"auto":"none",marginTop:18}}>
    <label className="subtitle">Alert recipients</label>
    <textarea className="select" rows={3} value={(notify.alert_emails||[]).join("\n")} onChange={e=>n("alert_emails",e.target.value.split(/\n/).map(x=>x.trim()).filter(Boolean))} placeholder={"security@example.com\nadmin@example.com"} style={{width:"100%",marginTop:6}}/>
    <div style={{marginTop:16}}>
     <label className="subtitle" htmlFor="notification-timezone"><strong>Notification timezone</strong></label>
     <div className="subtitle" style={{marginTop:5}}>All alert recipients receive sign-in times in this timezone. Daylight saving time adjusts automatically.</div>
     <select id="notification-timezone" className="select" value={notify.notification_time_zone||"America/Los_Angeles"} onChange={e=>n("notification_time_zone",e.target.value)} style={{width:"100%",marginTop:8}}>
      {([["America/Los_Angeles","Pacific (Los Angeles)"],["America/Denver","Mountain (Denver)"],["America/Phoenix","Arizona (Phoenix)"],["America/Chicago","Central (Chicago)"],["America/New_York","Eastern (New York)"],["America/Anchorage","Alaska"],["Pacific/Honolulu","Hawaii"],["America/Toronto","Toronto"],["Europe/London","London"],["Europe/Paris","Central Europe"],["Asia/Kolkata","India"],["Asia/Tokyo","Tokyo"],["Australia/Sydney","Sydney"],["UTC","UTC"]] as string[][]).map(([id,label])=><option key={id} value={id}>{label}</option>)}
     </select>
    </div>
   </div>
  </div>

  <div className="card" id="advanced" style={{padding:22}}>
   <h2 style={{margin:"0 0 5px"}}>Baseline</h2><div className="subtitle">Controls how much history is required before “new” behavior is treated as meaningful.</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:22,marginTop:18}}>
    {[
     ["baseline_min_signins","Prior sign-ins required",0,20,1],
     ["baseline_days","Baseline history (days)",30,365,5],
     ["baseline_max_events","Maximum baseline events",100,2000,50]
    ].map(([k,label,min,max,step]:any)=><div key={k}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{label}</strong><strong>{criteria[k]}</strong></div><Range value={criteria[k]} min={min} max={max} step={step} onChange={v=>c(k,v)}/></div>)}
   </div>
  </div>

  <div className="card" id="retention" style={{padding:22}}>
   <h2 style={{margin:"0 0 5px"}}>Data Retention</h2><div className="subtitle">Choose how long sign-in history and incidents are retained.</div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:24,marginTop:18}}>
    <div><div style={{display:"flex",justifyContent:"space-between"}}><strong>Sign-in history</strong><strong>{criteria.retention_days} days</strong></div><Range value={criteria.retention_days} min={30} max={1095} step={30} onChange={v=>c("retention_days",v)}/></div>
    <div><div style={{display:"flex",justifyContent:"space-between"}}><strong>Security incidents</strong><strong>{criteria.incident_retention_days} days</strong></div><Range value={criteria.incident_retention_days} min={30} max={1095} step={30} onChange={v=>c("incident_retention_days",v)}/></div>
   </div>
  </div>

  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
   <button className="button primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Settings"}</button>
   <button className="button" disabled={saving||!defaults} onClick={()=>{setCriteria({...defaults});setMsg("Defaults loaded. Click Save Settings to apply them.");}}>Reset to Defaults</button>
  </div>
 </div>
 </>;
}
