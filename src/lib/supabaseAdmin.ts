import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

function sleep(ms:number){ return new Promise(resolve=>setTimeout(resolve,ms)); }

export function isJwtIssuedAtFutureError(error: unknown){
  const message =
    error instanceof Error ? error.message :
    typeof error === "object" && error && "message" in error ? String((error as any).message) :
    String(error || "");
  return /jwt\s+issued\s+at\s+future/i.test(message);
}

export async function withSupabaseClockSkewRetry<T>(
  operation:()=>PromiseLike<T>,
  options:{attempts?:number;delayMs?:number}={}
):Promise<T>{
  const attempts=Math.max(1,options.attempts ?? 3);
  const delayMs=Math.max(100,options.delayMs ?? 900);
  let last:unknown;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await operation();}
    catch(error){
      last=error;
      if(!isJwtIssuedAtFutureError(error) || attempt===attempts) throw error;
      await sleep(delayMs*attempt);
    }
  }
  throw last;
}

export function getSupabaseAdmin(){
  if(adminClient) return adminClient;
  const url=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be configured.");
  adminClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return adminClient;
}

export async function getOrCreateDevOrganization(){
  // Kept under the legacy name so existing routes do not need a risky bulk rewrite.
  // It now resolves the authenticated user's organization instead of a shared dev organization.
  const { getSupabaseServer } = await import("@/lib/supabaseServer");
  const auth = await getSupabaseServer();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if(authError || !user) throw new Error("AUTH_REQUIRED");

  return withSupabaseClockSkewRetry(async()=>{
    const supabase=getSupabaseAdmin();
    const {data:membership,error:memberError}=await supabase
      .from("organization_members")
      .select("organization_id,role,organizations(id,slug,name,plan,subscription_status,trial_started_at,trial_ends_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_current_period_end,subscription_cancel_at_period_end,subscription_updated_at)")
      .eq("user_id",user.id)
      .limit(1)
      .maybeSingle();
    if(memberError) throw memberError;
    if(membership?.organizations){
      const org:any=Array.isArray(membership.organizations)?membership.organizations[0]:membership.organizations;
      if(org) return org;
    }

    const bootstrapEmail=(process.env.BOOTSTRAP_OWNER_EMAIL || "").trim().toLowerCase();
    if(bootstrapEmail && (user.email || "").toLowerCase()===bootstrapEmail){
      const slug=process.env.DEV_ORGANIZATION_SLUG || "microseconds-dev";
      const {data:existing,error:findError}=await supabase.from("organizations").select("id,slug,name,plan,subscription_status,trial_started_at,trial_ends_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_current_period_end,subscription_cancel_at_period_end,subscription_updated_at").eq("slug",slug).maybeSingle();
      if(findError) throw findError;
      if(existing){
        const {error:linkError}=await supabase.from("organization_members").upsert({organization_id:existing.id,user_id:user.id,role:"owner"},{onConflict:"organization_id,user_id"});
        if(linkError) throw linkError;
        return existing;
      }
    }

    const email=user.email || "User";
    const domain=email.includes("@")?email.split("@")[1]:"";
    const metadataName=String(user.user_metadata?.organization_name || user.user_metadata?.full_name || "").trim();
    const name=metadataName || (domain ? domain : "My Organization");
    const slug=`org-${user.id.slice(0,8)}-${Date.now().toString(36)}`;
    const {data:created,error:createError}=await supabase.from("organizations")
      .insert({slug,name,plan:"trial",subscription_status:"inactive"})
      .select("id,slug,name,plan,subscription_status,trial_started_at,trial_ends_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_current_period_end,subscription_cancel_at_period_end,subscription_updated_at").single();
    if(createError) throw createError;
    const {error:linkError}=await supabase.from("organization_members").insert({organization_id:created.id,user_id:user.id,role:"owner"});
    if(linkError) throw linkError;
    return created;
  });
}

export async function requireWritableOrganization(){
  const org:any=await getOrCreateDevOrganization();
  const { getSupabaseServer } = await import("@/lib/supabaseServer");
  const auth=await getSupabaseServer();
  const {data:{user}}=await auth.auth.getUser();
  const productAdmin=(process.env.PRODUCT_ADMIN_EMAIL || process.env.BOOTSTRAP_OWNER_EMAIL || "").trim().toLowerCase();
  if(productAdmin && (user?.email || "").toLowerCase()===productAdmin) return org;
  const {assertOrganizationWritable}=await import("@/lib/subscription");
  assertOrganizationWritable(org);
  return org;
}
