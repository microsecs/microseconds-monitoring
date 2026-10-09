import Link from "next/link";
import { requireProductAdmin } from "@/lib/productAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { subscriptionState } from "@/lib/subscription";
import RunMonitoringNow from "@/components/RunMonitoringNow";
import TestSecurityEmail from "@/components/TestSecurityEmail";
import { getProductAdminEmail } from "@/lib/productAdmin";

export const dynamic = "force-dynamic";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function statusClass(status?: string | null) {
  const s = String(status || "inactive").toLowerCase();
  if (["active", "trialing"].includes(s)) return "normal";
  if (["past_due", "paused"].includes(s)) return "review";
  return "critical";
}

export default async function ProductAdminPage() {
  await requireProductAdmin();
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [orgRes, memberRes, msRes, googleRes, monitoringRes, signinsRes, incidentsRes, aiUsageRes] = await Promise.all([
    db.from("organizations").select("*", { count: "exact" }).order("created_at", { ascending: false }),
    db.from("organization_members").select("organization_id,user_id,role"),
    db.from("microsoft_tenants").select("id,organization_id,tenant_name,tenant_id,last_sync_at"),
    db.from("google_workspace_tenants").select("id,organization_id,display_name,primary_domain,last_sync_at"),
    db.from("organization_notification_settings").select("organization_id,automatic_monitoring_enabled"),
    db.from("signins").select("organization_id,event_time", { count: "exact" }).gte("event_time", since),
    db.from("security_incidents").select("organization_id,created_at", { count: "exact" }).gte("created_at", since),
    db.from("ai_risk_usage").select("organization_id,input_tokens,output_tokens,estimated_cost_usd,created_at").gte("created_at", since),
  ]);

  const organizations: any[] = orgRes.data || [];
  const members: any[] = memberRes.data || [];
  const microsoft: any[] = msRes.data || [];
  const google: any[] = googleRes.data || [];
  const monitoring: any[] = monitoringRes.data || [];
  const signins: any[] = signinsRes.data || [];
  const incidents: any[] = incidentsRes.data || [];
  const aiUsage: any[] = aiUsageRes.data || [];

  const userIds = [...new Set(members.map(x => x.user_id).filter(Boolean))];
  const emailByUser = new Map<string,string>();
  if (userIds.length) {
    let page = 1;
    while (page <= 10) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users || []) if (userIds.includes(u.id)) emailByUser.set(u.id, u.email || "");
      if (!data?.users || data.users.length < 1000) break;
      page++;
    }
  }

  const rows = organizations.map(org => {
    const orgMembers = members.filter(x => x.organization_id === org.id);
    const owner = orgMembers.find(x => x.role === "owner") || orgMembers[0];
    const ms = microsoft.filter(x => x.organization_id === org.id);
    const gs = google.filter(x => x.organization_id === org.id);
    const orgSignins = signins.filter(x => x.organization_id === org.id);
    const orgIncidents = incidents.filter(x => x.organization_id === org.id);
    const orgAi = aiUsage.filter(x => x.organization_id === org.id);
    const mon = monitoring.find(x => x.organization_id === org.id);
    const syncDates = [...ms, ...gs].map(x => x.last_sync_at).filter(Boolean).sort().reverse();
    const sub=subscriptionState(org);
    return { org, sub, ownerEmail: owner ? emailByUser.get(owner.user_id) || "—" : "—", users: orgMembers.length, tenants: ms.length + gs.length, monitoring: mon?.automatic_monitoring_enabled === true, signins: orgSignins.length, incidents: orgIncidents.length, aiReviews:orgAi.length, aiCost:orgAi.reduce((n,x)=>n+Number(x.estimated_cost_usd||0),0), lastSync: syncDates[0] || null };
  });

  const connectedTenants = microsoft.length + google.length;
  const monitoringOrgs = new Set(monitoring.filter(x => x.automatic_monitoring_enabled === true).map(x => x.organization_id)).size;
  const activeStatuses = new Set(["active", "trialing"]);
  const activeCustomers = organizations.filter(x => activeStatuses.has(subscriptionState(x).status)).length;
  const aiInputTokens=aiUsage.reduce((n,x)=>n+Number(x.input_tokens||0),0);
  const aiOutputTokens=aiUsage.reduce((n,x)=>n+Number(x.output_tokens||0),0);
  const aiCost=aiUsage.reduce((n,x)=>n+Number(x.estimated_cost_usd||0),0);

  return <>
    <div className="topbar"><div><div className="title">Product Admin</div><div className="subtitle">MicroSECONDS Monitoring customer and usage overview</div></div></div>
    <div className="grid4 adminMetrics">
      <div className="card"><div className="label">Customer Organizations</div><div className="metric">{organizations.length}</div></div>
      <div className="card"><div className="label">Connected Tenants</div><div className="metric">{connectedTenants}</div><div className="adminMetricNote">{microsoft.length} Microsoft · {google.length} Google</div></div>
      <div className="card"><div className="label">Automatic Monitoring</div><div className="metric">{monitoringOrgs}</div><div className="adminMetricNote">organizations enabled</div></div>
      <div className="card"><div className="label">Active / Trialing</div><div className="metric">{activeCustomers}</div><div className="adminMetricNote">billing status</div></div>
    </div>
    <div className="grid4 adminMetrics adminMetricsSecond">
      <div className="card"><div className="label">Users</div><div className="metric">{members.length}</div></div>
      <div className="card"><div className="label">Sign-ins · 30 Days</div><div className="metric">{signins.length.toLocaleString()}</div></div>
      <div className="card"><div className="label">Incidents · 30 Days</div><div className="metric">{incidents.length.toLocaleString()}</div></div>
      <div className="card"><div className="label">Avg. Tenants / Customer</div><div className="metric">{organizations.length ? (connectedTenants / organizations.length).toFixed(1) : "0.0"}</div></div>
    </div>
    <div className="grid4 adminMetrics adminMetricsSecond">
      <div className="card"><div className="label">AI Reviews · 30 Days</div><div className="metric">{aiUsage.length.toLocaleString()}</div></div>
      <div className="card"><div className="label">AI Input Tokens · 30 Days</div><div className="metric">{aiInputTokens.toLocaleString()}</div></div>
      <div className="card"><div className="label">AI Output Tokens · 30 Days</div><div className="metric">{aiOutputTokens.toLocaleString()}</div></div>
      <div className="card"><div className="label">Est. AI Cost · 30 Days</div><div className="metric">${aiCost.toFixed(4)}</div></div>
    </div>
    <div className="section card"><div className="adminTableHeader"><div><h2>Behavioral Learning</h2><div className="muted">Review evidence-based shadow scoring without affecting customer alerts.</div></div><Link className="btn" href="/admin/behavioral-learning">View learning diagnostics</Link></div></div>
    <RunMonitoringNow />
    <TestSecurityEmail defaultEmail={getProductAdminEmail()} />
    <div className="section card">
      <div className="adminTableHeader"><div><h2>Customers</h2><div className="muted">Organizations, account ownership, monitoring and recent usage</div></div></div>
      {rows.length ? <div className="tableScroll"><table className="table adminCustomerTable"><thead><tr><th>Organization</th><th>Owner</th><th>Plan</th><th>Status</th><th>Trial Ends</th><th>Tenants</th><th>Users</th><th>Monitoring</th><th>30d Sign-ins</th><th>30d Incidents</th><th>AI Reviews</th><th>Est. AI Cost</th><th>Last Sync</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.org.id}><td><Link className="adminCustomerLink" href={`/admin/customers/${r.org.id}`}>{r.org.name || r.org.slug || "Organization"}</Link></td><td>{r.ownerEmail}</td><td>{r.org.plan || "—"}</td><td><span className={`pill ${statusClass(r.sub.status)}`}>{r.sub.status}</span></td><td>{r.org.trial_ends_at ? fmtDate(r.org.trial_ends_at) : "—"}</td><td>{r.tenants}</td><td>{r.users}</td><td><span className={`pill ${r.monitoring ? "normal" : "review"}`}>{r.monitoring ? "Enabled" : "Off"}</span></td><td>{r.signins.toLocaleString()}</td><td>{r.incidents.toLocaleString()}</td><td>{r.aiReviews.toLocaleString()}</td><td>${r.aiCost.toFixed(4)}</td><td>{fmtDate(r.lastSync)}</td></tr>)}
      </tbody></table></div> : <div className="empty">No customer organizations found.</div>}
    </div>
  </>;
}
