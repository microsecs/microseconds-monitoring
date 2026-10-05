import {NextRequest,NextResponse} from "next/server";
import {getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {appSubscriptionStatus,verifyStripeWebhook} from "@/lib/stripeBilling";

export async function POST(req:NextRequest){
 const raw=await req.text();
 try{verifyStripeWebhook(raw,req.headers.get("stripe-signature"));}catch(e:any){return NextResponse.json({error:e?.message||"Invalid signature"},{status:400});}
 try{
  const event=JSON.parse(raw); const obj=event?.data?.object||{}; const db=getSupabaseAdmin();
  if(event.type==="checkout.session.completed"&&obj.mode==="subscription"){
   const orgId=obj.metadata?.organization_id||obj.client_reference_id;
   if(orgId)await db.from("organizations").update({stripe_customer_id:typeof obj.customer==="string"?obj.customer:null,stripe_subscription_id:typeof obj.subscription==="string"?obj.subscription:null,stripe_price_id:process.env.STRIPE_PRICE_ID||null,subscription_updated_at:new Date().toISOString()}).eq("id",orgId);
  }
  if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
   const orgId=obj.metadata?.organization_id; const customerId=typeof obj.customer==="string"?obj.customer:null;
   const update:any={stripe_customer_id:customerId,stripe_subscription_id:obj.id||null,stripe_price_id:obj.items?.data?.[0]?.price?.id||process.env.STRIPE_PRICE_ID||null,subscription_status:event.type==="customer.subscription.deleted"?"canceled":appSubscriptionStatus(obj.status),plan:"paid",subscription_current_period_end:obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,subscription_cancel_at_period_end:Boolean(obj.cancel_at_period_end),subscription_updated_at:new Date().toISOString()};
   let q=db.from("organizations").update(update); if(orgId)q=q.eq("id",orgId); else if(customerId)q=q.eq("stripe_customer_id",customerId); else return NextResponse.json({received:true,ignored:true}); await q;
  }
  return NextResponse.json({received:true});
 }catch(e:any){return NextResponse.json({error:e?.message||"Webhook processing failed."},{status:500});}
}
