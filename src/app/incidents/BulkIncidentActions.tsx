"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

type Action="marked_safe"|"dismissed"|"confirmed_suspicious";
const labels:Record<Action,string>={marked_safe:"Mark Safe",dismissed:"Dismiss",confirmed_suspicious:"Confirm Suspicious"};
export default function BulkIncidentActions({ids}:{ids:string[]}){
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState<Action|null>(null);
 const [error,setError]=useState("");
 const router=useRouter();
 const chosen=selected.filter(id=>ids.includes(id));
 async function apply(action:Action){
  if(busy||!chosen.length)return;
  if(!window.confirm(`${labels[action]} ${chosen.length} selected incident${chosen.length===1?"":"s"}?${action!=="dismissed"?" This decision will be recorded as behavioral-learning feedback.":""}`))return;
  setBusy(action);setError("");window.dispatchEvent(new CustomEvent("microseconds:incident-working",{detail:{message:`${labels[action]}: updating ${chosen.length} incident${chosen.length===1?"":"s"}…`}}));
  try{
   const r=await fetch("/api/incidents/bulk-resolve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:chosen,resolution:action})});
   const j=await r.json();
   if(!r.ok||!j.ok){router.refresh();setSelected([]);throw new Error(j.error||"Could not update incidents.");}
   const message=`${j.updated} incident${j.updated===1?"":"s"} ${action==="marked_safe"?"marked safe":action==="dismissed"?"dismissed":"confirmed suspicious"}.`;
   sessionStorage.setItem("microseconds:incident-status",message);
   window.dispatchEvent(new CustomEvent("microseconds:incident-status",{detail:{message}}));
   window.dispatchEvent(new Event("microseconds:incidents-changed"));
   setSelected([]);router.refresh();
  }catch(e:any){setError(e?.message||"Could not update incidents.");}finally{setBusy(null);window.dispatchEvent(new Event("microseconds:incident-working-done"));}
 }
 return <>
  <div className="card" style={{marginBottom:14}}>
   <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
    <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}><input type="checkbox" checked={ids.length>0&&chosen.length===ids.length} disabled={!!busy||!ids.length} onChange={e=>setSelected(e.target.checked?[...ids]:[])}/> Select all on this page</label>
    <span aria-hidden="true" style={{height:26,borderLeft:"1px solid color-mix(in srgb, var(--border, #cbd5e1) 45%, transparent)",margin:"0 2px"}}/>
    <span className="subtitle">{chosen.length} selected</span>
    <button className="button" disabled={!chosen.length||!!busy} onClick={()=>setSelected([])}>Clear Selection</button>
    <span aria-hidden="true" style={{height:26,borderLeft:"1px solid color-mix(in srgb, var(--border, #cbd5e1) 45%, transparent)",margin:"0 2px"}}/>
    {(["marked_safe","dismissed","confirmed_suspicious"] as Action[]).map(action=><button key={action} className="button" style={{background:action==="marked_safe"?"#15803d":action==="dismissed"?"#1d4ed8":"#b91c1c",color:"#fff",borderColor:"transparent"}} disabled={!chosen.length||!!busy} onClick={()=>apply(action)}>{labels[action]}</button>)}
   </div>
   {error?<div className="errorBox" style={{marginTop:10}}>{error}</div>:null}
  </div>
  <style jsx global>{`.incident-bulk-check{width:18px;height:18px;accent-color:#2563eb;cursor:pointer}`}</style>
  <IncidentSelectionBridge ids={ids} selected={chosen} onChange={setSelected}/>
 </>;
}
// A single delegated change handler keeps checkboxes inside server-rendered incident cards in sync.
import {useEffect} from "react";
function IncidentSelectionBridge({ids,selected,onChange}:{ids:string[],selected:string[],onChange:(ids:string[])=>void}){
 useEffect(()=>{
  const setChecks=()=>document.querySelectorAll<HTMLInputElement>("input[data-incident-select]").forEach(el=>{el.checked=selected.includes(el.dataset.incidentSelect||"");});
  setChecks();
  const listener=(event:Event)=>{const target=event.target as HTMLInputElement;if(!target?.matches?.("input[data-incident-select]"))return;const id=target.dataset.incidentSelect||"";if(!ids.includes(id))return;onChange(target.checked?Array.from(new Set([...selected,id])):selected.filter(x=>x!==id));};
  document.addEventListener("change",listener);return()=>document.removeEventListener("change",listener);
 },[ids,selected,onChange]);
 return null;
}
