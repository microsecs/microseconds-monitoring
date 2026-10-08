# Behavioral learning — Phase 1

This release strengthens the existing incident-feedback learning mechanism without changing the UI, sync queue, AI prompts, or incident threshold.

## What changes
- Feedback is scoped to the exact organization, internal tenant and user.
- Only administrator-verified Safe / Confirm Suspicious feedback is used (Dismiss is not learning evidence).
- Evidence expires from scoring after 90 days, limiting permanent trust.
- A single Safe decision reduces risk by only 4–6 points; multiple confirmations can reach at most 12 points.
- Suspicious feedback adds a bounded 7–25 points depending on specificity and repeated confirmation.
- Exact IP matches or matching network **and** city/country are required; matching country alone is insufficient.
- Conflicting Safe and Suspicious feedback blocks the trust reduction and records the conflict for AI context.
- No new database tables, SQL migrations, environment variables, or visual changes.

## Caveats and next steps
- This is *structured feedback learning*, not yet a continuously updated behavioral profile or model training.
- Existing incident_feedback records are reused. Verify the table and 2026-10-07 incident feedback migration are installed.
- Existing incidents are not rescored. The changes affect future incident evaluations only.
- The existing engine still allows AI recommendations to raise scores. That behavior is unchanged here.
- Before broad rollout, test with two tenant connections to the same external Microsoft tenant and verify cross-organization isolation.
- Phase 2 should add evidence snapshots and reproducible scoring traces, then compare against historical labeled incidents.
