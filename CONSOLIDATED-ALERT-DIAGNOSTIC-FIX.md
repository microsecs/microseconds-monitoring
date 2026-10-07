# Consolidated Alert Diagnostic / Retry Fix

Changes:
- Adds explicit Vercel logging for alert candidate collection, recipients, Resend submission, acceptance/rejection, and skip reasons.
- Every incident created at the configured incident threshold is email-eligible when Email Alerts are enabled; there is no hidden second threshold.
- Existing unalerted incidents encountered by the next automatic monitoring pass are eligible for retry, so a missed/failed Resend submission is not immediately lost.
- Manual Sync, Sync All, and Product Admin diagnostic still do not send customer alert emails.
