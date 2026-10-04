import {NextResponse} from "next/server";
import {getIncidentQueuePage} from "@/lib/incidents";

export const dynamic="force-dynamic";

export async function GET(){
 try{
  // Use the exact same queue/filtering rules as the normal Incidents page so the
  // navigation badge always matches the number of active incidents a user can see.
  const result=await getIncidentQueuePage({page:1,pageSize:25,includeDismissed:false,includeFailed:false});
  return NextResponse.json({count:result.total||0},{headers:{"Cache-Control":"no-store"}});
 }catch(error:any){
  return NextResponse.json({error:error?.message||"Unable to count incidents"},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}
