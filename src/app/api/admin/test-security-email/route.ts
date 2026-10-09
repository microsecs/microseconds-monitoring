import { NextResponse } from "next/server";
import { isCurrentUserProductAdmin } from "@/lib/productAdmin";
import { renderSecurityAlertEmail, sampleAlertCandidates } from "@/lib/emailAlerts";
import { sendSmtpMail, smtpConfigured } from "@/lib/smtpMailer";

export const runtime="nodejs";
export async function POST(req:Request){
 if(!(await isCurrentUserProductAdmin()))return NextResponse.json({error:"Forbidden"},{status:403});
 try{
  const body=await req.json();
  const to=String(body?.to||"").trim();
  const type=String(body?.type||"multiple");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to.length>254)return NextResponse.json({error:"Enter a valid recipient email"},{status:400});
  if(!["single","multiple","critical"].includes(type))return NextResponse.json({error:"Invalid sample type"},{status:400});
  if(!smtpConfigured())return NextResponse.json({error:"SMTP is not configured"},{status:503});
  const candidates=sampleAlertCandidates(type as "single"|"multiple"|"critical");
  const html=renderSecurityAlertEmail(candidates,new Map(),true);
  const from=process.env.SECURITY_ALERT_FROM||"MicroSECONDS Monitoring <monitoring@microseconds.com>";
  await sendSmtpMail({from,to,subject:`[TEST] MicroSECONDS Security Notification — ${type}`,html});
  return NextResponse.json({ok:true});
 }catch(e:any){console.error("[admin] test email failed",e);return NextResponse.json({error:e?.message||"Could not send test email"},{status:500});}
}
