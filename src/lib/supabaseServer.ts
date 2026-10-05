import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer(){
  const cookieStore=await cookies();
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.");
  return createServerClient(url,key,{
    cookies:{
      getAll(){ return cookieStore.getAll(); },
      setAll(items){
        try{ for(const {name,value,options} of items) cookieStore.set(name,value,options); }
        catch{ /* Server Components cannot always write cookies; middleware/callback handles refresh. */ }
      }
    }
  });
}
