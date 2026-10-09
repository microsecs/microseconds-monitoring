import {NextRequest,NextResponse} from "next/server";
import {requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {recordIncidentFeedback} from "@/lib/incidentFeedback";

const allowed=new Set(["marked_safe","dismissed","confirmed_suspicious"]);
export async function POST(req:NextRequest){
 try{
  const body=await req.json();const resolution=String(body?.resolution||"");
  if(!allowed.has(resolution))return NextResponse.json({error:"Invalid resolution."},{status:400});
  const ids=Array.isArray(body?.ids)?Array.from(new Set(body.ids.filter((x:unknown)=>typeof x==="string"&&x.length>0)) as Set<string>):[];
  if(!ids.length||ids.length>100)return NextResponse.json({error:"Select 1–100 incidents on the current page."},{status:400});
  const org=await requireWritableOrganization();const db=getSupabaseAdmin();
  const {data:incidents,error:ie}=await db.from("security_incidents").select("*").eq("organization_id",org.id).in("id",ids).neq("status","dismissed");
  if(ie)throw ie;
  let updated=0;const errors:string[]=[];
  for(const incident of incidents||[]){
   try{
    if(resolution!=="dismissed"){
     const {data:signin,error:se}=await db.from("signins").select("id,user_principal_name,ip_address,city,region,country").eq("id",incident.signin_id).eq("organization_id",org.id).maybeSingle();
     if(se)throw se;
     let intel:any=null;
     if(signin?.ip_address){const {data}=await db.from("ip_intelligence").select("*").eq("ip_address",signin.ip_address).maybeSingle();intel=data||null;}
     if(signin?.user_principal_name)await recordIncidentFeedback({organizationId:org.id,incident,signin,intel,feedbackType:resolution==="marked_safe"?"safe":"suspicious"});
    }
    const now=new Date().toISOString();
    const {data,error}=await db.from("security_incidents").update({status:"dismissed",resolution,resolved_at:now,updated_at:now}).eq("id",incident.id).eq("organization_id",org.id).neq("status","dismissed").select("id").maybeSingle();
    if(error)throw error;if(data)updated++;
   }catch(e:any){errors.push(`${incident.id}: ${e?.message||"Update failed"}`);}
  }
  if(errors.length)return NextResponse.json({ok:false,error:`Updated ${updated} of ${incidents?.length||0}. ${errors.length} failed: ${errors.slice(0,3).join("; ")}`,updated},{status:207});
  return NextResponse.json({ok:true,updated});
 }catch(e:any){return NextResponse.json({error:e?.message||"Could not update incidents."},{status:500});}
}
