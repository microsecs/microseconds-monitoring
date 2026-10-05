import { NextResponse } from "next/server";
import { getOrCreateDevOrganization } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";

export async function GET(){
  try{
    const org:any=await getOrCreateDevOrganization();
    const state=subscriptionState(org);
    return NextResponse.json({plan:org.plan||null,status:state.status,daysRemaining:state.daysRemaining,trialStartedAt:org.trial_started_at||null,trialEndsAt:org.trial_ends_at||null});
  }catch(e:any){return NextResponse.json({error:e?.message||"Could not load subscription."},{status:e?.message==="AUTH_REQUIRED"?401:500});}
}
