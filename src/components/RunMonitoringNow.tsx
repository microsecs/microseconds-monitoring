"use client";

import { useState } from "react";

type MonitorResult = {
  ok?: boolean;
  organizationsProcessed?: number;
  organizationsSkippedForSubscription?: number;
  tenantsProcessed?: number;
  successes?: number;
  failures?: number;
  durationMs?: number;
  finishedAt?: string;
  results?: Array<{ platform?: string; tenant?: string; ok?: boolean; error?: string; incidentsCreated?: number; alertsSent?: number }>;
  error?: string;
};

export default function RunMonitoringNow() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonitorResult | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/run-monitoring", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Monitoring test failed (${res.status})`);
      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Monitoring test failed" });
    } finally {
      setRunning(false);
    }
  }

  const failures = result?.results?.filter(x => !x.ok) || [];
  return <div className="section card">
    <div className="adminTableHeader">
      <div><h2>Automatic Monitoring Diagnostic</h2><div className="muted">Run the same monitoring engine used by the hourly Vercel cron.</div></div>
      <button className="button primary" disabled={running} onClick={run}>{running ? "Running Monitoring…" : "Run Monitoring Now"}</button>
    </div>
    {running ? <div className="adminMonitorRunning"><span className="spinner spinnerInline" />Synchronizing eligible tenants, analyzing incidents and processing enabled alerts…</div> : null}
    {result?.error ? <div className="errorBox">{result.error}</div> : null}
    {result?.ok ? <>
      <div className="adminMonitorSummary">
        <div><span>Organizations</span><strong>{result.organizationsProcessed ?? 0}</strong></div>
        <div><span>Tenants</span><strong>{result.tenantsProcessed ?? 0}</strong></div>
        <div><span>Successful</span><strong className="adminMonitorGood">{result.successes ?? 0}</strong></div>
        <div><span>Failed</span><strong className={result.failures ? "adminMonitorBad" : "adminMonitorGood"}>{result.failures ?? 0}</strong></div>
      </div>
      <div className="muted adminMonitorMeta">Completed {result.finishedAt ? new Date(result.finishedAt).toLocaleString() : ""} in {typeof result.durationMs === "number" ? `${(result.durationMs / 1000).toFixed(1)} seconds` : "—"}. {result.organizationsSkippedForSubscription ? `${result.organizationsSkippedForSubscription} organization(s) skipped because monitoring access is not writable.` : ""}</div>
      {failures.length ? <div className="adminMonitorFailures"><strong>Failures</strong>{failures.map((x, i) => <div key={i}>{x.platform || "Tenant"} · {x.tenant || "Unknown"}: {x.error || "Monitoring failed"}</div>)}</div> : <div className="adminMonitorSuccess">Monitoring run completed without tenant failures.</div>}
    </> : null}
  </div>;
}
