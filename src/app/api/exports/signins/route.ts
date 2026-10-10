import {NextRequest} from "next/server";
import {getRecentHistoryPage} from "@/lib/history";
import {csv,download} from "@/lib/csvExport";
export async function GET(req:NextRequest){try{
 const p=req.nextUrl.searchParams;const tenant=p.get("tenant")||"";const rows:any[]=[];
 for(let page=1;page<=100;page++){
  const batch=await getRecentHistoryPage({page,pageSize:100,microsoftTenantId:tenant&&!tenant.startsWith("google:")?tenant:undefined,googleTenantId:tenant.startsWith("google:")?tenant.slice(7):undefined,platform:p.get("platform")||undefined,includeUnsuccessful:p.get("unsuccessful")==="1",search:p.get("q")||undefined,range:p.get("range")||undefined,from:p.get("from")||undefined,to:p.get("to")||undefined});
  if(page===1&&batch.total>10000)return Response.json({error:"More than 10,000 records match. Narrow the date range before exporting."},{status:413});
  rows.push(...batch.rows);if(rows.length>=batch.total)break;
 }
 return download(csv([["Date/Time (UTC)","Tenant","User","Status","IP Address","Location","Provider","VPN/Privacy","Application","Risk Score","Risk Indicators","AI Classification"],...rows.map(r=>[r.event_time,r.tenant_name,r.user_principal_name,r.status,r.ip_address,[r.city||r.intel_city,r.region||r.intel_region,r.country||r.intel_country].filter(Boolean).join(", "),r.intel_provider,r.intel_vpn?"Yes":r.intel_privacy_available?"No":"Unknown",r.app_name,r.risk_score,Array.isArray(r.reasons)?r.reasons.join("; "):"",r.ai_classification])]),"microseconds-signins.csv");
 }catch(e:any){return Response.json({error:e?.message||"Export failed"},{status:400});}}
