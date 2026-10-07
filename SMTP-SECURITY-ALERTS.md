# SMTP security-alert update

Consolidated incident alerts now use the same Resend SMTP service as the application's authentication email configuration instead of calling the Resend HTTP API.

## Vercel Production environment variables

The SMTP password configured inside Supabase Authentication is not exposed to the Next.js application, so add the same SMTP credential to Vercel:

- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=465`
- `SMTP_USER=resend`
- `SMTP_PASSWORD=<the same Resend SMTP/API credential used by Supabase SMTP>`
- `SECURITY_ALERT_FROM=MicroSECONDS Monitoring <monitoring@microseconds.com>`

`RESEND_SMTP_PASSWORD` is also accepted as an alternative to `SMTP_PASSWORD`.

Redeploy after adding the variables.

The consolidated batching, per-recipient incident delivery tracking, retry behavior, and `[alerts]` diagnostics are unchanged. Successful logs now say `SMTP accepted`.
