# Behavioral learning — all-organization activation

Live conservative behavioral scoring is enabled for **all organizations** by default for sign-ins dated **October 24, 2026 00:00 UTC or later**. The activation boundary prevents older imported sign-ins from being promoted retroactively.

Each user's behavioral history is scoped to their own organization, provider, tenant, and user. No cross-customer baseline sharing occurs.

Safeguards:
- At least 10 prior successful sign-ins within 90 days before behavioral novelty adjustments.
- A single unfamiliar attribute does not increase risk.
- New IP + country: +8; add an unfamiliar application: +4 more (maximum +12).
- New IP + application without a country change: +4.
- Verified-safe matching feedback prevents novelty increases unless conflicting confirmed-suspicious feedback exists.
- No automatic incident dismissal, risk reductions from familiarity, or alert suppression.
- Shadow assessments remain active and record the original pre-behavior score.
- Failure to evaluate behavior leaves existing risk scoring intact.

## Controls

- `BEHAVIORAL_LIVE_DISABLED=true`: global emergency stop (redeploy after changing Vercel environment variables).
- `BEHAVIORAL_LIVE_EXCLUDED_ORG_IDS`: comma-separated internal organization UUIDs to exclude (redeploy).
- `BEHAVIORAL_LIVE_ROLLOUT_STARTED_AT`: optional ISO UTC activation time override; defaults to `2026-10-24T00:00:00Z`.

No allowlist or new Supabase migration is required. Previously created incidents are not rescored. Review Product Admin → Behavioral Learning regularly.
