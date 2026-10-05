import {NextResponse} from "next/server";
import {getOrCreateDevOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {getSupabaseServer} from "@/lib/supabaseServer";
import {createCheckoutSession,createStripeCustomer} from "@/lib/stripeBilling";

export async function POST(){
 try{
  const auth=await getSupabaseServer(); const {data:{user}}=await auth.auth.getUser(); if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
  const org:any=await getOrCreateDevOrganization(); const db=getSupabaseAdmin();
  const {data:member}=await db.from("organization_members").select("role").eq("organization_id",org.id).eq("user_id",user.id).maybeSingle();
  if(member?.role!=="owner")return NextResponse.json({error:"Only the organization owner can manage billing."},{status:403});
  let customerId=org.stripe_customer_id as string|undefined;
  if(!customerId){const customer=await createStripeCustomer(user.email||"",org.id,org.name||"");customerId=customer.id;await db.from("organizations").update({stripe_customer_id:customerId,subscription_updated_at:new Date().toISOString()}).eq("id",org.id);}
  if(!customerId)throw new Error("Could not create Stripe customer.");
  const session=await createCheckoutSession({customerId,organizationId:org.id});
  return NextResponse.json({url:session.url});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not start checkout."},{status:500});}
}
