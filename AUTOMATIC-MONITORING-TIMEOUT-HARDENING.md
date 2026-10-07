# Automatic monitoring timeout hardening

This update addresses Vercel 5-minute cron timeouts.

- Microsoft and Google provider HTTP requests now time out after 30 seconds instead of hanging indefinitely.
- IP intelligence HTTP requests time out after 12 seconds per attempt.
- The hourly monitor has a 255-second safety budget and stops starting new tenant work when fewer than 45 seconds remain.
- Deferred tenants remain eligible for the next hourly run.
- Tenants are processed oldest/never-synced first within each provider to reduce starvation.
- Consolidated incident email is still sent per organization after that organization's tenant processing.
- Existing per-tenant database locks remain in place.
- Detailed `[monitor]` and `[alerts]` logging is preserved.

No SQL migration is required.
