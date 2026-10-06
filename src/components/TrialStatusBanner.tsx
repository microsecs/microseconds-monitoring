import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProductAdminEmail } from "@/lib/productAdmin";
import { subscriptionState } from "@/lib/subscription";
import { appSubscriptionStatus, findMonitoringSubscriptionForCustomer } from "@/lib/stripeBilling";

export default async function TrialStatusBanner(){
  const sb=await getSupabaseServer();
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return null;
  const adminEmail=getProductAdminEmail();
  if(adminEmail && (user.email||"").toLowerCase()===adminEmail)return null;
  const db=getSupabaseAdmin();
  const {data:membership}=await db.from("organization_members")
    .select("organizations(id,plan,subscription_status,trial_started_at,trial_ends_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_current_period_end,subscription_cancel_at_period_end,subscription_updated_at)")
    .eq("user_id",user.id).limit(1).maybeSingle();
  const raw:any=membership?.organizations;
  let org:any=Array.isArray(raw)?raw[0]:raw;
  if(!org)return null;

  // Keep the global banner in sync with Stripe too. The Account page already
  // self-heals missed webhooks; without doing the same here, the layout can
  // continue rendering an old expired-trial snapshot until another request
  // happens to refresh it. A paid Stripe subscription always wins over the
  // historical trial end date.
  if(org.stripe_customer_id && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID){
    try{
      const sub=await findMonitoringSubscriptionForCustomer(org.stripe_customer_id);
      if(sub){
        const update={
          stripe_subscription_id:sub?.id||null,
          stripe_price_id:sub?.items?.data?.[0]?.price?.id||process.env.STRIPE_PRICE_ID||null,
          subscription_status:appSubscriptionStatus(sub?.status),
          plan:"paid",
          subscription_current_period_end:sub?.current_period_end?new Date(sub.current_period_end*1000).toISOString():null,
          subscription_cancel_at_period_end:Boolean(sub?.cancel_at_period_end),
          subscription_updated_at:new Date().toISOString()
        };
        const {error}=await db.from("organizations").update(update).eq("id",org.id).eq("stripe_customer_id",org.stripe_customer_id);
        if(!error)org={...org,...update};
      }
    }catch(error){
      console.error("Stripe banner reconciliation failed",error);
    }
  }

  const state=subscriptionState(org);
  if(state.status==="active")return null;
  if(state.status==="trialing"){
    const urgent=state.daysRemaining<=3;
    return <div className={`trialBanner ${urgent?"trialBannerUrgent":""}`}>
      <div><strong>30-Day Trial</strong><span>{state.daysRemaining} day{state.daysRemaining===1?"":"s"} remaining</span></div>
      <Link href="/account#billing" className="trialBannerAction">Subscribe</Link>
    </div>;
  }
  if(state.status==="past_due")return <div className="trialBanner trialBannerUrgent"><div><strong>Billing attention needed</strong><span>Your monitoring remains available during the billing grace period.</span></div><Link href="/account#billing" className="trialBannerAction">Billing</Link></div>;
  return <div className="trialBanner trialBannerExpired"><div><strong>Trial expired</strong><span>Your data is preserved, but monitoring and account changes are paused until you subscribe.</span></div><Link href="/account#billing" className="trialBannerAction">Subscribe</Link></div>;
}
