import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type SyncProvider = "microsoft" | "google";
const LOCK_MINUTES = 15;

export async function acquireTenantSyncLock(provider: SyncProvider, tenantId: string, organizationId: string) {
  const db = getSupabaseAdmin();
  const now = new Date();
  // Clear only expired locks. The unique PK makes competing inserts atomic across Vercel instances.
  await db.from("tenant_sync_locks").delete().eq("provider", provider).eq("tenant_id", tenantId).lt("expires_at", now.toISOString());
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  const { error } = await db.from("tenant_sync_locks").insert({
    provider, tenant_id: tenantId, organization_id: organizationId, lock_token: token, expires_at: expiresAt,
  });
  if (error) {
    if (String((error as any).code || "") === "23505" || /duplicate key|unique/i.test(error.message || "")) return null;
    throw error;
  }
  return token;
}

export async function releaseTenantSyncLock(provider: SyncProvider, tenantId: string, token: string) {
  const db = getSupabaseAdmin();
  await db.from("tenant_sync_locks").delete().eq("provider", provider).eq("tenant_id", tenantId).eq("lock_token", token);
}
