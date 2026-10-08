# Behavioral learning Phase 2 — observation foundation

Run `sql/2026-10-08-user-behavior-profiles.sql` in Supabase SQL Editor **before deployment**.

Successful sign-ins evaluated by the incident processor update an organization-, internal-tenant-, and user-specific 90-day snapshot. Profiles track up to 500 recent sign-ins and the 30 most common values per dimension. These are observed patterns, NOT verified-safe patterns; no profile data is used to adjust scores, AI prompts, incident thresholds, or alert delivery in this phase.

The observation write is best-effort and cannot block incident creation. Historical sign-ins are not backfilled automatically; the profile grows as sign-ins are processed. No UI changes, no additional environment variables, no cron changes. Follow-up phase: add safe-feedback provenance, bounded deterministic adjustments, and diagnostics after validation.
