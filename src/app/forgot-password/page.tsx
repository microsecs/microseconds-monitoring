"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account`,
    });
    setMessage(error ? error.message : "If an account exists for this email address, we’ve sent a password reset link. Check your inbox and spam folder.");
    setBusy(false);
  }

  return <div className="authPage"><div className="authCard"><div className="authCardBrand"><img src="/microseconds-logo.png" alt="MicroSECONDS" className="authLogo"/><div className="authProduct">MONITORING</div></div><div className="authDivider"/><h1>Reset your password</h1><p>Enter the email address for your MicroSECONDS Monitoring account.</p><form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{message&&<div className="authMessage">{message}</div>}<button className="button primary authButton" disabled={busy}>{busy?"Sending…":"Send Reset Link"}</button></form><div className="authSwitchRow"><Link href="/login">← Back to sign in</Link></div></div></div>;
}
