import ExportCsvButton from "@/components/ExportCsvButton";
import HistoryDateFilter from "@/components/HistoryDateFilter";
import { getRecentHistoryPage, getTenants, getGoogleTenants } from "@/lib/history";
import TenantSignInFilter from "./TenantSignInFilter";
import LocalDateTime from "@/components/LocalDateTime";

export const dynamic = "force-dynamic";

function cleanRiskReasons(input:any[] = []) {
  const out:string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    let text = String(raw || "").trim();
    if (!text) continue;
    let key = text.toLowerCase().replace(/[.;]+$/g, "").trim();
    // Older CSV imports stored this informational message as a risk reason.
    // It must not make an otherwise normal sign-in look suspicious.
    if (key === "no suspicious indicators found in available data" || key === "no risk indicators detected") continue;
    if (key === "hosting/datacenter network" || key === "hosting/datacenter network detected") {
      key = "hosting/datacenter network";
      text = "Hosting/datacenter network detected";
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function privacyLabel(r: any) {
  if (r.intel_tor) return "Yes";
  if (r.intel_vpn)
    return r.intel_privacy_service
      ? `Yes — ${r.intel_privacy_service}`
      : "Yes";
  if (r.intel_proxy) return r.intel_privacy_service ? `Yes — ${r.intel_privacy_service}` : "Yes";
  if (r.intel_relay) return "Yes";
  if (r.intel_anonymous === true) return "Yes";
  if (r.intel_privacy_available === true) return "No";
  return "Unknown";
}

function locationLabel(r: any) {
  return [
    r.city || r.intel_city,
    r.region || r.intel_region,
    r.country || r.intel_country,
  ]
    .filter(Boolean)
    .join(", ") || "—";
}

export default async function SigninsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenant?: string; googleTenant?: string; platform?: string; unsuccessful?: string; page?: string; q?: string; range?:string;from?:string;to?:string }>;
}) {
  const params = (await searchParams) || {};
  const rangeQuery={...(params.range?{range:params.range}:{}),...(params.from?{from:params.from}:{}),...(params.to?{to:params.to}:{})};
  const rawTenant = params.tenant || "";
  const selectedGoogleTenant = params.googleTenant || (rawTenant.startsWith("google:") ? rawTenant.slice(7) : "");
  const selectedTenant = rawTenant.startsWith("google:") ? "" : rawTenant;
  const selectedPlatform = params.platform || "";
  const showUnsuccessful = params.unsuccessful === "1";
  const search = (params.q || "").trim();
  const page = Math.max(1, Number(params.page || "1") || 1);
  const pageSize = 100;
  let total = 0;

  let rows: any[] = [];
  let tenants: any[] = [];
  let googleTenants: any[] = [];
  let error = "";

  try {
    const [history, ms, gs] = await Promise.all([
      getRecentHistoryPage({
        page,pageSize,
        microsoftTenantId:selectedTenant || undefined,
        googleTenantId:selectedGoogleTenant || undefined,
        platform:selectedPlatform || undefined,
        includeUnsuccessful:showUnsuccessful,
        search:search || undefined,range:params.range,from:params.from,to:params.to
      }),
      getTenants(),
      getGoogleTenants(),
    ]);
    rows=history.rows; total=history.total; tenants=ms; googleTenants=gs;
  } catch (e: any) {
    error = e?.message || "Could not load sign-ins.";
  }

  const visibleRows = rows;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const first=total?((page-1)*pageSize)+1:0;
  const last=Math.min(page*pageSize,total);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="title">Sign-in History</div>
          <div className="subtitle">
            Microsoft 365, Google Workspace and CSV sign-ins
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent:"flex-end", flexWrap: "wrap", marginLeft:"auto", maxWidth:"calc(100% - 260px)" }}>
          <div style={{display:"flex",gap:6,alignItems:"center",paddingRight:12,borderRight:"1px solid var(--line)"}}>
          <form method="get" style={{display:"flex",gap:6,alignItems:"center"}}>
            {Object.entries(rangeQuery).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
            {selectedGoogleTenant ? <input type="hidden" name="tenant" value={`google:${selectedGoogleTenant}`} /> : selectedTenant ? <input type="hidden" name="tenant" value={selectedTenant} /> : null}
            {selectedPlatform ? <input type="hidden" name="platform" value={selectedPlatform} /> : null}
            {showUnsuccessful ? <input type="hidden" name="unsuccessful" value="1" /> : null}
            <input className="input" type="search" name="q" defaultValue={search} placeholder="Search sign-ins…" aria-label="Search sign-ins" style={{width:220,height:38,padding:"0 12px",fontSize:14,borderRadius:8}} />
            <button className="button" type="submit" title="Search" aria-label="Search" style={{width:38,height:38,padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>
            {search ? <a className="button deleteAction" title="Clear search" aria-label="Clear search" href={`/signins?${new URLSearchParams({...(selectedGoogleTenant?{tenant:`google:${selectedGoogleTenant}`} : selectedTenant?{tenant:selectedTenant}:{}),...(selectedPlatform?{platform:selectedPlatform}:{}),...(showUnsuccessful?{unsuccessful:"1"}:{})}).toString()}`}>×</a> : null}
          </form>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>            <div style={{paddingRight:12,borderRight:"1px solid var(--line)"}}>
              <HistoryDateFilter range={params.range} from={params.from} to={params.to} preserve={{tenant:rawTenant,platform:selectedPlatform,unsuccessful:showUnsuccessful?"1":"",q:search}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"nowrap",paddingRight:12,borderRight:"1px solid var(--line)"}}>
          <TenantSignInFilter
            value={selectedGoogleTenant ? `google:${selectedGoogleTenant}` : selectedTenant}
            microsoftTenants={tenants.map((t: any) => ({ id: t.id, label: t.tenant_name || t.tenant_id }))}
            googleTenants={googleTenants.map((t: any) => ({ id: t.id, label: t.display_name || t.primary_domain || "Google Workspace" }))}
            platform={selectedPlatform}
            range={params.range} from={params.from} to={params.to}
            showUnsuccessful={showUnsuccessful}
          />

          <form method="get">
            {Object.entries(rangeQuery).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
            {selectedGoogleTenant ? (
              <input type="hidden" name="tenant" value={`google:${selectedGoogleTenant}`} />
            ) : selectedTenant ? (
              <input type="hidden" name="tenant" value={selectedTenant} />
            ) : null}
            {selectedPlatform ? <input type="hidden" name="platform" value={selectedPlatform} /> : null}
            {search ? <input type="hidden" name="q" value={search} /> : null}
            {!showUnsuccessful ? <input type="hidden" name="unsuccessful" value="1" /> : null}
            <button type="submit" className="button">
              {showUnsuccessful ? "Hide Unsuccessful" : "Show Unsuccessful"}
            </button>
          </form>
          </div>
          <div style={{display:"flex",alignItems:"center"}}><ExportCsvButton href={`/api/exports/signins?${new URLSearchParams({...params,page:""}).toString()}`} filename="microseconds-signins.csv" /></div>
        </div>
      </div>
      {error ? <div className="errorBox">{error}</div> : null}

      <div className="section card">
        <div className="tableHeader">
          <div>
            <h2>Analyzed Sign-ins</h2>
            <div className="subtitle">
              Showing {showUnsuccessful ? "successful and unsuccessful" : "successful"} sign-ins. Provider, ASN and VPN/privacy status come from the shared IP intelligence cache.
            </div>
          </div>
        </div>

        <div className="tableWrap">
          <table className="table signinsTable">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>User</th>
                <th>IP / Provider</th>
                <th>Location</th>
                <th>VPN / Privacy</th>
                <th>Application</th>
                <th>Result</th>
                <th>Risk</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((r: any) => {
                const riskScore = r.risk_score == null || r.risk_score === "" ? null : Number(r.risk_score);
                const riskReasons = cleanRiskReasons(Array.isArray(r.reasons) ? r.reasons : []);
                const findingScore = r.finding_risk_score == null ? null : Number(r.finding_risk_score);
                const incidentScore = r.incident_risk_score == null ? null : Number(r.incident_risk_score);
                const incidentDifference = findingScore != null && Number.isFinite(findingScore) && incidentScore != null && Number.isFinite(incidentScore) && incidentScore !== findingScore
                  ? incidentScore - findingScore : null;
                const incidentReasons = cleanRiskReasons(Array.isArray(r.incident_risk_reasons) ? r.incident_risk_reasons : []);
                const additionalReasons = incidentReasons.filter((reason: string) => !riskReasons.includes(reason));
                const aiClassification = typeof r.ai_classification === "string" ? r.ai_classification.toLowerCase() : "";
                const hasRisk = riskScore != null && Number.isFinite(riskScore) && riskScore > 0 && riskReasons.length > 0;
                return (
                <tr
                  key={r.id}
                  className={
                    hasRisk
                      ? riskScore >= 70
                        ? "signinRiskRow signinRiskCritical"
                        : "signinRiskRow signinRiskAttention"
                      : undefined
                  }
                >
                  <td className="nowrap" style={{ verticalAlign: "middle" }}>
                    <strong><LocalDateTime value={r.event_time} mode="date" /></strong>
                    {r.event_time ? (
                      <div className="subtitle" style={{ marginTop: 2 }}>
                        <LocalDateTime value={r.event_time} mode="time" />
                      </div>
                    ) : null}
                  </td>

                  <td className="signinsUserCell" style={{ verticalAlign: "middle" }}>
                    <strong>
                      {r.user_display_name || r.user_principal_name || "—"}
                    </strong>
                    {r.user_display_name &&
                    r.user_principal_name &&
                    String(r.user_display_name).toLowerCase() !== String(r.user_principal_name).toLowerCase() ? (
                      <div className="subtitle" style={{ marginTop: 2 }}>
                        {r.user_principal_name}
                      </div>
                    ) : null}
                  </td>

                  <td className="signinsIpCell" style={{ verticalAlign: "middle" }}>
                    <span className="signinsIpAddress">{r.ip_address || "—"}</span>
                    {r.intel_provider ? (
                      <div className="subtitle" style={{ marginTop: 2 }}>
                        {r.intel_provider}
                        {r.intel_asn ? ` · ${r.intel_asn}` : ""}
                        {r.intel_network_type ? ` · ${r.intel_network_type}` : ""}
                      </div>
                    ) : r.intel_asn ? (
                      <div className="subtitle" style={{ marginTop: 2 }}>
                        {r.intel_asn}
                        {r.intel_network_type ? ` · ${r.intel_network_type}` : ""}
                      </div>
                    ) : null}
                  </td>

                  <td className="signinsLocationCell" style={{ verticalAlign: "middle" }}>{locationLabel(r)}</td>

                  <td style={{ verticalAlign: "middle" }}>
                    {privacyLabel(r)}
                    {r.intel_hosting ? (
                      <>
                        <br />
                        <span className="subtitle">Hosting/datacenter</span>
                      </>
                    ) : null}
                    {r.ip_address && r.intel_privacy_available == null ? (
                      <>
                        <br />
                        <span className="subtitle">IP intelligence not cached</span>
                      </>
                    ) : null}
                  </td>

                  <td style={{ verticalAlign: "middle" }}>{r.app_name || "—"}</td>

                  <td style={{ verticalAlign: "middle" }}>
                    <span
                      className={`pill ${
                        String(r.status).toLowerCase().includes("fail")
                          ? "critical"
                          : "normal"
                      }`}
                    >
                      {r.status || "—"}
                    </span>
                    {String(r.status).toLowerCase().includes("fail") && r.failure_reason ? (
                      <div className="subtitle">{r.failure_reason}</div>
                    ) : null}
                  </td>

                  <td style={{ verticalAlign: "middle" }}>
                    {hasRisk ? (
                      <div>
                        <strong>{riskScore}/100</strong>
                        <div className="subtitle" style={{ marginTop: 2 }}>
                          {riskReasons.join("; ")}
                          {additionalReasons.length ? (
                            <div style={{ marginTop: 2 }}>{additionalReasons.join("; ")}</div>
                          ) : null}
                          {incidentDifference !== null ? (
                            <div style={{ marginTop: 2 }}>
                              {aiClassification ? `AI: ${aiClassification} risk` : "Incident assessment"}
                              {` (${incidentDifference > 0 ? "+" : ""}${incidentDifference})`}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : "No risk indicators detected"}
                  </td>
                </tr>
                );
              })}

              {!visibleRows.length ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No stored sign-ins were found for this tenant selection.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:14,flexWrap:"wrap"}}>
          <div className="subtitle">Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} sign-ins</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {page>1?<a className="button" href={`?${new URLSearchParams({...params,page:String(page-1)} as any).toString()}`}>Previous</a>:null}
            <span className="subtitle">Page {Math.min(page,totalPages)} of {totalPages}</span>
            {page<totalPages?<a className="button" href={`?${new URLSearchParams({...params,page:String(page+1)} as any).toString()}`}>Next</a>:null}
          </div>
        </div>
      </div>
    </>
  );
}
