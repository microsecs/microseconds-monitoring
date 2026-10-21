"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

// Keep the last successfully retrieved value through client-side navigation.
// A pending refresh must never temporarily reset the badge to zero.
let lastKnownPendingCount = 0;

export default function IncidentsNavLink(){
 const [count,setCount]=useState(lastKnownPendingCount);
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
 return <Link href="/incidents" style={{display:"inline-flex",alignItems:"center",gap:6}}>
  <span>Incidents</span>
  <span style={{display:"inline-flex",width:30,flex:"0 0 30px",alignItems:"center",justifyContent:"center"}}>
   {count>0?<span aria-label={`${count} incidents pending`} title={`${count} incidents pending`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:19,height:19,padding:"0 5px",borderRadius:999,background:"#dc2626",color:"white",fontSize:11,fontWeight:700,lineHeight:1,boxSizing:"border-box"}}>{count>99?"99+":count}</span>:null}
  </span>
 </Link>;
}
