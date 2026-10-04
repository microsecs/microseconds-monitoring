import { NextRequest,NextResponse } from "next/server";
import { getOrCreateDevOrganization,getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_INCIDENT_CRITERIA,getIncidentCriteria } from "@/lib/incidentCriteria";
export async function GET(){
 try{const org=await getOrCreateDevOrganization();return NextResponse.json({settings:await getIncidentCriteria(org.id),defaults:DEFAULT_INCIDENT_CRITERIA});}
 catch(e:any){return NextResponse.json({error:e?.message||"Could not load incident criteria."},{status:500});}
}
export async function PUT(req:NextRequest){
 try{
  const org=await getOrCreateDevOrganization(),b=await req.json(),v:any={};
  for(const k of Object.keys(DEFAULT_INCIDENT_CRITERIA)){
   const def=(DEFAULT_INCIDENT_CRITERIA as any)[k];
   if(typeof def==="boolean")v[k]=Boolean(b[k]);
   else{
    const n=Math.round(Number(b[k])); if(!Number.isFinite(n))throw new Error(`Invalid value for ${k}`);
    v[k]=n;
   }
  }
  if(v.incident_threshold<1||v.incident_threshold>100)throw new Error("Incident threshold must be 1-100.");
  if(v.baseline_days<1||v.baseline_days>3650)throw new Error("Baseline days must be 1-3650.");
  if(v.retention_days<30||v.retention_days>3650)throw new Error("Sign-in retention days must be 30-3650.");
  if(v.incident_retention_days<30||v.incident_retention_days>3650)throw new Error("Incident retention days must be 30-3650.");
  if(v.baseline_max_events<10||v.baseline_max_events>5000)throw new Error("Baseline max events must be 10-5000.");
  for(const k of Object.keys(v))if(k.endsWith("_points")&&(v[k]<0||v[k]>100))throw new Error("Point values must be 0-100.");
  const {data,error}=await getSupabaseAdmin().from("incident_criteria_settings")
   .upsert({organization_id:org.id,...v,updated_at:new Date().toISOString()},{onConflict:"organization_id"}).select("*").single();
  if(error)throw error;return NextResponse.json({settings:data});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not save incident criteria."},{status:400});}
}
