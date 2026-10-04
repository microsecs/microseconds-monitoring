import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDevOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ReorderItem = { platform: "microsoft" | "google"; id: string; sortOrder: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: ReorderItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: "Tenant order is required." }, { status: 400 });

    const org = await getOrCreateDevOrganization();
    const sb = getSupabaseAdmin();

    for (const item of items) {
      if (!item?.id || !Number.isInteger(item.sortOrder) || item.sortOrder < 0) continue;
      const table = item.platform === "google" ? "google_workspace_tenants" : "microsoft_tenants";
      const { error } = await sb.from(table).update({ sort_order: item.sortOrder }).eq("id", item.id).eq("organization_id", org.id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not save tenant order." }, { status: 500 });
  }
}
