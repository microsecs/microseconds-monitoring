"use client";

import { useEffect, useState } from "react";
import PageLoading from "@/components/PageLoading";

type GoogleTenant = {
  id: string;
  display_name: string;
  primary_domain: string | null;
  customer_id: string | null;
  admin_email: string | null;
  last_verified_at: string | null;
  last_sync_at: string | null;
  connection_status?: string | null;
  last_sync_error?: string | null;
  last_sync_error_at?: string | null;
  created_at: string;
  sort_order?: number | null;
  sync_in_progress?: boolean;
};

type Tenant = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  automatic_monitoring_available: boolean | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_csv_import_at: string | null;
  connection_status?: string | null;
  last_sync_error?: string | null;
  last_sync_error_at?: string | null;
  sort_order?: number | null;
  sync_in_progress?: boolean;
};

const ENTRA_SIGNINS =
  "https://entra.microsoft.com/#view/Microsoft_AAD_IAM/SignInEventsV3Blade";

function monitoringLabel(t: Tenant, globalMonitoring: boolean) {
  if (String(t.tenant_id).startsWith("manual:")) return "CSV Monitoring";
  if (t.automatic_monitoring_available === true) return globalMonitoring ? "Automatic Monitoring" : "Automatic Available";
  return "CSV Monitoring";
}


