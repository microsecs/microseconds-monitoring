# CSV to Automatic Microsoft Monitoring fix

- A successful capability check now confirms Graph access, enables automatic monitoring, and clears stale timeout/problem health state.
- A timed-out capability check does not change tenant capability or connection state.
- A Microsoft tenant that previously used CSV uses its latest CSV import time as the first Graph incremental checkpoint (with the existing 10-minute overlap).
- The hourly monitor uses the same CSV checkpoint, so a newly licensed tenant cannot accidentally receive a large first-history request before a manual sync.
- Timeout/aborted sync failures are displayed as `Sync Delayed` instead of the misleading `Connection Problem` badge.
- No schema migration is required.
