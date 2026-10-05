# 30-Day Trial / Subscription Foundation

## 1. Run the Supabase migration
Run `sql/2026-10-05-trial-subscription-foundation.sql` in the Supabase SQL editor before deploying this version.

## 2. New-customer behavior
When an authenticated user has no organization membership, the application creates a new organization with:
- `plan = trial`
- `subscription_status = trialing`
- `trial_started_at = current time`
- `trial_ends_at = current time + 30 days`

The existing bootstrap/product-admin organization is claimed as before and is not converted into a trial.

## 3. Trial access
A valid trial has full product access. The application shows days remaining in a status banner.

When the trial expires:
- Existing tenants, sign-ins, incidents and settings remain readable.
- Tenant connections, manual sync, CSV imports and settings/incident changes are blocked server-side.
- The hourly automatic-monitoring cron skips the organization.
- The UI shows an expired-trial banner and points to Account > Plan & Billing.

`past_due` currently acts as a billing grace state and remains writable. Stripe can later determine when a past-due account moves to a non-writable state.

## 4. Stripe-ready lifecycle
The application recognizes these statuses:
- `trialing`
- `active`
- `past_due`
- `inactive`
- `canceled`
- effective `expired` when a `trialing` organization's `trial_ends_at` is in the past

Stripe checkout/webhooks can update the same organization record instead of introducing a second subscription state model.

## 5. Existing product owner
`PRODUCT_ADMIN_EMAIL` (falling back to `BOOTSTRAP_OWNER_EMAIL`) is exempt from trial write restrictions so the MicroSECONDS product-owner organization is not accidentally disabled.
