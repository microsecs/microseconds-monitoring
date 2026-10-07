# Consolidated security-alert emails

## Behavior
- Scheduled `/api/cron/monitor` runs automatic monitoring with `sendAlerts:true`.
- New alert-worthy incidents from all Microsoft 365 and Google Workspace tenants are collected per organization.
- At most one consolidated email is sent to each configured alert recipient for that organization/run.
- Manual Sync Now, Sync All, and Product Admin Run Monitoring Now do not send customer incident alerts.
- Successfully delivered incident/recipient pairs are recorded in `incident_email_alert_log`, preventing repeat delivery on later runs.
- Failed Resend deliveries are not recorded, allowing a later run to retry.
- Sender uses `SECURITY_ALERT_FROM`, with fallback `MicroSECONDS Monitoring <monitoring@microseconds.com>`.

## Deployment
Run `sql/2026-10-06-consolidated-incident-email-alerts.sql` in Supabase before deploying the code.
