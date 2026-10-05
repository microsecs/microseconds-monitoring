import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES=["/login","/auth/callback","/api/cron/","/api/microsoft/callback","/api/google/callback"];
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return response;
 const sb=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll()},setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await sb.auth.getUser(); const path=request.nextUrl.pathname;
 const isPublic=PUBLIC_PREFIXES.some(p=>path===p||path.startsWith(p));
 if(!user&&!isPublic){const login=request.nextUrl.clone();login.pathname="/login";login.searchParams.set("next",path);return NextResponse.redirect(login);}
 if(user&&path==="/login"){const dest=request.nextUrl.clone();dest.pathname="/tenants";dest.search="";return NextResponse.redirect(dest);}
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|icon.png|microseconds-logo.png).*)"]};
