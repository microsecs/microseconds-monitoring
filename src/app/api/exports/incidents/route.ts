import {NextRequest} from "next/server";
import {getIncidentQueuePage} from "@/lib/incidents";
import {csv,download} from "@/lib/csvExport";
export async function GET(req:NextRequest){try{
 const p=req.nextUrl.searchParams;const ids=p.get("ids")?.split(",").filter(Boolean)||[];
 if(ids.length>100)return Response.json({error:"Select at most 100 incidents."},{status:400});
 const rows:any[]=[];
 for(let page=1;page<=100;page++){
  const batch=await getIncidentQueuePage({page,pageSize:100,includeDismissed:ids.length?true:p.get("dismissed")==="1",search:ids.length?undefined:p.get("q")||undefined,range:ids.length?"all":p.get("range")||undefined,from:ids.length?undefined:p.get("from")||undefined,to:ids.length?undefined:p.get("to")||undefined});
  if(page===1&&batch.total>10000)return Response.json({error:"More than 10,000 incidents match. Narrow the date range."},{status:413});
  rows.push(...batch.rows.filter(r=>!ids.length||ids.includes(r.id)));if(page*100>=batch.total)break;
 }
 if(ids.length&&rows.length!==new Set(ids).size)return Response.json({error:"Some selected incidents were not found in your organization."},{status:404});
 return download(csv([["Incident Date (UTC)","Sign-in Date (UTC)","Tenant","User","IP Address","Location","Risk Score","Severity","Reasons","AI Assessment","Status","Resolution Date (UTC)"],...rows.map(r=>[r.created_at,r.signin?.event_time,r.tenant_name,r.signin?.user_principal_name,r.signin?.ip_address,[r.signin?.city,r.signin?.region,r.signin?.country].filter(Boolean).join(", "),r.risk_score,r.severity,Array.isArray(r.reasons)?r.reasons.join("; "):"",r.ai_summary||r.ai_classification,r.status,r.resolved_at])]),"microseconds-incidents.csv");
 }catch(e:any){return Response.json({error:e?.message||"Export failed"},{status:400});}}
