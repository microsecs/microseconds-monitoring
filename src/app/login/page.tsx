"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [mode,setMode]=useState<"login"|"signup">("login"); const [msg,setMsg]=useState(""); const [busy,setBusy]=useState(false);
 const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");
  if(mode==="login"){
   const {error}=await sb.auth.signInWithPassword({email,password}); if(error){setMsg(error.message);setBusy(false);return;} window.location.href="/tenants";
  }else{
   const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`}}); if(error)setMsg(error.message); else if(data.session) window.location.href="/tenants"; else setMsg("Check your email to confirm your account, then return here to sign in."); setBusy(false);
  }
 }
 return <div className="authPage"><div className="authCard"><img src="/microseconds-logo.png" alt="MicroSECONDS" className="authLogo"/><div className="authProduct">MONITORING</div><h1>{mode==="login"?"Sign in":"Create account"}</h1><p>{mode==="login"?"Sign in to your MicroSECONDS Monitoring account.":"Create your MicroSECONDS Monitoring account."}</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"}/></label>{msg&&<div className="authMessage">{msg}</div>}<button className="btn primary authButton" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign In":"Create Account"}</button></form><button className="authSwitch" onClick={()=>{setMode(mode==="login"?"signup":"login");setMsg("")}}>{mode==="login"?"Need an account? Create one":"Already have an account? Sign in"}</button></div></div>
}
