"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Notice = { kind: "success" | "error"; text: string } | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(null);
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setNotice({kind:"error",text:error.message}); setBusy(false); return; }
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      window.location.href = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/mfa" : "/tenants";
      return;
    }
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) setNotice({kind:"error",text:error.message});
    else if (data.session) window.location.href = "/tenants";
    else setNotice({kind:"success",text:"Check your email. If this address can be registered, we’ve sent a confirmation link. If you already have an account, use Sign In or Forgot Password."});
    setBusy(false);
  }

  return <div className="authPage"><div className="authCard"><div className="authCardBrand"><img src="/microseconds-logo.png" alt="MicroSECONDS" className="authLogo"/><div className="authProduct">MONITORING</div></div><div className="authDivider"/><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p>{mode === "login" ? "Sign in to manage your connected Microsoft 365 and Google Workspace tenants." : "Create your MicroSECONDS Monitoring account to get started."}</p><form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"}/></label>{mode === "login"&&<div className="authFormLinkRow"><Link href="/forgot-password">Forgot password?</Link></div>}{notice&&<div className={`authStatus authStatus-${notice.kind}`} role="status"><span className="authStatusDot"/>{notice.text}</div>}<button className="button primary authButton" disabled={busy}>{busy?"Please wait…":mode === "login"?"Sign In":"Create Account"}</button></form><div className="authSwitchRow"><span>{mode === "login"?"New to MicroSECONDS Monitoring?":"Already have an account?"}</span><button className="authSwitch" onClick={()=>{setMode(mode === "login"?"signup":"login");setNotice(null);}}>{mode === "login"?"Create account":"Sign in"}</button></div></div></div>;
}
