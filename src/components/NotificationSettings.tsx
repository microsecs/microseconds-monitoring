"use client";
import {useEffect,useState} from "react";
const empty={enabled:true,alert_emails:[] as string[],alert_successful_suspicious:true,min_risk_score:50,immediate_critical:true,hourly_digest_review:true};
export default function NotificationSettings(){
 const [s,setS]=useState<any>(empty),[msg,setMsg]=useState(""),[err,setErr]=useState(""),[saving,setSaving]=useState(false);
 const set=(k:string,v:any)=>setS((x:any)=>({...x,[k]:v}));
 useEffect(()=>{fetch("/api/notifications",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setS({...empty,...j.settings})}).catch(e=>setErr(e.message));},[]);
 async function save(){setSaving(true);setMsg("");setErr("");try{const r=await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:s.enabled,alertEmails:s.alert_emails.join("\n"),alertSuccessfulSuspicious:s.alert_successful_suspicious,minRiskScore:s.min_risk_score,immediateCritical:s.immediate_critical,hourlyDigestReview:s.hourly_digest_review})});const j=await r.json();if(!r.ok)throw new Error(j.error);setS({...empty,...j.settings});setMsg("Notification settings saved for all tenants.");}catch(e:any){setErr(e.message)}finally{setSaving(false)}}
 return <div className="card" id="notifications">
  <h2 style={{marginTop:0}}>Notifications</h2>
  <p className="muted">One notification policy applies to every Microsoft 365 and Google Workspace tenant.</p>
  {err?<div className="errorBox">{err}</div>:null}{msg?<div className="infoBox">{msg}</div>:null}
  <label style={{display:"flex",gap:10,alignItems:"center",marginTop:16}}><input type="checkbox" checked={!!s.enabled} onChange={e=>set("enabled",e.target.checked)}/><strong>Enable email security notifications</strong></label>
  <div style={{opacity:s.enabled?1:.5,pointerEvents:s.enabled?"auto":"none"}}>
   <div style={{marginTop:18}}><label className="subtitle">Send alerts to</label><textarea className="select" rows={4} value={(s.alert_emails||[]).join("\n")} onChange={e=>set("alert_emails",e.target.value.split(/\n/).map(x=>x.trim()).filter(Boolean))} placeholder={"security@example.com\nadmin@example.com"} style={{width:"100%",marginTop:6}}/></div>
   <label style={{display:"block",marginTop:16}}><input type="checkbox" checked={s.alert_successful_suspicious!==false} onChange={e=>set("alert_successful_suspicious",e.target.checked)}/> Alert on suspicious successful sign-ins</label>
   <div style={{marginTop:18}}>
    <label className="subtitle"><strong>Email notification threshold</strong></label>
    <div style={{marginTop:6,fontWeight:700}}>{s.min_risk_score}/100 — {Number(s.min_risk_score)>=70?"Critical":Number(s.min_risk_score)>=40?"Suspicious":"Review"}</div>
    <input type="range" min="15" max="100" step="5" value={s.min_risk_score} onChange={e=>set("min_risk_score",Number(e.target.value))} style={{width:"100%",marginTop:8}}/>
    <div className="muted" style={{marginTop:6}}>Only incidents scoring {s.min_risk_score} or higher will generate an email notification. Incidents below this notification threshold will still appear on the Incidents page; they simply will not generate an email.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:14}}>
     <div className="card" style={{padding:12,margin:0}}><strong>15–39 — Review</strong><div className="muted">Lower-confidence incident</div></div>
     <div className="card" style={{padding:12,margin:0}}><strong>40–69 — Suspicious</strong><div className="muted">Multiple or stronger risk indicators</div></div>
     <div className="card" style={{padding:12,margin:0}}><strong>70–100 — Critical</strong><div className="muted">High-risk activity requiring prompt review</div></div>
    </div>
   </div>
  </div>
  <button className="button primary" disabled={saving} onClick={save} style={{marginTop:20}}>{saving?"Saving…":"Save Notification Settings"}</button>
 </div>;
}