# CSV risk display fix

This update fixes CSV-imported sign-ins appearing yellow even when they have no actual risk score.

Changes:
- Normal CSV rows now save an empty `reasons` array instead of storing "No suspicious indicators found in available data" as a risk reason.
- Sign-in History only highlights a row when it has a positive numeric risk score and at least one real risk reason.
- Existing imported rows containing the old informational reason are treated as normal without requiring a database cleanup.
- Numeric risk values returned by Supabase as either numbers or numeric strings display consistently.
- Microsoft/Google/CSV history uses the same display rule: no actual risk means no warning highlight.

No SQL migration is required.
