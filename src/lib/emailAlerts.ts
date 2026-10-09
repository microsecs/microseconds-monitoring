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
// Emails are rendered on the server, so the recipient's device timezone is unavailable.
// Use an explicitly configured display timezone (Pacific by default), with its abbreviation.
function alertTime(v:any, recipientTimeZone?:string){
 const d=new Date(String(v||""));
 if(Number.isNaN(d.getTime()))return String(v||"Unknown");
 const configured=recipientTimeZone||process.env.SECURITY_ALERT_TIME_ZONE||"America/Los_Angeles";
 let timeZone=configured;
 try { new Intl.DateTimeFormat("en-US",{timeZone}).format(d); } catch {timeZone="America/Los_Angeles";}
 return d.toLocaleString("en-US",{timeZone,year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
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
 const {data:notificationRow,error:zoneError}=await db.from("organization_notification_settings").select("recipient_time_zones").eq("organization_id",params.organizationId).maybeSingle();
 if(zoneError)console.warn("[alerts] Could not load recipient timezones:",zoneError.message);
 const recipientZones:Record<string,string>=notificationRow?.recipient_time_zones||{};
 const from=process.env.SECURITY_ALERT_FROM||"MicroSECONDS Monitoring <monitoring@microseconds.com>";
 let sent=0,incidentsAlerted=0;

 // Alert candidates can be built from sign-in rows fetched before IP enrichment finishes.
 // Resolve the latest cached public IP intelligence here so the email can show the same
 // location the risk engine already knows about instead of "Unknown location".
 const alertIps=Array.from(new Set(candidates.map(x=>String(x?.signin?.ip_address||"").trim()).filter(Boolean)));
 const alertIntel:any[]=[];
 for(let i=0;i<alertIps.length;i+=100){
  const {data}=await db.from("ip_intelligence").select("ip_address,city,region,country").in("ip_address",alertIps.slice(i,i+100));
  alertIntel.push(...(data||[]));
 }
 const alertIntelByIp=new Map(alertIntel.map((x:any)=>[String(x.ip_address),x]));

 for(const recipient of recipients){
  const ids=candidates.map(x=>x.incident.id);
  const {data:already}=await db.from("incident_email_alert_log").select("incident_id").eq("organization_id",params.organizationId).eq("recipient",recipient).in("incident_id",ids);
  const done=new Set((already||[]).map((x:any)=>String(x.incident_id)));
  const pending=candidates.filter(x=>!done.has(String(x.incident.id)));
  if(!pending.length){ console.log(`[alerts] ${params.organizationId}: ${recipient} has no pending incidents`); continue; }

  const html=renderSecurityAlertEmail(pending, alertIntelByIp, false, recipientZones[recipient]);
  const count=pending.length;
  const subject=`Security Alert: ${count} Incident${count===1?"":"s"}`;
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

/** One shared email template for scheduled alerts and Product Admin samples. */
export function renderSecurityAlertEmail(candidates:AlertCandidate[], intelByIp:Map<string,any>=new Map(), test=false, recipientTimeZone?:string){
 const critical=candidates.filter(x=>String(x.incident?.severity).toLowerCase()==="critical").length;
 const suspicious=candidates.filter(x=>["suspicious","high"].includes(String(x.incident?.severity).toLowerCase())).length;
 const review=candidates.length-critical-suspicious;
 const counts=`${candidates.length} total &nbsp;·&nbsp; ${critical} critical &nbsp;·&nbsp; ${suspicious} suspicious &nbsp;·&nbsp; ${review} low / review`;
 const groups=new Map<string,AlertCandidate[]>();
 for(const item of candidates){
  const key=`${item.provider}|${item.tenantName}`;
  groups.set(key,[...(groups.get(key)||[]),item]);
 }
 const line=(label:string,value:string)=>`<tr><td style="padding:3px 10px 3px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:3px 0;color:#172033;font-size:13px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</td></tr>`;
 const blocks=Array.from(groups.values()).map(items=>{
  const first=items[0];
  const platform=first.provider==="google"?"Google Workspace":"Microsoft 365";
  const events=items.map(item=>{
   const si=item.signin||{},inc=item.incident||{};
   const intel=intelByIp.get(String(si.ip_address||""))||{};
   const location=[si.city||intel.city,si.region||intel.region,si.country||intel.country].filter(Boolean).join(", ")||"Unavailable";
   const user=String(si.user_display_name||si.user_principal_name||"Unknown user");
   const email=String(si.user_principal_name||"");
   const reasons=Array.isArray(inc.reasons)&&inc.reasons.length?inc.reasons.slice(0,4).map(String).join("; "):"See incident details for risk factors";
   const severity=String(inc.severity||"review").toUpperCase();
   const color=severity==="CRITICAL"?"#b91c1c":severity==="SUSPICIOUS"||severity==="HIGH"?"#92400e":"#475569";
   return `<tr><td style="padding:16px 0;border-bottom:1px solid #e5e7eb">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:15px;font-weight:bold;color:#172033">${escapeHtml(user)}</td><td align="right" style="font-size:12px;font-weight:bold;color:${color}">${escapeHtml(severity)} · ${escapeHtml(inc.risk_score??"?")}/100</td></tr></table>
    ${email&&email.toLowerCase()!==user.toLowerCase()?`<div style="font-size:13px;color:#334155;margin-top:5px;word-break:break-word">${escapeHtml(email).replace("@","&#8288;@&#8288;")}</div>`:""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:9px;width:100%">
    ${line("Location",location)}${line("IP address",String(si.ip_address||"Unavailable"))}${line("Sign-in time",alertTime(si.event_time,recipientTimeZone))}${line("Risk factors",reasons)}
    </table></td></tr>`;
  }).join("");
  return `<tr><td style="padding:20px 24px 0"><div style="font-size:15px;font-weight:bold;color:#172033">${escapeHtml(first.tenantName||"Unknown tenant")}</div><div style="font-size:12px;color:#64748b;margin-top:3px">${escapeHtml(platform)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${events}</table></td></tr>`;
 }).join("");
 const url=escapeHtml(`${appUrl()}/incidents`);
 return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important} @media only screen and (max-width:600px){.outer{padding:12px!important}.content{padding:18px!important}}</style></head>
 <body style="margin:0;padding:0;background-color:#f1f5f9;color:#172033;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9"><tr><td class="outer" align="center" style="padding:26px 12px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #dce3eb">
 <tr><td class="content" style="padding:24px;border-bottom:1px solid #e5e7eb"><div style="font-size:14px;font-weight:bold;letter-spacing:.04em;color:#0f766e">MicroSECONDS Monitoring</div><h1 style="font-size:23px;line-height:1.25;color:#172033;margin:14px 0 8px">${test?"TEST — Security Notification":"Security Notification"}</h1><div style="font-size:14px;line-height:1.5;color:#475569">${test?"This is a sample notification. No real incidents were created.":"Automatic monitoring identified successful sign-ins requiring review."}</div><div style="font-size:12px;color:#64748b;margin-top:12px">${counts}</div></td></tr>
 ${blocks}
 <tr><td class="content" style="padding:24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:0"><a href="${url}" style="display:inline-block;color:#075985!important;font-size:16px;font-weight:bold;text-decoration:underline;text-underline-offset:3px;padding:10px 0">Review Incidents &rarr;</a></td></tr></table><p style="font-size:12px;line-height:1.5;color:#64748b;margin:20px 0 0">Sign-in times include their displayed timezone. Visit MicroSECONDS Monitoring for investigation details and browser-local history.${test?" This is a test message; its sample users and IPs are fictional.":""}</p></td></tr>
 <tr><td style="padding:16px 24px;background-color:#f8fafc;border-top:1px solid #e5e7eb;font-size:11px;color:#64748b">MicroSECONDS Monitoring · Automated security notification</td></tr>
 </table></td></tr></table></body></html>`;
}

export function sampleAlertCandidates(type:"single"|"multiple"|"critical"):AlertCandidate[]{
 const now=new Date().toISOString();
 const make=(id:string,user:string,tenant:string,score:number,severity:string,ip:string,provider:string):AlertCandidate=>({
  organizationId:"TEST-ONLY",tenantName:tenant,provider,
  incident:{id:`test-${id}`,risk_score:score,severity,reasons:severity==="critical"?["Unfamiliar country","Unrecognized network","Unusual sign-in pattern"]:["VPN detected","Unfamiliar IP address"]},
  signin:{user_display_name:user,user_principal_name:`${id}@example.com`,ip_address:ip,city:"Example City",region:"California",country:"US",event_time:now}
 });
 const one=make("alex","Alex Example","Example Microsoft Tenant",65,"suspicious","192.0.2.10","microsoft");
 if(type==="single")return [one];
 if(type==="critical")return [make("jordan","Jordan Example","Example Microsoft Tenant",92,"critical","198.51.100.25","microsoft")];
 return [one,make("taylor","Taylor Example","Example Google Tenant",30,"review","203.0.113.15","google")];
}
