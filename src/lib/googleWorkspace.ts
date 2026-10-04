import crypto from "crypto";
import { googleRedirectUriFromApp } from "@/lib/appUrl";

export const GOOGLE_REPORTS_SCOPE = "https://www.googleapis.com/auth/admin.reports.audit.readonly";
export const GOOGLE_DIRECTORY_USER_SCOPE = "https://www.googleapis.com/auth/admin.directory.user.readonly";
export const GOOGLE_SCOPES = `${GOOGLE_REPORTS_SCOPE} ${GOOGLE_DIRECTORY_USER_SCOPE}`;
function required(name:string){const v=process.env[name];if(!v)throw new Error(`Missing ${name}`);return v;}
export function googleRedirectUri(){return googleRedirectUriFromApp();}
export function googleAuthorizationUrl(state:string){
 const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 u.searchParams.set("client_id",required("GOOGLE_CLIENT_ID"));u.searchParams.set("redirect_uri",googleRedirectUri());
 u.searchParams.set("response_type","code");u.searchParams.set("scope",GOOGLE_SCOPES);u.searchParams.set("access_type","offline");
 u.searchParams.set("include_granted_scopes","true");u.searchParams.set("prompt","consent");u.searchParams.set("state",state);return u.toString();
}
export async function exchangeGoogleCode(code:string){
 const body=new URLSearchParams({code,client_id:required("GOOGLE_CLIENT_ID"),client_secret:required("GOOGLE_CLIENT_SECRET"),redirect_uri:googleRedirectUri(),grant_type:"authorization_code"});
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
 const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.error||"Google token exchange failed");return j;
}
function key(){const raw=required("GOOGLE_TOKEN_ENCRYPTION_KEY");return /^[0-9a-f]{64}$/i.test(raw)?Buffer.from(raw,"hex"):crypto.createHash("sha256").update(raw).digest();}
export function encryptGoogleSecret(value:string){const iv=crypto.randomBytes(12),c=crypto.createCipheriv("aes-256-gcm",key(),iv);const e=Buffer.concat([c.update(value,"utf8"),c.final()]),tag=c.getAuthTag();return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${e.toString("base64url")}`;}
export function decryptGoogleSecret(value:string){const [v,i,t,e]=value.split(".");if(v!=="v1"||!i||!t||!e)throw new Error("Invalid encrypted Google token");const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(i,"base64url"));d.setAuthTag(Buffer.from(t,"base64url"));return Buffer.concat([d.update(Buffer.from(e,"base64url")),d.final()]).toString("utf8");}
export async function refreshGoogleAccessToken(encrypted:string){
 const body=new URLSearchParams({client_id:required("GOOGLE_CLIENT_ID"),client_secret:required("GOOGLE_CLIENT_SECRET"),refresh_token:decryptGoogleSecret(encrypted),grant_type:"refresh_token"});
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
 const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.error||"Google token refresh failed");return j.access_token as string;
}
export async function googleLoginActivities(accessToken:string,startTime?:string){
 let pageToken:string|undefined;const all:any[]=[];
 do{
  const u=new URL("https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/login");
  u.searchParams.set("maxResults","1000");if(startTime)u.searchParams.set("startTime",startTime);if(pageToken)u.searchParams.set("pageToken",pageToken);
  const r=await fetch(u,{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"});const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||"Google Reports API request failed");
  all.push(...(j.items||[]));pageToken=j.nextPageToken;
 }while(pageToken && all.length<10000);
 return all;
}
export async function googleLoginSample(accessToken:string){return (await googleLoginActivities(accessToken)).slice(0,10);}


export type GoogleDirectoryUser = {
  primaryEmail: string;
  fullName: string | null;
};

export async function googleDirectoryUsers(accessToken: string): Promise<GoogleDirectoryUser[]> {
  let pageToken: string | undefined;
  const all: GoogleDirectoryUser[] = [];

  do {
    const u = new URL("https://admin.googleapis.com/admin/directory/v1/users");
    u.searchParams.set("customer", "my_customer");
    u.searchParams.set("maxResults", "500");
    u.searchParams.set("orderBy", "email");
    u.searchParams.set("projection", "basic");
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const r = await fetch(u, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const j = await r.json();

    if (!r.ok) {
      throw new Error(j?.error?.message || "Google Directory API request failed");
    }

    for (const user of j.users || []) {
      const email = String(user?.primaryEmail || "").trim().toLowerCase();
      if (!email) continue;
      const fullName =
        String(user?.name?.fullName || "").trim() ||
        [user?.name?.givenName, user?.name?.familyName].filter(Boolean).join(" ").trim() ||
        null;
      all.push({ primaryEmail: email, fullName });
    }

    pageToken = j.nextPageToken;
  } while (pageToken);

  return all;
}
