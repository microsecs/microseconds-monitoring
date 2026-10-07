import {NextRequest,NextResponse} from "next/server";
import {requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";
import {recordIncidentFeedback} from "@/lib/incidentFeedback";

const allowed=new Set(["marked_safe","dismissed","confirmed_suspicious"]);

export async function PATCH(req:NextRequest,context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;const body=await req.json();const resolution=String(body?.resolution||body?.status||"");
    if(!allowed.has(resolution)) return NextResponse.json({error:"Invalid incident resolution."},{status:400});
    const org=await requireWritableOrganization();const db=getSupabaseAdmin();
    const {data:incident,error:ie}=await db.from("security_incidents").select("*").eq("id",id).eq("organization_id",org.id).maybeSingle();
    if(ie)throw ie;if(!incident)return NextResponse.json({error:"Incident not found."},{status:404});

    // Only explicit Safe/Suspicious decisions teach the system. Dismiss is deliberately neutral.
    if(resolution==="marked_safe"||resolution==="confirmed_suspicious"){
      const {data:signin,error:se}=await db.from("signins").select("id,user_principal_name,ip_address,city,region,country").eq("id",incident.signin_id).eq("organization_id",org.id).maybeSingle();
      if(se)throw se;
      let intel:any=null;if(signin?.ip_address){const {data}=await db.from("ip_intelligence").select("*").eq("ip_address",signin.ip_address).maybeSingle();intel=data||null;}
      if(signin?.user_principal_name)await recordIncidentFeedback({organizationId:org.id,incident,signin,intel,feedbackType:resolution==="marked_safe"?"safe":"suspicious"});
    }
    const now=new Date().toISOString();
    const {data,error}=await db.from("security_incidents").update({status:"dismissed",resolution,resolved_at:now,updated_at:now})
      .eq("id",id).eq("organization_id",org.id).select("*").maybeSingle();
    if(error)throw error;if(!data)return NextResponse.json({error:"Incident not found."},{status:404});
    return NextResponse.json({ok:true,incident:data});
  } catch(e:any) {return NextResponse.json({error:e?.message||"Could not resolve incident."},{status:500});}
}
