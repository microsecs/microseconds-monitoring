import { NextResponse } from "next/server";
import crypto from "crypto";
import { googleAuthorizationUrl } from "@/lib/googleWorkspace";

import { requireWritableOrganization } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";

export async function GET() {
  try { await requireWritableOrganization(); } catch (e:any) { return NextResponse.json({error:e?.message||"Subscription required"},{status:402}); }
  const state = crypto.randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleAuthorizationUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
