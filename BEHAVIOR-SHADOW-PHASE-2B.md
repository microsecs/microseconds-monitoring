# Phase 2B — Shadow scoring

Run `2026-10-08-behavior-shadow-assessments.sql` in Supabase before deployment.

New successful sign-ins passing incident processing write one row to `behavior_shadow_assessments`.
The shadow score adds bounded novelty signals only after 5 prior successful sign-ins.
Repeated observed activity never reduces risk; feedback adjustments already included in the live score are not applied twice.

No changes to live incident scores, AI, thresholds, alerts, queue, or Sign-in History.
Failures writing shadow telemetry are logged but never block monitoring.

Example validation query:

```sql
select provider, organization_id, tenant_record_id, event_time, live_score,
 proposed_score, adjustment, reasons
from public.behavior_shadow_assessments
order by updated_at desc limit 30;
```

Shadow assessments are generated only for newly evaluated successful sign-ins, not for already-existing incidents. Compare assessments with administrator decisions before enabling any live scoring.
