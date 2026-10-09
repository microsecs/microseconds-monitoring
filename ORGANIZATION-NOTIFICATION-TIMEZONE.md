# Notification timezone per organization

Run `sql/2026-10-09-organization-notification-timezone.sql` in Supabase SQL Editor before deploying.

The Notifications settings page now shows one timezone dropdown shared by all alert recipients for that organization. Product Admin test timezone remains independent. Stored sign-in timestamps stay UTC. The old `recipient_time_zones` column may remain unused; do not drop it during deployment.
