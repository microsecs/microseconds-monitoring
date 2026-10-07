import {NextRequest,NextResponse} from "next/server";
import {requireWritableOrganization,getSupabaseAdmin} from "@/lib/supabaseAdmin";

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const ids=Array.isArray(body?.ids)?Array.from(new Set(body.ids.map((x:any)=>String(x)).filter(Boolean))):[];
    if(!ids.length)return NextResponse.json({error:"No incidents selected."},{status:400});
    const org=await requireWritableOrganization();
    const db=getSupabaseAdmin();
    let updated=0;
    for(let i=0;i<ids.length;i+=40){
      const {data,error}=await db.from("security_incidents").update({
        status:"dismissed",resolution:"dismissed",resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq("organization_id",org.id).in("id",ids.slice(i,i+40)).select("id");
      if(error)throw error;
      updated+=data?.length||0;
    }
    return NextResponse.json({ok:true,updated});
  }catch(e:any){
    return NextResponse.json({error:e?.message||"Could not dismiss incidents."},{status:500});
  }
}
