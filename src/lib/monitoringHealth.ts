import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrganizationNotificationSettings } from "@/lib/notificationSettings";

export type HealthProvider = "microsoft" | "google";

function table(provider: HealthProvider) {
  return provider === "google" ? "google_workspace_tenants" : "microsoft_tenants";
}
function platform(provider: HealthProvider) {
  return provider === "google" ? "Google Workspace" : "Microsoft 365";
}
function reconnectRequired(message: string) {
  const s = String(message || "").toLowerCase();
  return [
    "invalid_grant","unauthorized","invalid_client","invalid client","invalid token",
    "token has been expired or revoked","revoked","consent","aadsts65001","aadsts700016",
    "authentication failed","access denied","insufficient privileges","401","403"
  ].some(x => s.includes(x));
}
function esc(v: unknown) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export async function markMonitoringHealthy(provider: HealthProvider, tenantId: string) {
  const db=getSupabaseAdmin();
  await db.from(table(provider)).update({
    connection_status:"healthy", last_sync_error:null, last_sync_error_at:null, health_alert_sent_at:null
  }).eq("id",tenantId);
}

export async function recordMonitoringFailure(params:{
  provider:HealthProvider; organizationId:string; tenantId:string; tenantName:string;
  error:unknown; sendAlert:boolean;
}) {
  const db=getSupabaseAdmin();
  const message=params.error instanceof Error ? params.error.message : String(params.error || "Automatic monitoring failed");
  const status=reconnectRequired(message) ? "reconnect_required" : "problem";
  const {data:existing}=await db.from(table(params.provider))
    .select("health_alert_sent_at").eq("id",params.tenantId).maybeSingle();

  await db.from(table(params.provider)).update({
    connection_status:status,last_sync_error:message.slice(0,2000),last_sync_error_at:new Date().toISOString()
  }).eq("id",params.tenantId);

  // Manual Sync Now records health but never sends email. Automatic monitoring alerts only once
  // per outage; a later successful sync clears health_alert_sent_at so a future outage can alert again.
  if(!params.sendAlert || existing?.health_alert_sent_at) return {status,alerted:0};

  const settings=await getOrganizationNotificationSettings(params.organizationId);
  const recipients=Array.from(new Set((settings.alert_emails||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean)));
  if(!settings.enabled || !recipients.length || !process.env.RESEND_API_KEY) return {status,alerted:0};

  const from=process.env.SECURITY_ALERT_FROM || "MicroSECONDS Security <security@microseconds.com>";
  let sent=0;
  for(const recipient of recipients){
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        from,to:[recipient],
        subject:`Monitoring interrupted: ${params.tenantName}`,
        html:`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
          <h2>MicroSECONDS Security Monitoring Alert</h2>
          <p><strong>Tenant:</strong> ${esc(params.tenantName)}</p>
          <p><strong>Platform:</strong> ${esc(platform(params.provider))}</p>
          <p><strong>Status:</strong> ${status==="reconnect_required"?"Reconnection Required":"Connection Problem"}</p>
          <p>Automatic security monitoring could not synchronize this tenant.</p>
          <p><strong>Error:</strong> ${esc(message)}</p>
          <p>${params.provider==="google"
            ?"Open MicroSECONDS Security → Tenants → More… → Reconnect Google if the authorization has been revoked."
            :"Check the Microsoft tenant connection, application consent, permissions, licensing, and MicroSECONDS Security application credentials."}</p>
        </div>`
      })
    });
    if(response.ok) sent++;
  }
  if(sent>0) await db.from(table(params.provider)).update({health_alert_sent_at:new Date().toISOString()}).eq("id",params.tenantId);
  return {status,alerted:sent};
}
