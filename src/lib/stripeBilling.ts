import crypto from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeConfigured(){
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);
}

function appendForm(params:URLSearchParams,key:string,value:any){
  if(value===undefined||value===null)return;
  if(Array.isArray(value)){value.forEach((v,i)=>appendForm(params,`${key}[${i}]`,v));return;}
  if(typeof value==="object"){Object.entries(value).forEach(([k,v])=>appendForm(params,key?`${key}[${k}]`:k,v));return;}
  params.append(key,String(value));
}

export async function stripePost(path:string,body:Record<string,any>){
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret)throw new Error("Stripe is not configured.");
  const form=new URLSearchParams();
  Object.entries(body).forEach(([k,v])=>appendForm(form,k,v));
  const res=await fetch(`${STRIPE_API}${path}`,{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data?.error?.message||`Stripe request failed (${res.status}).`);
  return data;
}

export async function stripeGet(path:string){
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret)throw new Error("Stripe is not configured.");
  const res=await fetch(`${STRIPE_API}${path}`,{headers:{Authorization:`Bearer ${secret}`},cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data?.error?.message||`Stripe request failed (${res.status}).`);
  return data;
}

export async function createStripeCustomer(email:string,organizationId:string,organizationName:string,accountName?:string){
  const genericDomains=new Set(["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","live.com","msn.com","proton.me","protonmail.com"]);
  const normalizedOrg=String(organizationName||"").trim();
  const normalizedAccount=String(accountName||"").trim();
  const customerName=normalizedOrg && !genericDomains.has(normalizedOrg.toLowerCase())
    ? normalizedOrg
    : normalizedAccount || (email ? email.split("@")[0] : "MicroSECONDS Monitoring Customer");
  return stripePost("/customers",{email,name:customerName,metadata:{organization_id:organizationId,organization_name:normalizedOrg||customerName,product:"MicroSECONDS Monitoring"}});
}

export async function retrieveStripeSubscription(subscriptionId:string){
  return stripeGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function createCheckoutSession(args:{customerId:string;organizationId:string}){
  const price=process.env.STRIPE_PRICE_ID;
  if(!price)throw new Error("STRIPE_PRICE_ID is not configured.");
  const app=(process.env.APP_URL||"http://localhost:3000").replace(/\/$/,"");
  return stripePost("/checkout/sessions",{mode:"subscription",customer:args.customerId,client_reference_id:args.organizationId,line_items:[{price,quantity:1}],success_url:`${app}/account?checkout=success#billing`,cancel_url:`${app}/account?checkout=cancelled#billing`,allow_promotion_codes:true,metadata:{organization_id:args.organizationId},subscription_data:{metadata:{organization_id:args.organizationId}}});
}

export async function createPortalSession(customerId:string){
  const app=(process.env.APP_URL||"http://localhost:3000").replace(/\/$/,"");
  return stripePost("/billing_portal/sessions",{customer:customerId,return_url:`${app}/account#billing`});
}

export function verifyStripeWebhook(rawBody:string,signatureHeader:string|null){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!signatureHeader)throw new Error("Stripe webhook signature is missing or not configured.");
  const parts=signatureHeader.split(",").map(x=>x.trim());
  const timestamp=parts.find(x=>x.startsWith("t="))?.slice(2);
  const signatures=parts.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
  if(!timestamp||!signatures.length)throw new Error("Invalid Stripe webhook signature.");
  if(Math.abs(Date.now()/1000-Number(timestamp))>300)throw new Error("Stripe webhook timestamp is outside the allowed tolerance.");
  const expected=crypto.createHmac("sha256",secret).update(`${timestamp}.${rawBody}`,"utf8").digest("hex");
  const expectedBuf=Buffer.from(expected,"hex");
  const valid=signatures.some(sig=>{try{const b=Buffer.from(sig,"hex");return b.length===expectedBuf.length&&crypto.timingSafeEqual(b,expectedBuf);}catch{return false;}});
  if(!valid)throw new Error("Invalid Stripe webhook signature.");
}

export function appSubscriptionStatus(stripeStatus?:string|null){
  const s=String(stripeStatus||"").toLowerCase();
  if(["active","trialing"].includes(s))return "active";
  if(["past_due","unpaid"].includes(s))return "past_due";
  if(s==="canceled")return "canceled";
  return "inactive";
}
