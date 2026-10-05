# MicroSECONDS Monitoring Product Admin

The Product Admin console is available at `/admin` only to the configured product-owner email.

## Vercel environment variable

Set:

`PRODUCT_ADMIN_EMAIL=your-product-owner-email@example.com`

Use the same email address as your MicroSECONDS product-owner login. If this variable is not set, the application falls back to `BOOTSTRAP_OWNER_EMAIL`.

## Current console

- Customer organization count
- Connected Microsoft 365 and Google Workspace tenant counts
- Automatic Monitoring adoption
- User count
- 30-day sign-in volume
- 30-day incident volume
- Existing plan/subscription status
- Customer owner email
- Customer detail pages with users, tenants, monitoring, usage, and billing placeholders

Stripe customer, renewal, revenue, trial-management, and subscription-management controls are intentionally reserved for the Stripe integration.
