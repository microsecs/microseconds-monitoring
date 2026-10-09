# Daily retention cleanup

Vercel invokes `/api/cron/retention` daily at 09:37 UTC. It is separate from the monitoring queue and processes every organization, including customers with disconnected or non-syncing tenants.

The endpoint requires `Authorization: Bearer <CRON_SECRET>` (Vercel supplies this to configured cron routes). `CRON_SECRET` must already be configured, as for existing cron routes.

Each organization uses its own configured sign-in and incident retention periods. The existing retention implementation removes expired sign-ins and related findings/email logs in bounded batches and expired incidents separately. One organization's failure is logged and does not prevent cleanup for subsequent organizations. A partial-failure response uses HTTP 207 and reports organization IDs for investigation.

No SQL migrations or new environment variables are required. The existing retention helper limits each run to 10,000 sign-ins and 10,000 incidents per organization; if a backlog exceeds this, subsequent daily runs continue the cleanup.

Check Vercel function logs for `Daily retention cleanup` and review counts/failures after first execution. This change does not retroactively restore deleted records.
