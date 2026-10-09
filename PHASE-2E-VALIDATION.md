# Phase 2E — filter-wide validation

Product Admin > Behavioral Learning now aggregates the selected customer, tenant, date range, and Changed-only filter over all matching shadow assessments, instead of just the visible table page. It processes up to 20,000 rows in 500-row batches; if this limit is exceeded or a query fails, the dashboard explicitly labels its validation metrics incomplete.

Metrics: verified Safe, confirmed Suspicious, threshold crossings in either direction, and directional comparisons of score increases/decreases against verified decisions. Unreviewed and dismissed are not counted as verified outcomes. Threshold comparisons use today's configured organization threshold, not the threshold at the time of each event. The live score is the original deterministic pre-AI score.

No SQL migration or environment changes. No changes to live risk scoring, incident creation, alerts, the monitoring queue, or Sign-in History.

Validation: Run npm install and npm run build in your deployment environment. Review dashboard totals against Supabase. The 20,000-row limit is intentionally disclosed rather than silently representing incomplete counts as global totals.
