# Google identity repair + incident duplicate guard

- Google friendly-name repair now runs during both manual Sync Now and automatic monitoring.
- Existing Google sign-in rows are repaired case-insensitively when a real Directory/historical display name is known.
- Incident UI no longer prints the email twice when display name and principal/email are identical.
- Security alert email already had the same duplicate guard and remains unchanged.
- No SQL or environment changes required.
