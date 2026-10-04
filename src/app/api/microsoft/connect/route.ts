import { NextResponse } from "next/server";
import crypto from "crypto";
import { microsoftRedirectUri } from "@/lib/appUrl";

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = microsoftRedirectUri();

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Microsoft app registration is not configured.",
        required: ["MICROSOFT_CLIENT_ID"],
      },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = NextResponse.redirect(
    `https://login.microsoftonline.com/organizations/v2.0/adminconsent?${params.toString()}`
  );

  response.cookies.set("ms_admin_consent_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
