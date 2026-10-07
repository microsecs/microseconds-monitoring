import { NextRequest, NextResponse } from "next/server";
import { runAutomaticMonitoring } from "@/lib/automaticMonitoring";

export const maxDuration = 300;

async function runMonitor(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await runAutomaticMonitoring({sendAlerts:true}));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Automatic monitoring failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return runMonitor(req); }
export async function POST(req: NextRequest) { return runMonitor(req); }
