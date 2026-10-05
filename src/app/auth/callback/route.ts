import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export async function GET(request:Request){
 const url=new URL(request.url); const code=url.searchParams.get("code");
 if(code){const sb=await getSupabaseServer(); await sb.auth.exchangeCodeForSession(code);}
 return NextResponse.redirect(new URL("/tenants",url.origin));
}
