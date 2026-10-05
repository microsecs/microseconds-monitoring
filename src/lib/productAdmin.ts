import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";

export function getProductAdminEmail() {
  return (process.env.PRODUCT_ADMIN_EMAIL || process.env.BOOTSTRAP_OWNER_EMAIL || "").trim().toLowerCase();
}

export async function isCurrentUserProductAdmin() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return false;
  const adminEmail = getProductAdminEmail();
  return Boolean(adminEmail && user.email.toLowerCase() === adminEmail);
}

export async function requireProductAdmin() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const adminEmail = getProductAdminEmail();
  if (!adminEmail || (user.email || "").toLowerCase() !== adminEmail) redirect("/tenants");
  return user;
}
