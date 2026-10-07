# Microsoft Graph timeout and diagnostics

- Increased Microsoft provider request timeout from 30 seconds to 60 seconds.
- Microsoft Graph failures now identify the operation (sign-in vs organization lookup) in server logs.
- Timeout errors report the configured timeout explicitly.
- Existing incremental checkpoints, CSV-to-automatic checkpoint behavior, tenant isolation, sync locks, and automatic monitoring safety budget are unchanged.
- A failed/timeout sync still does not advance the successful sync checkpoint.
