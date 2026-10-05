import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export async function POST(request:Request){const sb=await getSupabaseServer();await sb.auth.signOut();return NextResponse.redirect(new URL("/login",request.url),303);}
