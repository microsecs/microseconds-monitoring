import { NextResponse } from "next/server";
import { isCurrentUserProductAdmin } from "@/lib/productAdmin";
import { runAutomaticMonitoring } from "@/lib/automaticMonitoring";

export const maxDuration = 300;

export async function POST() {
  try {
    if (!(await isCurrentUserProductAdmin()))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(await runAutomaticMonitoring());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Automatic monitoring failed" }, { status: 500 });
  }
}
