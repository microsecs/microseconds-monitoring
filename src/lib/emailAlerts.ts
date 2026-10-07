import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { appUrl } from "@/lib/appUrl";
import { sendSmtpMail, smtpConfigured } from "@/lib/smtpMailer";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function severityRank(v:any){ return ({critical:0,high:1,suspicious:2,review:3}[String(v||"").toLowerCase()] ?? 9); }
function badge(sev:any){
 const level=String(sev||"").toLowerCase();
 if(level!=="critical" && level!=="suspicious") return "";
 const s=level.toUpperCase();
 const bg=level==="critical"?"#7f1d1d":"#92400e";
 return `<span style="display:inline-block;background:${bg};color:#fff;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;letter-spacing:.04em">${escapeHtml(s)}</span>`;
}
function utcTime(v:any){
 const d=new Date(String(v||""));
 return Number.isNaN(d.getTime())?String(v||"Unknown"):`${d.toLocaleString("en-US",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit"})} UTC`;
}

export type AlertCandidate={organizationId:string;incident:any;signin:any;tenantName:string;provider:"microsoft"|"google"|string};

/** Send at most one consolidated security-alert message to each configured recipient for this org/run. */
export async function sendConsolidatedIncidentAlert(params:{organizationId:string;recipients:string[];candidates:AlertCandidate[]}){
 const db=getSupabaseAdmin();
 const recipients=Array.from(new Set((params.recipients||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean)));
 const candidates=(params.candidates||[]).filter(x=>x?.incident?.id).sort((a,b)=>severityRank(a.incident?.severity)-severityRank(b.incident?.severity));
 if(!smtpConfigured()){ console.error(`[alerts] ${params.organizationId}: SMTP_PASSWORD is missing`); return {sent:0,incidentsAlerted:0,reason:"missing_smtp_password"}; }
 if(!recipients.length){ console.warn(`[alerts] ${params.organizationId}: no alert recipients configured`); return {sent:0,incidentsAlerted:0,reason:"no_recipients"}; }
 if(!candidates.length){ console.log(`[alerts] ${params.organizationId}: no eligible incidents`); return {sent:0,incidentsAlerted:0,reason:"no_candidates"}; }
 console.log(`[alerts] ${params.organizationId}: preparing ${candidates.length} incident(s) for ${recipients.length} recipient(s)`);
 const from=process.env.SECURITY_ALERT_FROM||"MicroSECONDS Monitoring <monitoring@microseconds.com>";
 let sent=0,incidentsAlerted=0;

 for(const recipient of recipients){
  const ids=candidates.map(x=>x.incident.id);
  const {data:already}=await db.from("incident_email_alert_log").select("incident_id").eq("organization_id",params.organizationId).eq("recipient",recipient).in("incident_id",ids);
  const done=new Set((already||[]).map((x:any)=>String(x.incident_id)));
  const pending=candidates.filter(x=>!done.has(String(x.incident.id)));
  if(!pending.length){ console.log(`[alerts] ${params.organizationId}: ${recipient} has no pending incidents`); continue; }

  const critical=pending.filter(x=>String(x.incident?.severity).toLowerCase()==="critical").length;
  const suspicious=pending.filter(x=>String(x.incident?.severity).toLowerCase()==="suspicious").length;
  const tenants=new Map<string,AlertCandidate[]>();
  for(const x of pending){const k=`${x.provider}|${x.tenantName}`;tenants.set(k,[...(tenants.get(k)||[]),x]);}
  const groups=Array.from(tenants.values()).map(items=>{
    const first=items[0];
    const platform=first.provider==="google"?"Google Workspace":"Microsoft 365";
    const rows=items.map(x=>{
      const si=x.signin||{},inc=x.incident||{};
      const user=si.user_display_name||si.user_principal_name||"Unknown user";
      const email=si.user_principal_name||"";
      const showEmail=email && String(email).toLowerCase()!==String(user).toLowerCase();
      const loc=[si.city,si.region,si.country].filter(Boolean).join(", ")||"Unknown location";
      const reasons=Array.isArray(inc.reasons)?inc.reasons.slice(0,3).map((r:any)=>escapeHtml(r)).join(" · "):"Risk threshold exceeded";
      const severityBadge=badge(inc.severity);
      return `<div style="padding:14px 0;border-top:1px solid #273244"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong style="color:#f8fafc">${escapeHtml(user)}</strong>${severityBadge}</div>${showEmail?`<div style="color:#94a3b8;font-size:12px;margin-top:4px">${escapeHtml(email)}</div>`:""}<div style="color:#cbd5e1;font-size:13px;margin-top:6px">${escapeHtml(loc)} · ${escapeHtml(si.ip_address||"Unknown IP")} · Risk ${escapeHtml(inc.risk_score??"?")}/100</div><div style="color:#94a3b8;font-size:12px;margin-top:5px">${escapeHtml(utcTime(si.event_time))}</div><div style="color:#fbbf24;font-size:12px;margin-top:7px">${reasons}</div></div>`;
    }).join("");
    return `<div style="margin-top:22px"><div style="font-size:15px;font-weight:700;color:#f8fafc">${escapeHtml(first.tenantName)} <span style="font-weight:400;color:#94a3b8">· ${platform}</span></div>${rows}</div>`;
  }).join("");
  const count=pending.length;
  const subject=`Security Alert: ${count} Incident${count===1?"":"s"}`;
  const reviewUrl=`${appUrl()}/incidents`;
  const html=`<!doctype html><html><body style="margin:0;background:#0b1220;font-family:Arial,sans-serif;color:#e5e7eb"><div style="max-width:720px;margin:0 auto;padding:30px 18px"><div style="background:#111827;border:1px solid #263244;border-radius:14px;overflow:hidden"><div style="padding:24px 26px;border-bottom:1px solid #263244"><div style="font-size:13px;color:#60a5fa;font-weight:700;letter-spacing:.06em">MICROSECONDS MONITORING</div><h1 style="margin:8px 0 4px;font-size:24px;color:#fff">Security Alert</h1><div style="color:#cbd5e1">Automatic monitoring detected ${count} successful sign-in${count===1?"":"s"} requiring review.</div></div><div style="padding:22px 26px"><div style="display:flex;gap:12px;flex-wrap:wrap"><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fff">${count}</strong><div style="font-size:11px;color:#94a3b8">TOTAL</div></div><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fca5a5">${critical}</strong><div style="font-size:11px;color:#94a3b8">CRITICAL</div></div><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fcd34d">${suspicious}</strong><div style="font-size:11px;color:#94a3b8">SUSPICIOUS</div></div></div>${groups}<div style="margin-top:26px"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:9px">Review Incidents</a></div><p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-top:24px">Times in this email are shown in UTC. Sign in to MicroSECONDS Monitoring to review local-time event details, IP intelligence, risk factors, and investigation controls.</p></div></div></div></body></html>`;
  console.log(`[alerts] ${params.organizationId}: sending ${pending.length} incident(s) to ${recipient} via SMTP`);
  let smtpResult:{messageId:string};
  try {
   smtpResult=await sendSmtpMail({from,to:recipient,subject,html});
  } catch(error) {
   console.error(`[alerts] ${params.organizationId}: SMTP send failed for ${recipient}: ${error instanceof Error?error.message:String(error)}`);
   continue;
  }
  console.log(`[alerts] ${params.organizationId}: SMTP accepted ${recipient}; message ${smtpResult.messageId}`);
  let logged=0;
  for(const x of pending){
   const {error}=await db.from("incident_email_alert_log").insert({organization_id:params.organizationId,incident_id:x.incident.id,recipient,provider_message_id:smtpResult.messageId||null});
   if(!error)logged++;
  }
  if(logged){
   sent++;
   incidentsAlerted+=logged;
   await db.from("security_incidents").update({alerted_at:new Date().toISOString()}).in("id",pending.map(x=>x.incident.id));
  }
 }
 console.log(`[alerts] ${params.organizationId}: completed; emailsSent=${sent}, incidentsAlerted=${incidentsAlerted}`);
 return {sent,incidentsAlerted};
}
