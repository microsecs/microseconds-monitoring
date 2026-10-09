"use client";
import { useState } from "react";
export default function TestSecurityEmail({defaultEmail}:{defaultEmail:string}){
 const [to,setTo]=useState(defaultEmail),[timeZone,setTimeZone]=useState("America/Los_Angeles"),[type,setType]=useState("multiple"),[sending,setSending]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 async function send(e:React.FormEvent){
  e.preventDefault();if(sending)return;
  setSending(true);setMessage("");setError(false);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
   const res=await fetch("/api/admin/test-security-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,type,timeZone}),signal:controller.signal});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||"Unable to send test email");
   setMessage(`Test notification sent to ${to}.`);
  }catch(e:any){setError(true);setMessage(e?.name==="AbortError"?"The request timed out. Check your inbox before retrying; the email may have been accepted.":e?.message||"Unable to send test email");}
  finally{clearTimeout(timeout);setSending(false);}
 }
 return <div className="section card"><div className="adminTableHeader"><div><h2>Test Security Notification</h2><div className="muted">Send a fictional sample using the same template and SMTP delivery as real alerts. No incidents or alert history are changed.</div></div></div>
 <form onSubmit={send} style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginTop:16}}>
 <label style={{display:"flex",flexDirection:"column",gap:5,flex:"1 1 240px"}}>Recipient email<input className="input" type="email" required value={to} onChange={e=>setTo(e.target.value)} placeholder="admin@example.com" /></label>
 <label style={{display:"flex",flexDirection:"column",gap:5,flex:"1 1 210px"}}>Sample type<select className="input" value={type} onChange={e=>setType(e.target.value)}><option value="multiple">Multiple incidents</option><option value="single">Single suspicious sign-in</option><option value="critical">Critical incident</option></select></label>
 <label style={{display:"flex",flexDirection:"column",gap:5,flex:"1 1 210px"}}>Email timezone<select className="input" value={timeZone} onChange={e=>setTimeZone(e.target.value)}><option value="America/Los_Angeles">Pacific</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Chicago">Central</option><option value="America/New_York">Eastern</option><option value="UTC">UTC</option><option value="Europe/London">London</option></select></label>
 <button type="submit" className="button primary" disabled={sending}>{sending?"Sending…":"Send Test Notification"}</button>
 </form>{message?<div style={{marginTop:12,color:error?"#ef4444":"inherit"}} role="status">{message}</div>:null}</div>
}
