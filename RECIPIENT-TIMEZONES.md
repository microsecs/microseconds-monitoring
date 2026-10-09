# Recipient-specific notification timezones

1. Run `sql/2026-10-09-recipient-notification-timezones.sql` in Supabase SQL Editor before deploying.
2. Deploy the updated application.
3. Open customer Notifications, enter alert email addresses, choose each recipient timezone, and save.
4. Product Admin test sender includes a timezone selector for preview emails.

Stored times remain UTC; formatting is done per recipient when sending. Existing recipients with no selected timezone retain the Pacific fallback. Daylight saving time is handled using IANA timezones.
