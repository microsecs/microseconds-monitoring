"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

export default function IncidentActions({incidentId,currentStatus,resolution}:{incidentId:string,currentStatus:string,resolution?:string|null}){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");const router=useRouter();
 async function resolve(action:"marked_safe"|"dismissed"|"confirmed_suspicious"){
  if(busy||currentStatus==="dismissed")return;setBusy(action);setError("");
  try{const r=await fetch(`/api/incidents/${incidentId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({resolution:action})});
   const j=await r.json();if(!r.ok)throw new Error(j?.error||"Could not resolve incident.");
   const label=action==="marked_safe"?"marked safe":action==="confirmed_suspicious"?"confirmed suspicious":"dismissed";
   const message=`Incident ${label}.`;sessionStorage.setItem("microseconds:incident-status",message);window.dispatchEvent(new CustomEvent("microseconds:incident-status",{detail:{message}}));window.dispatchEvent(new Event("microseconds:incidents-changed"));router.refresh();
  }catch(e:any){setError(e?.message||"Could not resolve incident.");setBusy(null);}
 }
 if(currentStatus==="dismissed")return <div style={{marginTop:20}}><div className="subtitle">Resolution: {String(resolution||"dismissed").replaceAll("_"," ")}</div></div>;
 return <div style={{marginTop:20}}>
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   <button className="button" disabled={!!busy} onClick={()=>resolve("marked_safe")}>{busy==="marked_safe"?"Saving…":"Mark Safe"}</button>
   <button className="button primary" disabled={!!busy} onClick={()=>resolve("dismissed")}>{busy==="dismissed"?"Dismissing…":"Dismiss"}</button>
   <button className="button deleteAction" disabled={!!busy} onClick={()=>resolve("confirmed_suspicious")}>{busy==="confirmed_suspicious"?"Saving…":"Confirm Suspicious"}</button>
  </div>
  {error?<div className="errorBox" style={{marginTop:9}}>{error}</div>:null}
 </div>;
}
