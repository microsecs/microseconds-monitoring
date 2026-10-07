# Email alert and CSV identity display polish

- Security alert email addresses are rendered as plain light text and discouraged from email-client auto-link styling.
- Security alert location falls back to cached `ip_intelligence` city/region/country when the sign-in candidate itself has not yet been refreshed after enrichment.
- CSV parsing now prefers explicit UPN/Username/email columns over a generic `User` column, and uses a distinct generic User value as the friendly display name when both are present.
- No database migration or environment-variable changes are required.
