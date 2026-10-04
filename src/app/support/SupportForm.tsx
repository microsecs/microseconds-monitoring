"use client";
import {useState} from "react";
export default function SupportForm(){
 const [status,setStatus]=useState(""); const [sending,setSending]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setSending(true);setStatus("");const form=e.currentTarget;const body=Object.fromEntries(new FormData(form).entries());try{const r=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Could not send support request.");setStatus("Support request sent.");form.reset();}catch(err:any){setStatus(err?.message||"Could not send support request.");}finally{setSending(false);}}
 const inputStyle={width:"100%",height:40,padding:"0 12px",fontSize:14,borderRadius:8};
 return <form onSubmit={submit} style={{display:"grid",gap:14}}>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label><div className="subtitle" style={{marginBottom:5}}>Name</div><input className="input" name="name" required style={inputStyle}/></label><label><div className="subtitle" style={{marginBottom:5}}>Email</div><input className="input" name="email" type="email" required style={inputStyle}/></label></div>
  <label><div className="subtitle" style={{marginBottom:5}}>Subject</div><input className="input" name="subject" required style={inputStyle}/></label>
  <label><div className="subtitle" style={{marginBottom:5}}>How can we help?</div><textarea className="input" name="message" required rows={7} style={{width:"100%",padding:12,fontSize:14,borderRadius:8,resize:"vertical"}}/></label>
  <div style={{display:"flex",alignItems:"center",gap:12}}><button className="button primary" type="submit" disabled={sending}>{sending?"Sending…":"Submit Support Request"}</button>{status?<span className="subtitle">{status}</span>:null}</div>
 </form>;
}
