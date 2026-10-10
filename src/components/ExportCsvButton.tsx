"use client";
import {useEffect,useRef,useState} from "react";
export default function ExportCsvButton({href,filename}:{href:string;filename:string}){
 const [state,setState]=useState<"idle"|"working"|"success"|"error">("idle");
 const [message,setMessage]=useState("");
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 async function download(){
  if(state==="working")return;
  if(timer.current)clearTimeout(timer.current);
  setState("working");setMessage("Preparing CSV export…");
  try{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),120000);
   let response:Response;
   try{response=await fetch(href,{credentials:"same-origin",signal:controller.signal});}finally{clearTimeout(timeout);}
   if(!response.ok){const text=await response.text();throw new Error(text.length<240?text:`Export failed (${response.status})`);}
   const blob=await response.blob();
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   setState("success");setMessage("CSV export downloaded.");
  }catch(e){setState("error");setMessage(e instanceof Error&&e.name==="AbortError"?"Export timed out. Try a narrower date range.":e instanceof Error?e.message:"CSV export failed.");}
  timer.current=setTimeout(()=>{setState("idle");setMessage("")},4500);
 }
 return <>
  <button type="button" className="button" title="Export CSV" aria-label="Export CSV" disabled={state==="working"} onClick={download} style={{width:38,height:38,padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v4h14v-4"/></svg></button>
  {state!=="idle"?<div role="status" aria-live="polite" style={{position:"fixed",left:"50%",top:24,transform:"translateX(-50%)",zIndex:1000,minWidth:280,maxWidth:"min(520px,calc(100vw - 32px))",padding:"11px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,.16)",background:"#172033",boxShadow:"0 8px 28px rgba(0,0,0,.28)",fontSize:14,fontWeight:600,textAlign:"center",color:"#fff"}}>{state==="working"?<span style={{display:"inline-block",marginRight:9}}>⏳</span>:null}{message}</div>:null}
 </>;
}
