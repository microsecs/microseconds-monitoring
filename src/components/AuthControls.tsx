import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function AuthControls() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return <div className="authControls"><Link className="navAccount" href="/account">Account</Link><form action="/api/auth/logout" method="post"><button className="navLogout" type="submit">Sign Out</button></form></div>;
}
