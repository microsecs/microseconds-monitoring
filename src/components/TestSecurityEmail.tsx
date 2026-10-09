"use client";
import { useState } from "react";
export default function TestSecurityEmail({defaultEmail}:{defaultEmail:string}){
 const [to,setTo]=useState(defaultEmail),[type,setType]=useState("multiple"),[sending,setSending]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(false);
 async function send(e:React.FormEvent){e.preventDefault();if(sending)return;setSending(true);setMessage("");try{
  const res=await fetch("/api/admin/test-security-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to,type})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to send test email");setError(false);setMessage(`Test notification sent to ${to}.`);
 }catch(e:any){setError(true);setMessage(e?.message||"Unable to send test email");}finally{setSending(false)}}
 return <div className="section card"><div className="adminTableHeader"><div><h2>Test Security Notification</h2><div className="muted">Send a fictional sample using the same template and SMTP delivery as real alerts. No incidents or alert history are changed.</div></div></div>
 <form onSubmit={send} style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginTop:16}}>
 <label style={{display:"flex",flexDirection:"column",gap:5,flex:"1 1 240px"}}>Recipient email<input className="input" type="email" required value={to} onChange={e=>setTo(e.target.value)} placeholder="admin@example.com" /></label>
 <label style={{display:"flex",flexDirection:"column",gap:5,flex:"1 1 210px"}}>Sample type<select className="input" value={type} onChange={e=>setType(e.target.value)}><option value="multiple">Multiple incidents</option><option value="single">Single suspicious sign-in</option><option value="critical">Critical incident</option></select></label>
 <button type="submit" className="button primary" disabled={sending}>{sending?"Sending…":"Send Test Notification"}</button>
 </form>{message?<div style={{marginTop:12,color:error?"#ef4444":"inherit"}} role="status">{message}</div>:null}</div>
}
