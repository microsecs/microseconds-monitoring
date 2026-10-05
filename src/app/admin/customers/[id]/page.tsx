import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProductAdmin } from "@/lib/productAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
function fmt(v?:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function pill(v?:string|null){const s=String(v||"inactive").toLowerCase();return ["active","trialing","connected"].includes(s)?"normal":["past_due","paused"].includes(s)?"review":"critical";}

export default async function CustomerDetail({params}:{params:Promise<{id:string}>}){
 await requireProductAdmin(); const {id}=await params; const db=getSupabaseAdmin();
 const since=new Date(Date.now()-30*86400000).toISOString();
 const [orgR,memR,msR,gR,monR,sR,iR]=await Promise.all([
  db.from("organizations").select("*").eq("id",id).maybeSingle(),
  db.from("organization_members").select("organization_id,user_id,role").eq("organization_id",id),
  db.from("microsoft_tenants").select("id,tenant_name,tenant_id,connected_at,last_sync_at,connection_status,automatic_monitoring_available").eq("organization_id",id),
  db.from("google_workspace_tenants").select("id,display_name,primary_domain,admin_email,created_at,last_sync_at,connection_status").eq("organization_id",id),
  db.from("organization_notification_settings").select("automatic_monitoring_enabled").eq("organization_id",id).maybeSingle(),
  db.from("signins").select("id",{count:"exact",head:true}).eq("organization_id",id).gte("event_time",since),
  db.from("security_incidents").select("id",{count:"exact",head:true}).eq("organization_id",id).gte("created_at",since)
 ]);
 if(orgR.error||!orgR.data)notFound(); const org:any=orgR.data; const members:any[]=memR.data||[];
 const emailById=new Map<string,string>(); if(members.length){let page=1;while(page<=10){const {data}=await db.auth.admin.listUsers({page,perPage:1000});for(const u of data?.users||[])if(members.some(m=>m.user_id===u.id))emailById.set(u.id,u.email||"");if(!data?.users||data.users.length<1000)break;page++;}}
 const ms:any[]=msR.data||[], gs:any[]=gR.data||[];
 return <>
  <div className="adminBack"><Link href="/admin">← Product Admin</Link></div>
  <div className="topbar"><div><div className="title">{org.name||org.slug||"Customer"}</div><div className="subtitle">Customer organization details and usage</div></div></div>
  <div className="grid4 adminMetrics">
   <div className="card"><div className="label">Plan</div><div className="adminValue">{org.plan||"—"}</div></div>
   <div className="card"><div className="label">Subscription</div><div className="adminValue"><span className={`pill ${pill(org.subscription_status)}`}>{org.subscription_status||"inactive"}</span></div></div>
   <div className="card"><div className="label">Automatic Monitoring</div><div className="adminValue"><span className={`pill ${monR.data?.automatic_monitoring_enabled?"normal":"review"}`}>{monR.data?.automatic_monitoring_enabled?"Enabled":"Off"}</span></div></div>
   <div className="card"><div className="label">Customer Since</div><div className="adminValue">{fmt(org.created_at)}</div></div>
  </div>
  <div className="grid4 adminMetrics adminMetricsSecond">
   <div className="card"><div className="label">Users</div><div className="metric">{members.length}</div></div>
   <div className="card"><div className="label">Connected Tenants</div><div className="metric">{ms.length+gs.length}</div></div>
   <div className="card"><div className="label">Sign-ins · 30 Days</div><div className="metric">{(sR.count||0).toLocaleString()}</div></div>
   <div className="card"><div className="label">Incidents · 30 Days</div><div className="metric">{(iR.count||0).toLocaleString()}</div></div>
  </div>
  <div className="adminDetailGrid">
   <div className="section card"><h2>Users</h2><table className="table"><thead><tr><th>Email</th><th>Role</th></tr></thead><tbody>{members.map(m=><tr key={m.user_id}><td>{emailById.get(m.user_id)||"—"}</td><td><span className="pill normal">{m.role}</span></td></tr>)}</tbody></table></div>
   <div className="section card"><h2>Billing Profile</h2><div className="adminInfoRows"><div><span>Plan</span><strong>{org.plan||"—"}</strong></div><div><span>Status</span><strong>{org.subscription_status||"inactive"}</strong></div><div><span>Trial ends</span><strong>{fmt(org.trial_ends_at)}</strong></div><div><span>Organization ID</span><strong className="adminMono">{org.id}</strong></div></div><div className="adminComingSoon">Stripe customer, renewal and revenue information will appear here after billing is connected.</div></div>
  </div>
  <div className="section card"><h2>Connected Tenants</h2><div className="tableScroll"><table className="table"><thead><tr><th>Platform</th><th>Tenant</th><th>Status</th><th>Automatic Capability</th><th>Last Sync</th></tr></thead><tbody>
   {ms.map(t=><tr key={`m-${t.id}`}><td>Microsoft 365</td><td>{t.tenant_name||t.tenant_id}</td><td><span className={`pill ${pill(t.connection_status||"connected")}`}>{t.connection_status||"Connected"}</span></td><td>{t.automatic_monitoring_available===true?"Available":"CSV / unavailable"}</td><td>{fmt(t.last_sync_at)}</td></tr>)}
   {gs.map(t=><tr key={`g-${t.id}`}><td>Google Workspace</td><td>{t.display_name||t.primary_domain||"Google Workspace"}</td><td><span className={`pill ${pill(t.connection_status||"connected")}`}>{t.connection_status||"Connected"}</span></td><td>Available</td><td>{fmt(t.last_sync_at)}</td></tr>)}
   {!ms.length&&!gs.length?<tr><td colSpan={5} className="empty">No connected tenants.</td></tr>:null}
  </tbody></table></div></div>
 </>;
}
