# Sign-in History risk score explanation

The Risk column layout is unchanged. When an incident assessment overrides the original security finding score, the existing indicator text gains a concise line identifying the score difference and original finding score. If the final score matches a higher AI recommendation, that is explicitly identified. This prevents an incident-adjusted score from appearing to be explained solely by the sign-in finding reasons.

No scoring rules, thresholds, synchronization, deduplication, or incident generation are changed. Existing incident reasons are still shown as stored. This does not reconstruct individual historical rule point contributions; those were not persisted as a per-rule breakdown. No SQL or environment changes.
