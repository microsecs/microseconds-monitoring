"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";

export default function IncidentActions({incidentId,currentStatus}:{incidentId:string,currentStatus:string}){
 const [status,setStatus]=useState(currentStatus),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const router=useRouter();

 useEffect(()=>{
  setStatus(currentStatus);
  if(busy && currentStatus==="dismissed")setBusy(false);
 },[currentStatus,busy]);

 async function dismiss(){
  if(busy||status==="dismissed")return;
  setBusy(true);setError("");
  try{
   const r=await fetch(`/api/incidents/${incidentId}`,{
    method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"dismissed"})
   });
   const j=await r.json();
   if(!r.ok)throw new Error(j?.error||"Could not dismiss incident.");
   setStatus("dismissed");
   const message = "Incident dismissed.";
   sessionStorage.setItem("microseconds:incident-status", message);
   window.dispatchEvent(new CustomEvent("microseconds:incident-status",{detail:{message}}));
   window.dispatchEvent(new Event("microseconds:incidents-changed"));
   router.refresh();
  }catch(e:any){setError(e?.message||"Could not dismiss incident.");setBusy(false);}
 }

 if(status==="dismissed")return <div style={{marginTop:20}}>
  <div className="subtitle">Status: dismissed</div>
 </div>;

 return <div style={{marginTop:20}}>
  <button className="button primary" disabled={busy} title="Removes this incident from the active queue without deleting the underlying sign-in." onClick={dismiss}>Dismiss</button>
  {busy?<div className="infoBox" style={{marginTop:10,padding:"9px 12px"}}><strong>Dismissing incident…</strong> Please wait while the incident list updates.</div>:null}
  {error?<div className="errorBox" style={{marginTop:9}}>{error}</div>:null}
 </div>;
}
