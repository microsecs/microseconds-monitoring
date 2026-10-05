import { NextResponse } from "next/server";
import { getOrCreateDevOrganization } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";

export async function GET(){
  try{
    const org:any=await getOrCreateDevOrganization();
    const state=subscriptionState(org);
    return NextResponse.json({plan:org.plan||null,status:state.status,daysRemaining:state.daysRemaining,trialStartedAt:org.trial_started_at||null,trialEndsAt:org.trial_ends_at||null,stripeConfigured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET),hasBillingProfile:Boolean(org.stripe_customer_id),currentPeriodEnd:org.subscription_current_period_end||null,cancelAtPeriodEnd:Boolean(org.subscription_cancel_at_period_end)});
  }catch(e:any){return NextResponse.json({error:e?.message||"Could not load subscription."},{status:e?.message==="AUTH_REQUIRED"?401:500});}
}
