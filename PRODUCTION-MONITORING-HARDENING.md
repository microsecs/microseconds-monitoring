# Production Monitoring Hardening — 2026-10-06

## Required before deployment
Run `sql/2026-10-06-tenant-sync-locks.sql` in the Supabase SQL editor.

## Changes
- Cron routes bypass interactive Supabase login middleware. They remain protected by `CRON_SECRET` in each route.
- `development` organizations are writable for monitoring.
- Microsoft and Google syncs use database-backed per-tenant locks with a 15-minute stale-lock timeout.
- Automatic monitoring skips a tenant already syncing instead of duplicating work.
- Manual sync returns HTTP 409 with `Sync already in progress.` when the same tenant is locked.
- Tenants API exposes current sync state.
- Tenants page polls status every 30 seconds while visible and shows `Syncing…` during background/manual syncs.
