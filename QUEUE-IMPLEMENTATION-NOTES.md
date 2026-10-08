# Queued monitoring implementation — validation build

## Deploy
1. Run `sql/2026-10-08-monitoring-job-queue-foundation.sql` in Supabase SQL Editor **before deploying**. This is mandatory.
2. Deploy source to Vercel Pro with existing `CRON_SECRET`, Supabase service-role, provider, and SMTP settings.
3. The scheduled `/api/cron/monitor` now runs every five minutes; a unique job is created per eligible tenant connection per UTC hour. The same external Microsoft tenant in two organizations gets two jobs.
4. Product Admin's Run Monitoring Now uses the queue without sending email.
5. Review Vercel `[queue] SUMMARY` logs and `public.monitoring_jobs` in Supabase.

## Design
- Supabase atomic `claim_monitoring_jobs` and token-bound `finish_monitoring_job` RPCs; 12-minute leases; 5 attempts maximum; exponential retry backoff.
- Three concurrent tenant syncs per invocation, with a ~210-second claim-loop budget. The last batch may extend beyond the budget; Vercel maxDuration is 300 seconds.
- Eligible organizations are checked at enqueue time and again before processing.
- Existing tenant sync locks, incremental checkpoints, incident scoring, and AI assessment remain in place.
- Alert candidates are consolidated per organization **within a single worker invocation**, with existing per-incident/recipient alert-log deduplication. This does not guarantee one email per hour across multiple invocations.

## Known limitations / testing requirements
- **Not load-tested** at 100 organizations / 500 tenants; three concurrent provider syncs and provider rate limits require measurement.
- A worker invocation that dies after claiming jobs leaves them to be reclaimed after the lease expires. A very slow provider sync that outlives its lease can overlap a reclaimed job; the separate tenant sync lock mitigates this but must be tested.
- After five failures a job remains failed for inspection; no dead-letter recovery UI is implemented yet.
- Cron enqueue scans eligible organizations sequentially; test its latency at scale and add pagination if needed.
- Consolidated email delivery is not fully transactional: SMTP can accept a message before the alert log is written. The existing email implementation has this limitation.
- Product Admin queue status dashboard is not implemented yet. Use Supabase table and Vercel logs.
- Automated TypeScript compilation was **not** run: dependencies were absent and offline npm installation failed.
- Keep a backup and test with the development and test organizations before production launch.
