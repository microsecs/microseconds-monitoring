"use client";
import {useEffect,useState} from "react";

const STORAGE_KEY="microseconds:incident-status";

export default function IncidentStatusPopup(){
  const [message,setMessage]=useState("");

  useEffect(()=>{
    const stored=sessionStorage.getItem(STORAGE_KEY);
    if(stored){
      sessionStorage.removeItem(STORAGE_KEY);
      setMessage(stored);
    }

    const onStatus=(event:Event)=>{
      const detail=(event as CustomEvent<{message?:string}>).detail;
      if(detail?.message)setMessage(detail.message);
    };
    window.addEventListener("microseconds:incident-status",onStatus);
    return ()=>window.removeEventListener("microseconds:incident-status",onStatus);
  },[]);

  useEffect(()=>{
    if(!message)return;
    const timer=window.setTimeout(()=>setMessage(""),3500);
    return ()=>window.clearTimeout(timer);
  },[message]);

  if(!message)return null;
  return <div
    role="status"
    aria-live="polite"
    style={{
      position:"fixed",
      left:"50%",
      bottom:24,
      transform:"translateX(-50%)",
      zIndex:1000,
      minWidth:280,
      maxWidth:"min(520px,calc(100vw - 32px))",
      padding:"11px 16px",
      borderRadius:8,
      border:"1px solid rgba(255,255,255,.16)",
      background:"#172033",
      boxShadow:"0 8px 28px rgba(0,0,0,.28)",
      fontSize:14,
      fontWeight:600,
      textAlign:"center"
    }}
  >{message}</div>;
}
