import { NextResponse } from "next/server";
import { isCurrentUserProductAdmin } from "@/lib/productAdmin";
import { runQueuedMonitoring } from "@/lib/queuedMonitoring";

export const maxDuration = 300;

export async function POST() {
  try {
    if (!(await isCurrentUserProductAdmin()))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(await runQueuedMonitoring({sendAlerts:false}));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Automatic monitoring failed" }, { status: 500 });
  }
}
