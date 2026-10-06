import { NextResponse } from "next/server";
import { getOrCreateDevOrganization, getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";
import { appSubscriptionStatus, findMonitoringSubscriptionForCustomer } from "@/lib/stripeBilling";

function stripeSubscriptionUpdate(sub:any){
  return {
    stripe_subscription_id:sub?.id||null,
    stripe_price_id:sub?.items?.data?.[0]?.price?.id||process.env.STRIPE_PRICE_ID||null,
    subscription_status:appSubscriptionStatus(sub?.status),
    plan:"paid",
    subscription_current_period_end:sub?.current_period_end?new Date(sub.current_period_end*1000).toISOString():null,
    subscription_cancel_at_period_end:Boolean(sub?.cancel_at_period_end),
    subscription_updated_at:new Date().toISOString()
  };
}

export async function GET(){
  try{
    let org:any=await getOrCreateDevOrganization();

    // Self-heal a missed Stripe webhook. We only reconcile an organization that
    // already owns a Stripe customer ID, and only subscriptions containing the
    // configured MicroSECONDS Monitoring price are eligible.
    if(org.stripe_customer_id && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID){
      try{
        const sub=await findMonitoringSubscriptionForCustomer(org.stripe_customer_id);
        if(sub){
          const update=stripeSubscriptionUpdate(sub);
          const db=getSupabaseAdmin();
          const {error}=await db.from("organizations").update(update).eq("id",org.id).eq("stripe_customer_id",org.stripe_customer_id);
          if(error)throw error;
          org={...org,...update};
        }
      }catch(error){
        // A temporary Stripe/API failure must not prevent the Account page from
        // loading. Keep the last locally known billing state and let a later
        // request or webhook reconcile it.
        console.error("Stripe subscription reconciliation failed",error);
      }
    }

    const state=subscriptionState(org);
    return NextResponse.json({plan:org.plan||null,status:state.status,daysRemaining:state.daysRemaining,trialStartedAt:org.trial_started_at||null,trialEndsAt:org.trial_ends_at||null,stripeConfigured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET),hasBillingProfile:Boolean(org.stripe_customer_id),currentPeriodEnd:org.subscription_current_period_end||null,cancelAtPeriodEnd:Boolean(org.subscription_cancel_at_period_end)});
  }catch(e:any){return NextResponse.json({error:e?.message||"Could not load subscription."},{status:e?.message==="AUTH_REQUIRED"?401:500});}
}
