import { NextRequest, NextResponse } from "next/server";
import { runQueuedMonitoring } from "@/lib/queuedMonitoring";

export const maxDuration = 300;

async function runMonitor(req:NextRequest){
  try {
    const secret=process.env.CRON_SECRET;
    if(!secret || req.headers.get("authorization")!==`Bearer ${secret}`)
      return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json(await runQueuedMonitoring({sendAlerts:true}));
  }catch(e:any){
    console.error("[queue] cron failed",e);
    return NextResponse.json({error:e?.message||"Queued monitoring failed"},{status:500});
  }
}
export async function GET(req:NextRequest){return runMonitor(req);}
export async function POST(req:NextRequest){return runMonitor(req);}
