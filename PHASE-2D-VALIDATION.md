# Phase 2D — Learning validation

Product Admin → Behavioral Learning now displays administrator outcome and threshold-impact diagnostics for the current paginated result set. The four validation counters are page-scoped (50 rows maximum), not aggregate global accuracy measures.

- Administrator decisions are matched to sign-ins using both `organization_id` and `signin_id`. Dismissed and unreviewed are not labeled Safe.
- Threshold impact compares the deterministic live score and the proposed shadow score using the organization's **current** incident threshold. It is a hypothetical comparison, not a reconstruction of the threshold at the original event time.
- The `live_score` in the shadow table is the pre-AI score. An AI-raised incident score may differ from it.
- All calculations are read-only; no live scoring, alerts, incident creation, or Sign-in History changes.
- This page is not a model accuracy estimate. Meaningful accuracy validation requires representative reviewed outcomes and historical threshold snapshots.

No database migrations or environment changes.
