# MicroSECONDS Monitoring — Stripe Billing Setup

This build uses Stripe-hosted Checkout, Stripe Customer Portal, and signed Stripe webhooks.

## Supabase migration
Run `sql/2026-10-05-stripe-billing-foundation.sql` before deploying.

## Vercel environment variables
Start with Stripe TEST-mode values:
- `STRIPE_SECRET_KEY` — test secret key (`sk_test_...`)
- `STRIPE_PRICE_ID` — recurring monthly test Price ID (`price_...`)
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint (`whsec_...`)

Keep `APP_URL=https://monitoring.microseconds.com` in Production.

## Stripe webhook endpoint
Configure Stripe to send events to:
`https://monitoring.microseconds.com/api/stripe/webhook`

Subscribe to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Customer Portal
Enable the Stripe Customer Portal in Stripe Billing settings. Recommended cancellation behavior is cancel at period end.

## Lifecycle
- Account creation starts the app-managed 30-day trial; no card is required.
- Subscribe Now opens Stripe Checkout for the configured flat monthly Price.
- Signed Stripe subscription webhooks change the organization to `active`, `past_due`, or `canceled`.
- Manage Subscription opens Stripe Customer Portal for payment method, invoices, and cancellation.
- The browser success redirect does not activate access; Stripe webhooks are authoritative.
