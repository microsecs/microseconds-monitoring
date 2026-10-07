# Incident feedback learning

- Removes the Investigating workflow from active incidents.
- Mark Safe resolves the incident, moves it to dismissed history, and records bounded trusted feedback for that user/tenant.
- Dismiss resolves the incident and remains neutral; it does not teach the detector.
- Confirm Suspicious resolves the incident, moves it to dismissed history, and records confirmed-suspicious feedback.
- Future candidate scoring can use closely matching prior feedback (exact IP, or matching network/ASN plus location). This is deliberately bounded and is not a blanket whitelist.
- Relevant feedback is also supplied to the second-stage AI reviewer.
- Dismissed history retains the explicit resolution.

Run `sql/2026-10-07-incident-feedback-learning.sql` before deploying this build.
