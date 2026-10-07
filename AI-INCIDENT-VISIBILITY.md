# AI Incident Visibility

The Incidents page now visibly identifies incidents that were reviewed by the second-stage AI risk reviewer.

For AI-reviewed incidents it displays:
- AI Review label
- AI classification (LOW, SUSPICIOUS, or CRITICAL)
- AI confidence percentage
- AI assessment/explanation

Incidents created without a successful AI review do not show the AI Review panel. This makes API failures/fallback behavior visible without changing the deterministic rules-based incident trigger.

No additional SQL migration is required beyond `sql/2026-10-07-ai-risk-review.sql` included with the AI Risk Review build.
