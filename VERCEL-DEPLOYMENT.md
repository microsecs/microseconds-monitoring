# MicroSECONDS Monitoring — Vercel Deployment

## Deployment progression

1. Deploy this project to Vercel and test it on the temporary `*.vercel.app` hostname.
2. Add the production environment variables in Vercel.
3. For temporary-host testing, either set `APP_URL` to that Vercel hostname and add its OAuth callbacks to Microsoft/Google, or continue testing OAuth locally until the custom domain is attached.
4. Add `monitoring.microseconds.com` to the Vercel project.
5. Set production `APP_URL=https://monitoring.microseconds.com`.
6. Add the production callback URLs to Microsoft and Google:
   - `https://monitoring.microseconds.com/api/microsoft/callback`
   - `https://monitoring.microseconds.com/api/google/callback`
7. Remove `MICROSOFT_REDIRECT_URI` and `GOOGLE_REDIRECT_URI` overrides in Vercel unless an explicit override is desired. The app will derive them from `APP_URL`.
8. Verify Microsoft connect/sync, Google connect/sync, Sign-ins, Incidents, IP enrichment, support requests, automatic monitoring, and email alerts.

## Secrets

Copy the values from the current local `.env.local` into Vercel Environment Variables. Do **not** commit or upload `.env.local`.

In particular, keep `GOOGLE_TOKEN_ENCRYPTION_KEY` identical to the current value. Existing encrypted Google refresh tokens depend on it.

Generate a strong `CRON_SECRET` in Vercel. Vercel Cron sends it as a Bearer authorization header to scheduled routes.

## Scheduled jobs

`vercel.json` currently schedules:

- `/api/cron/monitor` — hourly, on the hour.
- `/api/cron/license-check` — daily at 08:17 UTC.

Both routes require `CRON_SECRET`. The monitor route supports GET for Vercel Cron and POST for local/manual use.

## Production URL behavior

The app now uses `APP_URL` as its canonical server-side base URL. If it is absent, it falls back to `http://localhost:3000`, so local development continues to work.

Provider-specific `MICROSOFT_REDIRECT_URI` and `GOOGLE_REDIRECT_URI` values remain supported as overrides.

## Billing

Do not enable subscription enforcement during the initial deployment. First establish a stable production deployment and OAuth flow. Stripe/customer/subscription infrastructure can then be added and tested in Stripe test mode without mixing billing issues into the initial hosting migration.
