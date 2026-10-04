"use client";
import {useEffect,useState} from "react";
import PageLoading from "@/components/PageLoading";
const labels:any={
 new_country:["New country","Country has not appeared in the user's established baseline."],
 first_seen_ip:["First-seen IP","IP address has not appeared in the user's established baseline."],
 new_provider:["New network provider","Network provider has not appeared in the user's established baseline."],
 first_seen_asn:["First-seen ASN","ASN has not appeared in the user's established baseline."],
 vpn_proxy:["VPN / Proxy","IP intelligence identifies a VPN or proxy."],
 tor:["Tor","IP intelligence identifies a Tor exit node."],
 hosting:["Hosting / Datacenter","IP belongs to a hosting or datacenter network."],
 google_suspicious:["Google suspicious activity","Google marks the login activity as suspicious."]
};
export default function SecuritySettings(){
 const [s,setS]=useState<any>(null),[defaults,setDefaults]=useState<any>(null),[msg,setMsg]=useState(""),[saving,setSaving]=useState(false);
 const set=(k:string,v:any)=>setS((x:any)=>({...x,[k]:v}));
 useEffect(()=>{fetch("/api/settings/incident-criteria",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setS(j.settings);setDefaults(j.defaults)}).catch(e=>setMsg(e.message));},[]);
 async function save(){setSaving(true);setMsg("");try{const r=await fetch("/api/settings/incident-criteria",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}),j=await r.json();if(!r.ok)throw new Error(j.error);setS(j.settings);setMsg("Incident and retention settings saved.");}catch(e:any){setMsg(e.message)}finally{setSaving(false)}}
 if(!s)return msg ? <div className="errorBox">{msg}</div> : <PageLoading/>;
 return <>
  <div className="card" id="incidents">
   <h2 style={{marginTop:0}}>Incidents</h2>
   <p className="muted">Control incident creation for every connected tenant. Sign-in collection continues even when incidents are disabled.</p>
   <label style={{display:"flex",gap:10,alignItems:"center",margin:"18px 0"}}>
    <input type="checkbox" checked={!!s.incidents_enabled} onChange={e=>set("incidents_enabled",e.target.checked)}/>
    <strong>Enable security incidents</strong>
   </label>
   <div style={{opacity:s.incidents_enabled?1:.5,pointerEvents:s.incidents_enabled?"auto":"none"}}>
    <div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>Enabled</th><th>Criterion</th><th>Points</th></tr></thead><tbody>
     {Object.entries(labels).map(([k,v]:any)=><tr key={k}><td><input type="checkbox" checked={!!s[k+"_enabled"]} onChange={e=>set(k+"_enabled",e.target.checked)}/></td>
      <td><strong>{v[0]}</strong><div className="muted">{v[1]}</div></td>
      <td><input className="input" style={{width:90}} type="number" min="0" max="100" value={s[k+"_points"]} disabled={!s[k+"_enabled"]} onChange={e=>set(k+"_points",Number(e.target.value))}/></td></tr>)}
    </tbody></table></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginTop:20}}>
     <label><strong style={{display:"block",marginBottom:7}}>Minimum incident score</strong><input className="input" type="number" min="1" max="100" value={s.incident_threshold} onChange={e=>set("incident_threshold",Number(e.target.value))}/></label>
     <label><strong style={{display:"block",marginBottom:7}}>Prior sign-ins required</strong><input className="input" type="number" min="0" max="100" value={s.baseline_min_signins} onChange={e=>set("baseline_min_signins",Number(e.target.value))}/></label>
     <label><strong style={{display:"block",marginBottom:7}}>Baseline history (days)</strong><input className="input" type="number" min="1" max="3650" value={s.baseline_days} onChange={e=>set("baseline_days",Number(e.target.value))}/></label>
     <label><strong style={{display:"block",marginBottom:7}}>Maximum baseline events</strong><input className="input" type="number" min="10" max="5000" value={s.baseline_max_events} onChange={e=>set("baseline_max_events",Number(e.target.value))}/></label>
    </div>
   </div>
   <div style={{display:"flex",gap:10,marginTop:20,alignItems:"center",flexWrap:"wrap"}}>
    <button className="button primary" disabled={saving} onClick={save}>{saving?"Saving…":"Save Incident Settings"}</button>
    <button className="button" disabled={saving||!defaults} onClick={()=>{setS({...defaults});setMsg("Defaults loaded. Click Save Incident Settings to apply them.");}}>Reset to Defaults</button>
    {msg?<span className="muted">{msg}</span>:null}
   </div>
  </div>

  <div className="card" id="retention">
   <h2 style={{marginTop:0}}>Retention</h2>
   <p className="muted">Choose how long raw sign-in history and security incidents are retained.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
    <label><strong>Sign-in retention (days)</strong><input className="input" type="number" min="30" max="3650" value={s.retention_days} onChange={e=>set("retention_days",Number(e.target.value))}/><div className="muted">Default: 365 days.</div></label>
    <label><strong>Incident retention (days)</strong><input className="input" type="number" min="30" max="3650" value={s.incident_retention_days} onChange={e=>set("incident_retention_days",Number(e.target.value))}/><div className="muted">Default: 365 days.</div></label>
   </div>
   <button className="button primary" disabled={saving} onClick={save} style={{marginTop:20}}>{saving?"Saving…":"Save Retention Settings"}</button>
  </div>
 </>;
}
