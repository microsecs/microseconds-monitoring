# Automatic Monitoring Multi-Organization Diagnostics

This build does not change tenant-selection or synchronization semantics.

Inspection of the current source confirmed that Microsoft automatic sync is already scoped by both the MicroSECONDS organization ID and the internal Microsoft tenant record ID. There is no external Microsoft tenant-ID deduplication in `automaticMonitoring.ts`, `graphSync.ts`, or the tenant sync lock path.

The monitoring logs have been expanded to include the MicroSECONDS organization name for every tenant result and to explicitly report organizations skipped because their subscription is not writable. The summary also reports eligible organizations processed and subscription-skipped counts.

Examples:

    [monitor] MicroSECONDS Computer Consulting / Microsoft 365 - Servpro of San Diego East: SYNCED — 0 incident(s)
    [monitor] Test Customer / Microsoft 365 - Servpro of San Diego East: SYNCED — 0 incident(s)
    [monitor] ORG - Test Customer: SKIPPED — subscription status inactive

This makes the next scheduled run sufficient to distinguish an organization eligibility/configuration issue from a tenant synchronization issue without changing production behavior speculatively.

No SQL or environment changes are required.
