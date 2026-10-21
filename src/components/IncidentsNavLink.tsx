"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

// Preserve the last fetched incident count across client navigation.
// This module-level variable must be declared for TypeScript production builds.
// Keep the last successfully retrieved value through client-side navigation.
// A pending refresh must never temporarily reset the badge to zero.

let lastKnownPendingCount: number | null = null;

export default function IncidentsNavLink({initialCount=0}:{initialCount?:number}){
 const [count,setCount]=useState(() => lastKnownPendingCount ?? initialCount);
 useEffect(() => {
  if (lastKnownPendingCount !== null) setCount(lastKnownPendingCount);
  else if (initialCount > 0) { lastKnownPendingCount = initialCount; setCount(initialCount); }
 }, [initialCount]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const r=await fetch("/api/incidents/pending-count",{cache:"no-store"});
    if(!r.ok)return;
    const j=await r.json();
    if(!active)return;
    const next=Math.max(0,Number(j.count)||0);
    lastKnownPendingCount=next;
    document.cookie=`ms_pending_incident_count=${next}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;
    setCount(next);
   }catch{}
  };
  load();
  const id=window.setInterval(load,15000);
  const onFocus=()=>load();
  const onIncidentsChanged=()=>load();
  window.addEventListener("focus",onFocus);
  window.addEventListener("microseconds:incidents-changed",onIncidentsChanged);
  return()=>{active=false;window.clearInterval(id);window.removeEventListener("focus",onFocus);window.removeEventListener("microseconds:incidents-changed",onIncidentsChanged);};
 },[]);
 return <Link href="/incidents" style={{display:"inline-flex",alignItems:"center",gap:5}}>
  <span>Incidents</span>
  <span style={{display:"inline-flex",width:24,flex:"0 0 24px",alignItems:"center",justifyContent:"center"}}>
   {count>0?<span aria-label={`${count} incidents pending`} title={`${count} incidents pending`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:19,height:19,padding:"0 5px",borderRadius:999,background:"#dc2626",color:"white",fontSize:11,fontWeight:700,lineHeight:1,boxSizing:"border-box"}}>{count>99?"99+":count}</span>:null}
  </span>
 </Link>;
}
