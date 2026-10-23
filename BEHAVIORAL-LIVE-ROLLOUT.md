# Behavioral learning — controlled live rollout

The conservative October 17 behavioral scoring algorithm is available for live incidents behind a two-part, **default-off** Vercel environment gate.

Configure both production environment variables:
- `BEHAVIORAL_LIVE_ROLLOUT_ORG_IDS`: comma-separated **internal organizations.id UUIDs** explicitly approved for the pilot (not external Microsoft tenant IDs). Start with one organization.
- `BEHAVIORAL_LIVE_ROLLOUT_STARTED_AT`: UTC ISO-8601 timestamp at or after the activation time, e.g. `2026-10-23T22:00:00Z`. This prevents previously imported sign-ins from creating new incidents retroactively.

Redeploy after setting these variables. Until **both** are set, no behavioral adjustment affects live scoring.

Safeguards:
- The algorithm is shared with shadow telemetry and requires >=10 prior successful sign-ins in the preceding 90 days.
- A single unfamiliar IP, country, or application contributes zero points.
- A new IP and country contributes +8; an additional new application contributes +4; a new IP and application alone contributes +4.
- Matching verified-safe feedback suppresses novelty increases unless conflicting suspicious feedback exists.
- No behavioral trust reduction, incident dismissal, alert suppression, or changes to incident thresholds.
- The original pre-behavior score remains recorded in `behavior_shadow_assessments.live_score` for comparison; existing incident records are not re-scored.
- If behavioral evaluation fails, normal incident scoring proceeds without behavioral adjustments.

To disable immediately, remove the organization UUID from `BEHAVIORAL_LIVE_ROLLOUT_ORG_IDS` (or clear it), and redeploy. Existing incidents are not deleted or modified.

Monitor Product Admin → Behavioral Learning, review verified Safe / Confirm Suspicious outcomes and threshold crossings, and expand the allowlist only after pilot results are satisfactory.