function healthBadge(status?: string | null, error?: string | null) {
  if (status === "reconnect_required") return <span className="pill connectionProblem">Reconnection Required</span>;
  if (status === "problem") {
    const low = String(error || "").toLowerCase();
    if (low.includes("timeout") || low.includes("aborted")) return <span className="pill syncDelayed">Sync Delayed</span>;
    return <span className="pill connectionProblem">Connection Problem</span>;
  }
  return null;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [googleTenants, setGoogleTenants] = useState<GoogleTenant[]>([]);
  const [googleSyncingId, setGoogleSyncingId] = useState("");
  const [googleNameEdits, setGoogleNameEdits] = useState<Record<string, string>>({});
  const [googleRenamingId, setGoogleRenamingId] = useState("");
  const [googleDeletingId, setGoogleDeletingId] = useState("");
  const [organization, setOrganization] = useState("");
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [syncingId, setSyncingId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [checkingId, setCheckingId] = useState("");
  const [checkingCsvTenants, setCheckingCsvTenants] = useState(false);
  const [csvCheckStatus, setCsvCheckStatus] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState("");
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [draggingKey, setDraggingKey] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [automaticMonitoringEnabled, setAutomaticMonitoringEnabled] = useState(false);
  const [tenantActionStatus, setTenantActionStatus] = useState<{ title: string; detail: string; busy: boolean } | null>(null);

  async function load() {
    const res = await fetch("/api/tenants", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Could not load tenants.");

    const list: Tenant[] = data.tenants || [];
    setTenants(list);
    setOrganization(data.organization?.name || "");

    const edits: Record<string, string> = {};
    for (const t of list) edits[t.id] = t.tenant_name || "";
    setNameEdits(edits);

    const googleRes = await fetch("/api/google/tenants", { cache: "no-store" });
    const googleData = await googleRes.json();
    if (!googleRes.ok) throw new Error(googleData?.error || "Could not load Google Workspace tenants.");
    setGoogleTenants(googleData.tenants || []);
    const googleEdits: Record<string,string> = {};
    for (const g of googleData.tenants || []) googleEdits[g.id] = g.display_name || "";
    setGoogleNameEdits(googleEdits);

    const monitoringRes = await fetch("/api/settings/automatic-monitoring", { cache: "no-store" });
    const monitoringData = await monitoringRes.json();
    if (!monitoringRes.ok) throw new Error(monitoringData?.error || "Could not load automatic monitoring setting.");
    setAutomaticMonitoringEnabled(monitoringData.enabled === true);
  }

  useEffect(() => {
    load()
      .then(() => {
        const q = new URLSearchParams(window.location.search);
        const importStatus = window.sessionStorage.getItem("monitoringStatusMessage");
        if (importStatus) {
          window.sessionStorage.removeItem("monitoringStatusMessage");
          setMessage(importStatus);
          window.history.replaceState({}, "", "/tenants");
        } else if (q.get("googleConnected")) {
          const names = Number(q.get("googleNames") || 0);
          setMessage(`Google Workspace connected successfully.${names ? ` Friendly names updated on ${names} stored sign-ins.` : ""}`);
        } else if (q.get("googleError")) {
          setError(q.get("googleError") || "Google connection failed.");
        } else if (q.get("connected")) {
          setMessage(
            q.get("readyToSync") === "1"
              ? "Microsoft tenant connected successfully. Click Sync Now to retrieve its sign-in history."
              : q.get("permissionPending") === "1"
                ? "Microsoft tenant connected successfully. Microsoft is still activating the newly granted Graph permission. Use Check Automatic Monitoring shortly; you do not need to reconnect the tenant."
                : "Microsoft tenant connected. This tenant is configured for CSV monitoring."
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load().catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function syncGoogleTenant(id: string) {
    setGoogleSyncingId(id);
    setMessage("Syncing Google Workspace login activity...");
    try {
      const res = await fetch(`/api/google/tenants/${encodeURIComponent(id)}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Google Workspace sync failed.");
      setMessage(`Google sync complete: ${data.eventsReturned || 0} events returned; ${data.ipIntelCached ?? 0} of ${data.uniqueIps ?? 0} unique IPs enriched. Manual sync does not send email alerts.`);
      await load();
    } catch (e: any) {
      setMessage(e?.message || "Google Workspace sync failed.");
    } finally {
      setGoogleSyncingId("");
    }
  }

  async function renameGoogleTenant(g: GoogleTenant, requestedName?: string) {
    const next=String(requestedName ?? googleNameEdits[g.id] ?? "").trim();
    if(!next)return;
    setGoogleRenamingId(g.id); setError(""); setMessage("");
    setTenantActionStatus({ title: "Renaming tenant…", detail: `Updating ${g.display_name || g.primary_domain || "Google Workspace"}.`, busy: true });
    try{
      const res=await fetch(`/api/google/tenants/${encodeURIComponent(g.id)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName:next})
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||"Could not rename Google Workspace tenant.");
      await load();
      setTenantActionStatus({ title: "Tenant renamed", detail: `Google Workspace tenant display name changed to ${next}.`, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 3000);
    }catch(e:any){
      const detail=e?.message||"Could not rename Google Workspace tenant.";
      setTenantActionStatus({ title: "Rename failed", detail, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 4000);
    }
    finally{setGoogleRenamingId("");}
  }

  async function deleteGoogleTenant(g: GoogleTenant) {
    const label=g.display_name||g.primary_domain||"Google Workspace";
    if(!window.confirm(`Delete ${label}?\n\nThis permanently removes this Google Workspace connection and its stored sign-in history/findings. This cannot be undone.`))return;
    setGoogleDeletingId(g.id); setError(""); setMessage("");
    setTenantActionStatus({ title: "Deleting tenant…", detail: `Removing ${label} and its stored security history.`, busy: true });
    try{
      const res=await fetch(`/api/google/tenants/${encodeURIComponent(g.id)}`,{method:"DELETE"});
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||"Could not delete Google Workspace tenant.");
      await load();
      setTenantActionStatus({ title: "Tenant deleted", detail: `${label} and its stored Google sign-in history were deleted.`, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 3000);
    }catch(e:any){
      const detail=e?.message||"Could not delete Google Workspace tenant.";
      setTenantActionStatus({ title: "Delete failed", detail, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 4000);
    }
    finally{setGoogleDeletingId("");}
  }

  async function renameTenant(t: Tenant, requestedName?: string) {
    const next = String(requestedName ?? nameEdits[t.id] ?? "").trim();
    if (!next) return;

    setRenamingId(t.id);
    setError("");
    setMessage("");
    setTenantActionStatus({ title: "Renaming tenant…", detail: `Updating ${t.tenant_name || t.tenant_id}.`, busy: true });

    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(t.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantName: next }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not update tenant name.");

      await load();
      setTenantActionStatus({ title: "Tenant renamed", detail: `Tenant display name changed to ${next}.`, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 3000);
    } catch (e: any) {
      const detail = e?.message || "Could not update tenant name.";
      setTenantActionStatus({ title: "Rename failed", detail, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 4000);
    } finally {
      setRenamingId("");
    }
  }

  async function checkCapability(t: Tenant) {
    setCheckingId(t.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(t.id)}/capability`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not check automatic monitoring.");
      setMessage(data.message || "Microsoft tenant capability check completed.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not check automatic monitoring.");
    } finally {
      setCheckingId("");
    }
  }

  async function checkAllCsvCapabilities() {
    const csvTenants = tenants.filter(
      (t) => t.automatic_monitoring_available !== true && !String(t.tenant_id || "").startsWith("manual:")
    );
    if (!csvTenants.length || checkingCsvTenants) return;
    if (!window.confirm(
      `Check all ${csvTenants.length} Microsoft 365 CSV tenant${csvTenants.length === 1 ? "" : "s"} for automatic monitoring capability?\n\nThis checks whether each connected tenant has the required Microsoft Entra licensing/access for automatic sign-in monitoring.`
    )) return;

    setCheckingCsvTenants(true);
    setCsvCheckStatus("Checking Microsoft 365 CSV tenants for automatic monitoring capability…");
    setError("");
    setMessage("");
    let available = 0;
    let checked = 0;
    const failures: string[] = [];
    try {
      for (const t of csvTenants) {
        try {
          const res = await fetch(`/api/tenants/${encodeURIComponent(t.id)}/capability`, { method: "POST" });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Capability check failed.");
          checked += 1;
          if (data?.automatic_monitoring_available === true || /automatic monitoring.*available|enabled/i.test(String(data?.message || ""))) {
            available += 1;
          }
        } catch (e: any) {
          failures.push(`${t.tenant_name || t.tenant_id}: ${e?.message || "Capability check failed."}`);
        }
      }
      await load();
      const summary = `Checked ${checked} Microsoft 365 CSV tenant${checked === 1 ? "" : "s"}.${available ? ` ${available} support automatic monitoring.` : ""}${failures.length ? ` ${failures.length} could not be checked.` : ""}`;
      setCsvCheckStatus(summary);
      window.setTimeout(() => setCsvCheckStatus(""), 4000);
      if (failures.length) setError(failures.join(" "));
    } finally {
      setCheckingCsvTenants(false);
    }
  }

  async function deleteTenant(t: Tenant) {
    const label = t.tenant_name || t.tenant_id;
    if (!window.confirm(`Delete ${label}?\n\nThis permanently removes this tenant's sign-ins, incidents, findings, imports, alert history, and tenant-specific notification settings. This cannot be undone.`)) return;
    setDeletingId(t.id);
    setError("");
    setMessage("");
    setTenantActionStatus({ title: "Deleting tenant…", detail: `Removing ${label} and its stored security history.`, busy: true });
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not delete tenant.");
      await load();
      setTenantActionStatus({ title: "Tenant deleted", detail: `${label} and its tenant-specific security history were deleted.`, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 3000);
    } catch (e: any) {
      const detail = e?.message || "Could not delete tenant.";
      setTenantActionStatus({ title: "Delete failed", detail, busy: false });
      window.setTimeout(() => setTenantActionStatus(null), 4000);
    } finally {
      setDeletingId("");
    }
  }

  async function syncAllTenants() {
    const microsoft = tenants
      .filter((t) => t.automatic_monitoring_available === true)
      .map((t) => ({ platform: "Microsoft 365", id: t.id, label: t.tenant_name || t.tenant_id, url: `/api/tenants/${encodeURIComponent(t.id)}/sync` }));
    const google = googleTenants
      .map((g) => ({ platform: "Google Workspace", id: g.id, label: g.display_name || g.primary_domain || "Google Workspace", url: `/api/google/tenants/${encodeURIComponent(g.id)}/sync` }));
    const eligible = [...microsoft, ...google];

    if (!eligible.length) {
      setMessage("There are no tenants currently enabled for Automatic Monitoring.");
      return;
    }

    if (!window.confirm(`Sync all ${eligible.length} tenant${eligible.length === 1 ? "" : "s"} currently enabled for Automatic Monitoring?`)) return;

    setSyncingAll(true);
    setError("");
    setMessage("");

    let completed = 0, failed = 0, retrieved = 0, findings = 0, incidents = 0;
    const failures: string[] = [];

    try {
      // Sequential on purpose: avoids bursts against Graph, Google Reports, IPinfo and incident analysis.
      for (let i = 0; i < eligible.length; i++) {
        const t = eligible[i];
        setSyncAllProgress(`Syncing ${i + 1} of ${eligible.length}: ${t.platform} — ${t.label}`);
        try {
          const res = await fetch(t.url, { method: "POST" });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Sync failed.");
          completed++;
          retrieved += Number(data?.retrieved || 0);
          findings += Number(data?.updatedFindings || 0);
          incidents += Number(data?.incidentsCreated || 0);
        } catch (e: any) {
          failed++;
          failures.push(`${t.platform} — ${t.label}: ${e?.message || "Sync failed"}`);
        }
      }

      setMessage(
        `${completed} of ${eligible.length} tenants synced successfully` +
        `${failed ? `; ${failed} failed` : ""}. ${retrieved} sign-ins retrieved, ${findings} security findings updated, ${incidents} incidents created.` +
        (failures.length ? ` Failed: ${failures.join(" | ")}` : "")
      );
      await load();
    } finally {
      setSyncingAll(false);
      setSyncAllProgress("");
    }
  }

  async function syncTenant(t: Tenant) {
    setSyncingId(t.id);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(t.id)}/sync`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Could not synchronize sign-ins.");
      }

      setMessage(
        `${data.tenant}: Microsoft returned ${data.retrieved} sign-ins; ${data.unique ?? data.retrieved} unique events were processed. ${data.intelExamined ?? 0} unique IPs had IP intelligence available, ${data.updatedFindings} security findings were updated, ${data.incidentsCreated ?? 0} incidents were created.`
      );

      await load();
    } catch (e: any) {
      setError(e?.message || "Could not synchronize sign-ins.");
      await load().catch(() => {});
    } finally {
      setSyncingId("");
    }
  }

  type OrderedTenant =
    | { key: string; platform: "microsoft"; sortOrder: number | null; tenant: Tenant }
    | { key: string; platform: "google"; sortOrder: number | null; tenant: GoogleTenant };

  const orderedTenants: OrderedTenant[] = [
    ...tenants.map((t) => ({ key: `microsoft:${t.id}`, platform: "microsoft" as const, sortOrder: t.sort_order ?? null, tenant: t })),
    ...googleTenants.map((g) => ({ key: `google:${g.id}`, platform: "google" as const, sortOrder: g.sort_order ?? null, tenant: g })),
  ].sort((a, b) => {
    const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    // Preserve the existing Microsoft-then-Google order until the user reorders the list.
    if (a.platform !== b.platform) return a.platform === "microsoft" ? -1 : 1;
    return 0;
  });

  async function persistTenantOrder(items: OrderedTenant[]) {
    // Move the rows immediately, then persist the same order in the background.
    const orderByKey = new Map(items.map((item, index) => [item.key, index]));
    setTenants((current) => current.map((t) => ({ ...t, sort_order: orderByKey.get(`microsoft:${t.id}`) ?? t.sort_order })));
    setGoogleTenants((current) => current.map((g) => ({ ...g, sort_order: orderByKey.get(`google:${g.id}`) ?? g.sort_order })));
    setSavingOrder(true);
    setOrderSaved(false);
    setError("");
    try {
      const res = await fetch("/api/tenants/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item, index) => ({ platform: item.platform, id: item.tenant.id, sortOrder: index })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not save tenant order.");
      setOrderSaved(true);
      window.setTimeout(() => setOrderSaved(false), 1400);
    } catch (e: any) {
      setError(e?.message || "Could not save tenant order.");
      await load().catch(() => {});
    } finally {
      setSavingOrder(false);
    }
  }

  function dropTenant(targetKey: string) {
    if (!draggingKey || draggingKey === targetKey || savingOrder) {
      setDraggingKey("");
      return;
    }
    const next = [...orderedTenants];
    const from = next.findIndex((x) => x.key === draggingKey);
    const to = next.findIndex((x) => x.key === targetKey);
    if (from < 0 || to < 0) return setDraggingKey("");
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraggingKey("");
    void persistTenantOrder(next);
  }

  const anySyncing = Boolean(syncingAll || syncingId || googleSyncingId);
  const totalTenants = tenants.length + googleTenants.length;
  const automaticTenants = tenants.filter((t) => t.automatic_monitoring_available === true).length + googleTenants.length;
  const csvTenants = tenants.filter((t) => t.automatic_monitoring_available !== true).length;
  const attentionTenants = tenants.filter((t) => t.connection_status === "problem" || t.connection_status === "reconnect_required").length
    + googleTenants.filter((g) => g.connection_status === "problem" || g.connection_status === "reconnect_required").length;
  const canSyncAll = automaticTenants > 0;

  const csvMicrosoftTenants = tenants.filter(
    (t) => t.automatic_monitoring_available !== true && !String(t.tenant_id || "").startsWith("manual:")
  );

  if (initialLoading) return <PageLoading />;

  return (
    <>
      {tenantActionStatus ? (
        <div className="syncOverlay" role="status" aria-live="polite">
          <div className="syncOverlayCard">
            {tenantActionStatus.busy ? <span className="spinner spinnerLarge" /> : null}
            <div>
              <strong>{tenantActionStatus.title}</strong>
              <div className="muted">{tenantActionStatus.detail}</div>
            </div>
          </div>
        </div>
      ) : null}
      {anySyncing ? (
        <div className="syncOverlay" role="status" aria-live="polite">
          <div className="syncOverlayCard">
            <span className="spinner spinnerLarge" />
            <div>
              <strong>{syncingAll ? "Syncing all tenants…" : "Synchronizing tenant…"}</strong>
              <div className="muted">{syncingAll && syncAllProgress ? syncAllProgress : "Retrieving and analyzing sign-in activity. Please leave this page open."}</div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="topbar">
        <div>
          <div className="title">Tenants</div>
          <div className="subtitle">
            Manage Microsoft 365 and Google Workspace tenants
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: 14, borderRight: "1px solid var(--line)" }}>
            <button
              className="button"
              disabled={checkingCsvTenants || csvMicrosoftTenants.length === 0}
              onClick={checkAllCsvCapabilities}
              title={csvMicrosoftTenants.length === 0 ? "No connected Microsoft 365 CSV tenants to check" : "Check all Microsoft 365 CSV tenants for automatic monitoring capability"}
            >
              Check CSV Tenants
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="button"
              disabled={syncingAll || !canSyncAll}
              onClick={syncAllTenants}
            >
              Sync All
            </button>
            <button className="button primary" onClick={() => setShowAddTenant((v) => !v)}>
              {showAddTenant ? "Close Add Tenant" : "Add Tenant"}
            </button>
          </div>
        </div>
      </div>

      {csvCheckStatus ? (
        <div className="syncOverlay" role="status" aria-live="polite">
          <div className="syncOverlayCard">
            {checkingCsvTenants ? <span className="spinner spinnerLarge" /> : null}
            <div>
              <strong>{checkingCsvTenants ? "Checking CSV tenants…" : "CSV tenant check complete"}</strong>
              <div className="muted">{csvCheckStatus}</div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div> : null}
      {message ? <div className="infoBox" style={{ marginBottom: 12 }}>{message}</div> : null}

      <div className="tenantSummary" aria-label="Tenant monitoring summary">
        <div className="tenantMetric">
          <div className="tenantMetricValue">{totalTenants}</div>
          <div className="tenantMetricLabel">Total Tenants</div>
          <div className="tenantMetricHint">Microsoft 365 + Google Workspace</div>
        </div>
        <div className="tenantMetric">
          <div className="tenantMetricValue">{automaticTenants}</div>
          <div className="tenantMetricLabel">Automatic Monitoring</div>
          <div className="tenantMetricHint">Eligible for direct synchronization</div>
        </div>
        <div className="tenantMetric">
          <div className="tenantMetricValue">{csvTenants}</div>
          <div className="tenantMetricLabel">CSV Monitoring</div>
          <div className="tenantMetricHint">Manual sign-in log import</div>
        </div>
        <div className={`tenantMetric ${attentionTenants ? "tenantMetricAttention" : ""}`}>
          <div className="tenantMetricValue">{attentionTenants}</div>
          <div className="tenantMetricLabel">Needs Attention</div>
          <div className="tenantMetricHint">Connection or reconnection issue</div>
        </div>
      </div>

      {showAddTenant ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>Add Tenant</h2>
          <p className="muted">
            Choose the cloud platform you want MicroSECONDS Security to monitor.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
            <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Microsoft 365</h3>
              <p className="muted">
                Connect Microsoft Entra and monitor sign-in activity automatically when the tenant supports Graph sign-in logs.
              </p>
              <a className="button primary" href="/api/microsoft/connect">
                Connect Microsoft 365
              </a>
            </div>
            <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Google Workspace</h3>
              <p className="muted">
                Google Workspace monitoring is being added next. It will feed the same sign-in history and incident analysis system.
              </p>
              <a className="button primary" href="/api/google/connect">
                Connect Google Workspace
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="section card">
        <div className="tableHeader">
          <div>
            <h2>Configured Tenants</h2>
            <div className="subtitle">
              Microsoft 365 and Google Workspace tenants will be managed together here.
            </div>
          </div>
          <div className="orderSaveStatus" aria-live="polite">
            {savingOrder ? (
              <>
                <span className="orderSpinner" aria-hidden="true" />
                <span>Saving order…</span>
              </>
            ) : orderSaved ? (
              <span>Order saved</span>
            ) : null}
          </div>
        </div>

        <div className="tableWrap">
          <table className="table tenantTable">
            <thead>
              <tr>
                <th className="reorderColumn"><span className="srOnly">Reorder</span></th>
                <th className="tenantColumnHeading">Tenant</th>
                <th className="tenantColumnHeading">Platform</th>
                <th className="tenantColumnHeading">Monitoring</th>
                <th className="tenantColumnHeading">Last Activity</th>
                <th className="tenantColumnHeading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedTenants.map((item) => {
                if (item.platform === "microsoft") {
                  const t = item.tenant;

                const syncTime = t.last_sync_at ? new Date(t.last_sync_at) : null;
                const csvTime = t.last_csv_import_at ? new Date(t.last_csv_import_at) : null;
                // Once a tenant has completed a successful Microsoft sync, automatic
                // monitoring is the authoritative activity source. Keep the CSV import
                // timestamp in the database for history, but do not continue showing it
                // in the tenant list. Before the first successful sync, retain the CSV
                // import timestamp so converted tenants still show their last activity.
                const latest = syncTime || csvTime;
                const latestLabel = syncTime ? "Sync" : "CSV import";

                return (
                  <tr key={item.key} className={draggingKey === item.key ? "tenantRowDragging" : ""} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTenant(item.key)}>
                    <td className="reorderCell"><button type="button" className="dragHandle" draggable={!savingOrder} onDragStart={() => setDraggingKey(item.key)} onDragEnd={() => setDraggingKey("")} aria-label={`Reorder ${t.tenant_name || "tenant"}`} title="Drag to reorder">⋮⋮</button></td>
                    <td style={{ minWidth: 210 }}>
                      <div className="tenantName">{t.tenant_name || "Unnamed tenant"}</div>
                      {healthBadge(t.connection_status, t.last_sync_error) ? <div className="tenantHealth">{healthBadge(t.connection_status, t.last_sync_error)}</div> : <div className="tenantHealthy">Connection healthy</div>}
                      {t.connection_status === "reconnect_required" ? (
                        <div><a className="tenantReconnectLink" href="/api/microsoft/connect">Reconnect Microsoft 365</a></div>
                      ) : null}
                    </td>

                    <td style={{ minWidth: 130 }}>
                      <span className="pill normal">Microsoft 365</span>
                    </td>

                    <td style={{ minWidth: 155 }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span
                        className={`pill ${
                          t.automatic_monitoring_available === true ? "normal" : "review"
                        }`}
                      >
                        {monitoringLabel(t, automaticMonitoringEnabled)}
                      </span>

                      </div>
                    </td>

                    <td style={{ minWidth: 185 }}>
                      {latest ? (
                        <>
                          <div><strong>{latestLabel}:</strong> {latest.toLocaleString()}</div>
                        </>
                      ) : (
                        <span className="muted">No activity yet</span>
                      )}
                    </td>

                    <td className="tenantActionsCell">
                      <div className="tenantActions">
                        {t.automatic_monitoring_available === true ? (
                          <button className="button primary compactAction tenantPrimaryAction" disabled={syncingAll || syncingId === t.id || t.sync_in_progress === true} onClick={() => syncTenant(t)}>
                            Sync
                          </button>
                        ) : (
                          <a className="button primary compactAction tenantPrimaryAction" href={`/import?tenant=${encodeURIComponent(t.id)}&browse=1`}>Import</a>
                        )}
                        <a className="button compactAction" href={`/signins?tenant=${encodeURIComponent(t.id)}`}>Sign-ins</a>
                        <button className="button compactAction" disabled={renamingId === t.id} onClick={() => {
                          const next = window.prompt("Rename tenant", t.tenant_name || "");
                          if (next !== null && next.trim()) renameTenant(t, next);
                        }}>Rename</button>
                        <button className="button compactAction deleteAction" disabled={deletingId === t.id} onClick={() => deleteTenant(t)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );

                }

                const g = item.tenant;
                return (

                <tr key={item.key} className={draggingKey === item.key ? "tenantRowDragging" : ""} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTenant(item.key)}>
                  <td className="reorderCell"><button type="button" className="dragHandle" draggable={!savingOrder} onDragStart={() => setDraggingKey(item.key)} onDragEnd={() => setDraggingKey("")} aria-label={`Reorder ${g.display_name || "Google tenant"}`} title="Drag to reorder">⋮⋮</button></td>
                  <td style={{ minWidth: 210 }}>
                    <div className="tenantName">{g.display_name}</div>
                    {healthBadge(g.connection_status, g.last_sync_error) ? <div className="tenantHealth">{healthBadge(g.connection_status, g.last_sync_error)}</div> : <div className="tenantHealthy">Connection healthy</div>}
                    {g.connection_status === "reconnect_required" ? (
                      <div><a className="tenantReconnectLink" href="/api/google/connect">Reconnect Google Workspace</a></div>
                    ) : null}
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <span className="pill normal">Google Workspace</span>
                  </td>
                  <td style={{ minWidth: 155 }}>
                    <span className="pill normal">{automaticMonitoringEnabled ? "Automatic Monitoring" : "Automatic Available"}</span>
                  </td>
                  <td>
                    {g.last_sync_at ? (
                      <div><strong>Sync:</strong> {new Date(g.last_sync_at).toLocaleString()}</div>
                    ) : (
                      <span className="muted">Never synced</span>
                    )}
                  </td>
                  <td className="tenantActionsCell">
                    <div className="tenantActions">
                      <button className="button primary compactAction tenantPrimaryAction" disabled={googleSyncingId === g.id || g.sync_in_progress === true} onClick={() => syncGoogleTenant(g.id)}>
                        Sync
                      </button>
                      <a className="button compactAction" href={`/signins?googleTenant=${encodeURIComponent(g.id)}&platform=google`}>Sign-ins</a>
                      <button className="button compactAction" disabled={googleRenamingId===g.id} onClick={() => {
                        const next = window.prompt("Rename tenant", g.display_name || "");
                        if (next !== null && next.trim()) renameGoogleTenant(g, next);
                      }}>Rename</button>
                      <button className="button compactAction deleteAction" disabled={googleDeletingId===g.id} onClick={()=>deleteGoogleTenant(g)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>

                );
              })}

              {!tenants.length && !googleTenants.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No tenants have been added yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
