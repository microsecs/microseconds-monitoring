"use client";
import {useEffect,useState} from "react";

export default function IpinfoDiagnostic(){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/ipinfo/diagnostic?ip=185.183.33.33",{cache:"no-store"})
  .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Diagnostic failed");return j;})
  .then(setData).catch(e=>setError(e.message));},[]);
 return <div className="card">
  <h1 style={{marginTop:0}}>IPinfo Diagnostic</h1>
  <div className="subtitle" style={{marginBottom:16}}>Test IP: 185.183.33.33. This page does not display the IPinfo token.</div>
  {error?<div className="errorBox">{error}</div>:!data?<div className="subtitle">Checking IPinfo…</div>:
   <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
     {["full_lookup","anonymous_lookup"].map(k=><div className="card" key={k}>
      <h2>{k==="full_lookup"?"Full Lookup":"Anonymous Detail Lookup"}</h2>
      <div className="subtitle">HTTP {data[k].status} · {data[k].ok?"Success":"Failed"}</div>
      <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify(data[k].classification,null,2)}</pre>
     </div>)}
    </div>
    <details style={{marginTop:16}}><summary style={{cursor:"pointer"}}>Show raw IPinfo responses</summary>
     <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify({full_lookup:data.full_lookup.raw,anonymous_lookup:data.anonymous_lookup.raw},null,2)}</pre>
    </details>
   </>}
 </div>;
}
