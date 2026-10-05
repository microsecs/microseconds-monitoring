"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AccountPage() {
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { sb.auth.getUser().then(({data}) => setEmail(data.user?.email || "")); }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password.length < 8) { setMessage("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setMessage("The passwords do not match."); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else { setMessage("Your password has been updated."); setPassword(""); setConfirm(""); }
    setBusy(false);
  }

  return <><div className="topbar"><div><div className="title">Account</div><div className="subtitle">Manage your MicroSECONDS Monitoring sign-in.</div></div></div><div className="accountGrid"><section className="card accountCard"><h2>Account Information</h2><div className="accountLabel">Signed in as</div><div className="accountEmail">{email || "Loading…"}</div><p className="muted accountHelp">This account controls access to your organization and connected tenants.</p></section><section className="card accountCard"><h2>Change Password</h2><form onSubmit={changePassword} className="accountForm"><label>New password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label><label>Confirm new password<input type="password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>{message&&<div className="authMessage darkMessage">{message}</div>}<button className="button primary" disabled={busy}>{busy?"Updating…":"Update Password"}</button></form></section></div></>;
}
