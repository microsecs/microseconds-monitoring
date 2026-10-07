# Automatic monitoring logging

Adds explicit per-tenant cron logging for automatic monitoring.

Examples:
- `[monitor] Microsoft 365 - Customer A: SYNCED — 12 saved, 1 incident(s)`
- `[monitor] Google Workspace - Customer B: SKIPPED — Sync already in progress`
- `[monitor] Microsoft 365 - Customer C: FAILED — <error>`
- `[monitor] SUMMARY — 5 tenant(s) checked: 3 synced, 1 skipped, 1 failed; 2 organization(s) processed`

No database migration is required. Existing alert logging is unchanged.
