# Risk assessment transparency

Sign-in History retains the existing table and Risk column. When the incident score differs from the finding score, the Risk column now shows saved incident-specific reasons and the saved AI review summary/classification, where available. These are the actual explanations recorded at incident creation, not reconstructed point allocations.

The initial sign-in score and the final incident score may differ because the incident engine applies IP intelligence, behavioral baseline, admin feedback, and optionally the AI-recommended score. The AI-recommended number is not itself evidence that the added points correspond to new distinct signals. No risk threshold, scoring rule, queue, or incident detection behavior was changed.

No SQL or environment changes. Build verification requires npm dependencies.
