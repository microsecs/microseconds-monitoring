import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enforceDataRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getSupabaseAdmin();
    let cursor: string | undefined;
    let organizationsChecked = 0;
    let signinsDeleted = 0;
    let incidentsDeleted = 0;
    const failures: { organizationId: string; error: string }[] = [];
    while (true) {
      let query = db.from("organizations").select("id").order("id", { ascending: true }).limit(100);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) break;
      for (const org of data) {
        organizationsChecked++;
        try {
          const result = await enforceDataRetention(org.id);
          signinsDeleted += result.signinsDeleted;
          incidentsDeleted += result.incidentsDeleted;
        } catch (error) {
          failures.push({ organizationId: org.id, error: error instanceof Error ? error.message : String(error) });
          console.error("Retention cleanup failed", org.id, error);
        }
      }
      cursor = data[data.length - 1].id;
      if (data.length < 100) break;
    }
    console.info("Daily retention cleanup", { organizationsChecked, signinsDeleted, incidentsDeleted, failures: failures.length });
    return NextResponse.json({ ok: failures.length === 0, organizationsChecked, signinsDeleted, incidentsDeleted, failures }, { status: failures.length ? 207 : 200 });
  } catch (error) {
    console.error("Daily retention job failed", error);
    return NextResponse.json({ error: "Retention cleanup failed" }, { status: 500 });
  }
}
