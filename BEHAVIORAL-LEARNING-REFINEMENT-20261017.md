# Behavioral Learning refinement (shadow only) — 2026-10-17

The shadow-only behavioral assessment has been made more conservative based on exported shadow and incident outcomes.

- Minimum 10 prior successful sign-ins within 90 days for any novelty-based shadow risk increase (previously 5).
- A single new IP, country or application does not increase shadow risk.
- New IP **and** country: +8; additionally new application: +4 (12 maximum).
- New IP **and** application, without new country: +4.
- Matching administrator-verified safe feedback suppresses novelty-based shadow increases unless conflicting suspicious feedback is present. The live feedback score is already applied upstream; shadow does not apply it again.
- Novelty flags, history maturity, and policy version are recorded in the existing evidence JSON; no schema migration is needed.
- No changes to live incident scoring, incident eligibility, alerts, thresholds, or critical rules.

## Validation
Continue in shadow mode. The Product Admin Behavioral Learning page already compares assessments with incident outcomes and configured thresholds. Assessments are computed on newly processed sign-ins; historical rows are not automatically rescored. Re-export assessments and incidents after a representative observation period. Dismissed incidents are not verified safe. No confirmed suspicious outcomes were present in the initial exported dataset, so detection sensitivity remains unverified.
