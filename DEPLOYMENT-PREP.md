# MicroSECONDS Monitoring - Production Deployment Prep

This source is prepared to run locally and later on Vercel without hard-coding the application hostname.

## Canonical application URL

Local development defaults to:

    http://localhost:3000

For production, set:

    APP_URL=https://monitoring.microseconds.com

`NEXT_PUBLIC_APP_URL` is also recognized, but `APP_URL` is preferred because the current URL consumers are server-side.

## OAuth callback URLs

By default the application derives these from `APP_URL`:

    Microsoft: ${APP_URL}/api/microsoft/callback
    Google:    ${APP_URL}/api/google/callback

Existing provider-specific environment variables remain supported and take precedence:

    MICROSOFT_REDIRECT_URI
    GOOGLE_REDIRECT_URI

This means your existing local `.env.local` does not have to change immediately.

Before production launch, add the production callback URLs to the Microsoft Entra app registration and Google Cloud OAuth client. Keep localhost callbacks while local development is still needed.

## Automatic monitoring / cron

`/api/cron/monitor` now accepts both GET and POST. This preserves local/manual POST use and makes the route compatible with Vercel Cron GET requests. It still requires:

    Authorization: Bearer <CRON_SECRET>

`/api/cron/license-check` already accepts GET and uses the same protection.

## Environment variables found in this source

Production will need the applicable values currently used locally, including:

- APP_URL
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- MICROSOFT_REDIRECT_URI (optional override)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI (optional override)
- GOOGLE_TOKEN_ENCRYPTION_KEY
- SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
- IPINFO_TOKEN
- RESEND_API_KEY
- SUPPORT_EMAIL_TO
- SUPPORT_EMAIL_FROM
- SECURITY_ALERT_FROM
- CRON_SECRET
- OPENAI_API_KEY (if AI incident summaries are enabled)
- OPENAI_INCIDENT_MODEL (optional)
- DEV_ORGANIZATION_SLUG
- DEV_ORGANIZATION_NAME

## Still required before first Vercel deployment

The source archive used for this prep contains only the `src` tree. The full project root is still needed to verify and prepare:

- package.json / lock file
- next.config.*
- tsconfig.json
- public assets
- Vercel cron configuration (vercel.json if used)
- complete production build
- any root-level middleware or configuration

Do not switch DNS to monitoring.microseconds.com until the temporary Vercel deployment has been tested successfully.
