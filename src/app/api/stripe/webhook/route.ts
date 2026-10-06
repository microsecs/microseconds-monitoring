import {NextRequest,NextResponse} from "next/server";
import {getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {appSubscriptionStatus,retrieveStripeSubscription,verifyStripeWebhook} from "@/lib/stripeBilling";

function subscriptionUpdate(obj:any,eventType?:string){
 const customerId=typeof obj?.customer==="string"?obj.customer:null;
 return {
  stripe_customer_id:customerId,
  stripe_subscription_id:obj?.id||null,
  stripe_price_id:obj?.items?.data?.[0]?.price?.id||process.env.STRIPE_PRICE_ID||null,
  subscription_status:eventType==="customer.subscription.deleted"?"canceled":appSubscriptionStatus(obj?.status),
  plan:"paid",
  subscription_current_period_end:obj?.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,
  subscription_cancel_at_period_end:Boolean(obj?.cancel_at_period_end),
  subscription_updated_at:new Date().toISOString()
 };
}

async function applySubscription(db:any,obj:any,eventType?:string,fallbackOrgId?:string|null){
 const orgId=obj?.metadata?.organization_id||fallbackOrgId||null;
 const customerId=typeof obj?.customer==="string"?obj.customer:null;
 if(!orgId&&!customerId)return false;
 let q=db.from("organizations").update(subscriptionUpdate(obj,eventType));
 q=orgId?q.eq("id",orgId):q.eq("stripe_customer_id",customerId);
 const {error}=await q;
 if(error)throw error;
 return true;
}

export async function POST(req:NextRequest){
 const raw=await req.text();
 try{verifyStripeWebhook(raw,req.headers.get("stripe-signature"));}
 catch(e:any){return NextResponse.json({error:e?.message||"Invalid signature"},{status:400});}
 try{
  const event=JSON.parse(raw); const obj=event?.data?.object||{}; const db=getSupabaseAdmin();
  if(event.type==="checkout.session.completed"&&obj.mode==="subscription"){
   const orgId=obj.metadata?.organization_id||obj.client_reference_id||null;
   const customerId=typeof obj.customer==="string"?obj.customer:null;
   const subscriptionId=typeof obj.subscription==="string"?obj.subscription:null;
   if(orgId){
    const {error}=await db.from("organizations").update({stripe_customer_id:customerId,stripe_subscription_id:subscriptionId,stripe_price_id:process.env.STRIPE_PRICE_ID||null,subscription_updated_at:new Date().toISOString()}).eq("id",orgId);
    if(error)throw error;
   }
   // Reconcile immediately from Stripe. This makes Checkout robust even if
   // subscription.created arrives before/after this event or must be retried.
   if(subscriptionId){
    const subscription=await retrieveStripeSubscription(subscriptionId);
    await applySubscription(db,subscription,undefined,orgId);
   }
  }
  if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
   await applySubscription(db,obj,event.type,null);
  }
  return NextResponse.json({received:true});
 }catch(e:any){return NextResponse.json({error:e?.message||"Webhook processing failed."},{status:500});}
}
