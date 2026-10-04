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
  operation:()=>Promise<T>,
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
  return withSupabaseClockSkewRetry(async()=>{
    const supabase=getSupabaseAdmin();
    const slug=process.env.DEV_ORGANIZATION_SLUG || "microseconds-dev";
    const name=process.env.DEV_ORGANIZATION_NAME || "MicroSECONDS Computer Consulting";
    const {data:existing,error:findError}=await supabase.from("organizations").select("id,slug,name").eq("slug",slug).maybeSingle();
    if(findError) throw findError;
    if(existing) return existing;
    const {data,error}=await supabase.from("organizations").insert({slug,name,plan:"development",subscription_status:"development"}).select("id,slug,name").single();
    if(error) throw error;
    return data;
  });
}
