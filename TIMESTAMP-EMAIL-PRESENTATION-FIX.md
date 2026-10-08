# Timestamp and alert-email presentation fix

- Sign-in History shows browser-local time with seconds and a timezone abbreviation.
- Incidents uses the same formatter for the original sign-in event timestamp.
- Security-alert emails retain original per-event UTC timestamps with seconds.
- Alert emails now show LOW / REVIEW counts so summary totals reconcile.
- Email address text uses a light inline color and invisible word joiners to reduce automatic hyperlinking by email clients.
- No changes to incident detection, deduplication, billing, sync, SQL, or environment variables.
