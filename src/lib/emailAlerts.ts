import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { appUrl } from "@/lib/appUrl";

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
 const s=String(sev||"review").toUpperCase();
 const bg=String(sev).toLowerCase()==="critical"?"#7f1d1d":String(sev).toLowerCase()==="suspicious"?"#92400e":"#374151";
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
 const apiKey=process.env.RESEND_API_KEY;
 const recipients=Array.from(new Set((params.recipients||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean)));
 const candidates=(params.candidates||[]).filter(x=>x?.incident?.id).sort((a,b)=>severityRank(a.incident?.severity)-severityRank(b.incident?.severity));
 if(!apiKey||!recipients.length||!candidates.length)return {sent:0,incidentsAlerted:0};
 const from=process.env.SECURITY_ALERT_FROM||"MicroSECONDS Monitoring <monitoring@microseconds.com>";
 let sent=0,incidentsAlerted=0;

 for(const recipient of recipients){
  const ids=candidates.map(x=>x.incident.id);
  const {data:already}=await db.from("incident_email_alert_log").select("incident_id").eq("organization_id",params.organizationId).eq("recipient",recipient).in("incident_id",ids);
  const done=new Set((already||[]).map((x:any)=>String(x.incident_id)));
  const pending=candidates.filter(x=>!done.has(String(x.incident.id)));
  if(!pending.length)continue;

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
      const loc=[si.city,si.region,si.country].filter(Boolean).join(", ")||"Unknown location";
      const reasons=Array.isArray(inc.reasons)?inc.reasons.slice(0,3).map((r:any)=>escapeHtml(r)).join(" · "):"Risk threshold exceeded";
      return `<div style="padding:14px 0;border-top:1px solid #273244"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong style="color:#f8fafc">${escapeHtml(user)}</strong>${badge(inc.severity)}</div><div style="color:#cbd5e1;font-size:13px;margin-top:6px">${escapeHtml(loc)} · ${escapeHtml(si.ip_address||"Unknown IP")} · Risk ${escapeHtml(inc.risk_score??"?")}/100</div><div style="color:#94a3b8;font-size:12px;margin-top:5px">${escapeHtml(utcTime(si.event_time))}</div><div style="color:#cbd5e1;font-size:12px;margin-top:7px">${reasons}</div></div>`;
    }).join("");
    return `<div style="margin-top:22px"><div style="font-size:15px;font-weight:700;color:#f8fafc">${escapeHtml(first.tenantName)} <span style="font-weight:400;color:#94a3b8">· ${platform}</span></div>${rows}</div>`;
  }).join("");
  const count=pending.length;
  const subject=`MicroSECONDS Monitoring: ${count} suspicious sign-in${count===1?"":"s"} detected`;
  const reviewUrl=`${appUrl()}/incidents`;
  const html=`<!doctype html><html><body style="margin:0;background:#0b1220;font-family:Arial,sans-serif;color:#e5e7eb"><div style="max-width:720px;margin:0 auto;padding:30px 18px"><div style="background:#111827;border:1px solid #263244;border-radius:14px;overflow:hidden"><div style="padding:24px 26px;border-bottom:1px solid #263244"><div style="font-size:13px;color:#60a5fa;font-weight:700;letter-spacing:.06em">MICROSECONDS MONITORING</div><h1 style="margin:8px 0 4px;font-size:24px;color:#fff">Security Alert</h1><div style="color:#cbd5e1">Automatic monitoring detected ${count} successful sign-in${count===1?"":"s"} requiring review.</div></div><div style="padding:22px 26px"><div style="display:flex;gap:12px;flex-wrap:wrap"><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fff">${count}</strong><div style="font-size:11px;color:#94a3b8">TOTAL</div></div><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fca5a5">${critical}</strong><div style="font-size:11px;color:#94a3b8">CRITICAL</div></div><div style="background:#0f172a;border:1px solid #273244;border-radius:10px;padding:10px 14px"><strong style="font-size:20px;color:#fcd34d">${suspicious}</strong><div style="font-size:11px;color:#94a3b8">SUSPICIOUS</div></div></div>${groups}<div style="margin-top:26px"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:9px">Review Incidents</a></div><p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-top:24px">Times in this email are shown in UTC. Sign in to MicroSECONDS Monitoring to review local-time event details, IP intelligence, risk factors, and investigation controls.</p></div></div><div style="text-align:center;color:#64748b;font-size:11px;padding:16px">MicroSECONDS Monitoring · Automated Security Alert</div></div></body></html>`;
  const key=`security-batch/${params.organizationId}/${pending.map(x=>x.incident.id).sort().join("-")}/${recipient}`.slice(0,250);
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({from,to:[recipient],subject,html})});
  if(!response.ok)continue;
  const data:any=await response.json();
  let logged=0;
  for(const x of pending){
   const {error}=await db.from("incident_email_alert_log").insert({organization_id:params.organizationId,incident_id:x.incident.id,recipient,provider_message_id:data?.id||null});
   if(!error)logged++;
  }
  if(logged){
   sent++;
   incidentsAlerted+=logged;
   await db.from("security_incidents").update({alerted_at:new Date().toISOString()}).in("id",pending.map(x=>x.incident.id));
  }
 }
 return {sent,incidentsAlerted};
}
