"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function DismissAllButton({ids}:{ids:string[]}){
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const router=useRouter();
  if(!ids.length)return null;
  async function run(){
    if(!window.confirm(`Dismiss all ${ids.length} incident${ids.length===1?"":"s"} currently shown?\n\nThey are not deleted and can be viewed with Show Dismissed.`))return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/incidents/bulk-dismiss",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})});
      const j=await r.json(); if(!r.ok)throw new Error(j?.error||"Bulk dismiss failed.");
      const message=`${ids.length} incident${ids.length===1?"":"s"} dismissed.`;
      sessionStorage.setItem("microseconds:incident-status",message);
      window.dispatchEvent(new CustomEvent("microseconds:incident-status",{detail:{message}}));
      window.dispatchEvent(new Event("microseconds:incidents-changed"));
      router.refresh();
    }catch(e:any){setError(e?.message||"Bulk dismiss failed.");}finally{setBusy(false);}
  }
  return <span style={{display:"inline-flex",gap:8,alignItems:"center"}}>
    <button className="button deleteAction" style={{fontSize:14}} disabled={busy} onClick={run}>
      {busy?"Dismissing…":`Dismiss All (${ids.length})`}
    </button>{error?<span style={{color:"#b42318",fontSize:13}}>{error}</span>:null}
  </span>;
}
