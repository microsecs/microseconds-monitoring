import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProductAdminEmail } from "@/lib/productAdmin";
import { subscriptionState } from "@/lib/subscription";

export default async function TrialStatusBanner(){
  const sb=await getSupabaseServer();
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return null;
  const adminEmail=getProductAdminEmail();
  if(adminEmail && (user.email||"").toLowerCase()===adminEmail)return null;
  const db=getSupabaseAdmin();
  const {data:membership}=await db.from("organization_members")
    .select("organizations(id,plan,subscription_status,trial_started_at,trial_ends_at)")
    .eq("user_id",user.id).limit(1).maybeSingle();
  const raw:any=membership?.organizations;
  const org:any=Array.isArray(raw)?raw[0]:raw;
  if(!org)return null;
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
