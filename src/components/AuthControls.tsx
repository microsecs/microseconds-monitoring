import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function AuthControls() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return <div className="authControls"><div className="accountIdentity"><span className="accountAvatar" aria-hidden="true">{(user.email || "A").charAt(0).toUpperCase()}</span><span className="authEmail">{user.email}</span></div><Link className="navAccount" href="/account">Account</Link><form action="/api/auth/logout" method="post"><button className="navLogout" type="submit">Sign Out</button></form></div>;
}
