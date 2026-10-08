"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "datetime" | "date" | "time";

export default function LocalDateTime({value, mode="datetime", fallback="—", className}:{value:any; mode?:Mode; fallback?:string; className?:string}) {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const text=useMemo(()=>{
    if(!mounted || !value) return mounted ? fallback : "…";
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return fallback;
    if(mode==="date") return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    if(mode==="time") return d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
    return d.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
  },[mounted,value,mode,fallback]);
  return <span className={className} suppressHydrationWarning>{text}</span>;
}
