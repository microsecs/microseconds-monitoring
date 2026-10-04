import {NextRequest,NextResponse} from "next/server";
import {getOrCreateDevOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";

const allowed=new Set(["open","investigating","safe","confirmed_suspicious","dismissed"]);

export async function PATCH(req:NextRequest,context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const body=await req.json();
    const status=String(body?.status||"");
    if(!allowed.has(status)) return NextResponse.json({error:"Invalid incident status."},{status:400});

    const org=await getOrCreateDevOrganization();
    const supabase=getSupabaseAdmin();
    const {data,error}=await supabase.from("security_incidents")
      .update({status,updated_at:new Date().toISOString()})
      .eq("id",id).eq("organization_id",org.id).select("*").maybeSingle();

    if(error) throw error;
    if(!data) return NextResponse.json({error:"Incident not found."},{status:404});
    return NextResponse.json({ok:true,incident:data});
  } catch(e:any) {
    return NextResponse.json({error:e?.message||"Could not update incident."},{status:500});
  }
}
