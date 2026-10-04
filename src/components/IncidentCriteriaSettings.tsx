"use client";
import {useEffect,useState} from "react";
import PageLoading from "@/components/PageLoading";
const labels:any={
 new_country:["New country","Country has not appeared in the user's baseline."],
 first_seen_ip:["First-seen IP","IP address has not appeared in the user's baseline."],
 new_provider:["New network provider","Network provider has not appeared in the user's baseline."],
 first_seen_asn:["First-seen ASN","ASN has not appeared in the user's baseline."],
 vpn_proxy:["VPN / Proxy","IP intelligence identifies a VPN or proxy."],
 tor:["Tor","IP intelligence identifies a Tor exit node."],
 hosting:["Hosting / Datacenter","IP belongs to a hosting or datacenter network."],
 google_suspicious:["Google suspicious activity","Google marks the login activity as suspicious."]
};
export default function IncidentCriteriaSettings(){
 const [s,setS]=useState<any>(null),[defaults,setDefaults]=useState<any>(null),[msg,setMsg]=useState(""),[saving,setSaving]=useState(false);
 async function load(){const r=await fetch("/api/settings/incident-criteria",{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error);setS(j.settings);setDefaults(j.defaults);}
 useEffect(()=>{load().catch(e=>setMsg(e.message));},[]);
 const set=(k:string,v:any)=>setS((x:any)=>({...x,[k]:v}));
 async function save(){setSaving(true);setMsg("");try{const r=await fetch("/api/settings/incident-criteria",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}),j=await r.json();if(!r.ok)throw new Error(j.error);setS(j.settings);setMsg("Incident criteria saved.");}catch(e:any){setMsg(e.message)}finally{setSaving(false)}}
 if(!s)return msg ? <div className="errorBox">{msg}</div> : <PageLoading/>;
 return <div className="card">
  <h2>Incident Criteria</h2>
  <p className="muted">Successful sign-ins accumulate points from the enabled criteria below. An incident is created when the total reaches the minimum incident score.</p>
  <div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>Enabled</th><th>Criterion</th><th>Points</th></tr></thead><tbody>
   {Object.entries(labels).map(([k,v]:any)=><tr key={k}>
    <td><input type="checkbox" checked={!!s[k+"_enabled"]} onChange={e=>set(k+"_enabled",e.target.checked)}/></td>
    <td><strong>{v[0]}</strong><div className="muted">{v[1]}</div></td>
    <td><input className="input" style={{width:90}} type="number" min="0" max="100" value={s[k+"_points"]} disabled={!s[k+"_enabled"]} onChange={e=>set(k+"_points",Number(e.target.value))}/></td>
   </tr>)}
  </tbody></table></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginTop:20}}>
   <label><strong>Minimum incident score</strong><input className="input" type="number" min="1" max="100" value={s.incident_threshold} onChange={e=>set("incident_threshold",Number(e.target.value))}/></label>
   <label><strong>Prior sign-ins required</strong><input className="input" type="number" min="0" max="100" value={s.baseline_min_signins} onChange={e=>set("baseline_min_signins",Number(e.target.value))}/></label>
   <label><strong>Baseline history (days)</strong><input className="input" type="number" min="1" max="3650" value={s.baseline_days} onChange={e=>set("baseline_days",Number(e.target.value))}/></label>
   <label><strong>Maximum baseline events</strong><input className="input" type="number" min="10" max="5000" value={s.baseline_max_events} onChange={e=>set("baseline_max_events",Number(e.target.value))}/></label>
   <label><strong>Sign-in retention (days)</strong><input className="input" type="number" min="30" max="3650" value={s.retention_days} onChange={e=>set("retention_days",Number(e.target.value))}/><div className="muted">Default 365 days. Raw sign-in records older than this are removed automatically.</div></label>
   <label><strong>Incident retention (days)</strong><input className="input" type="number" min="30" max="3650" value={s.incident_retention_days} onChange={e=>set("incident_retention_days",Number(e.target.value))}/><div className="muted">Default 1095 days (3 years). Incidents are retained independently of raw sign-in history.</div></label>
  </div>
  <div style={{display:"flex",gap:10,marginTop:20,alignItems:"center"}}>
   <button className="button primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Criteria"}</button>
   <button className="button" disabled={saving||!defaults} onClick={()=>{setS({...defaults});setMsg("Defaults loaded. Click Save Criteria to apply them.");}}>Reset to Defaults</button>
   {msg?<span className="muted">{msg}</span>:null}
  </div>
 </div>
}
