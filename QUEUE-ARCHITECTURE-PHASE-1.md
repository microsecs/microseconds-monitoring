# Monitoring Queue — Phase 1 (foundation only)

This release adds a durable Supabase job schema and atomic worker claim/completion functions. It does **not** change the production cron execution path yet. That is intentional: existing monitoring, incident generation, and organization-wide consolidated email alerts continue unchanged while we implement and validate workers.

## Install
Run `sql/2026-10-08-monitoring-job-queue-foundation.sql` in the Supabase SQL editor. Deploy the project normally. No new environment variables or Vercel cron changes in this phase.

## Guarantees established
- Unique job identity includes organization ID, provider, internal tenant-record ID, and scheduled time. Same external Microsoft/Google tenant connected by two customers is two independent jobs.
- Atomic `FOR UPDATE SKIP LOCKED` claiming, with a lease token and expiry.
- Bounded retries and exponential backoff; errors retained for diagnostics.
- Service-role-only RPCs and no client-side RLS policies.

## Phase 2 required before switching traffic
1. Scheduler to enqueue due jobs using a stable hourly slot and eligibility rules.
2. Worker to claim a bounded batch and run existing provider sync + incident logic, preserving existing per-tenant sync locks.
3. Organization-scoped notification outbox and delivery deduplication, so concurrent workers still send at most one consolidated alert per recipient for each scheduled monitoring cycle.
4. Observability for queue age, overdue tenants, failures and retries; load tests with duplicate external tenants in distinct orgs.
5. Feature-flagged cutover with rollback to current cron until parity tests pass.

Do **not** switch `/api/cron/monitor` to queue mode or create worker cron routes based only on this Phase 1 schema.
