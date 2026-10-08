# Phase 2C: Behavioral Learning diagnostics

Product Admin → Behavioral Learning displays shadow assessment totals, changed/unchanged scores, recent evidence and pagination, with organization, tenant and time filters.

- Read-only. No modifications to scoring, incident thresholds, alerting, or worker queue.
- Requires the existing Phase 2B `behavior_shadow_assessments` table.
- No new SQL or environment variables.
- Accuracy validation against verified administrator decisions and threshold-crossing simulation are **not yet implemented**. These require a separate evaluation phase before activation.
- Filters are server-side and access requires Product Admin authentication.
