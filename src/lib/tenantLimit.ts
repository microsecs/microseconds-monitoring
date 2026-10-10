import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const MAX_TENANTS_PER_ORGANIZATION = 50;

export async function getTenantUsage(organizationId: string) {
  const db = getSupabaseAdmin();
  const [microsoft, google] = await Promise.all([
    db.from("microsoft_tenants").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    db.from("google_workspace_tenants").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);
  if (microsoft.error) throw microsoft.error;
  if (google.error) throw google.error;
  const count = (microsoft.count ?? 0) + (google.count ?? 0);
  return { count, limit: MAX_TENANTS_PER_ORGANIZATION, remaining: Math.max(0, MAX_TENANTS_PER_ORGANIZATION - count) };
}

export async function assertTenantCapacity(organizationId: string) {
  const usage = await getTenantUsage(organizationId);
  if (usage.count >= usage.limit) throw new Error(`Tenant limit reached (${usage.limit}). Delete an existing tenant before adding another.`);
  return usage;
}
