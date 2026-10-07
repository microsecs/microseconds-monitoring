# AI Risk Review

MicroSECONDS Monitoring now uses OpenAI as a second-stage reviewer for successful sign-ins that already cross the deterministic incident threshold.

## Safety behavior
- Existing deterministic scoring remains authoritative for creating an incident candidate.
- AI can raise the effective risk score/severity, but cannot suppress an incident found by the rules engine.
- Missing API key, timeout, malformed response, or OpenAI error falls back to the existing deterministic incident explanation.
- OpenAI requests have a 12-second timeout so AI cannot stall the monitoring run indefinitely.

## Model
Default: `gpt-6-luna` (override with `OPENAI_RISK_MODEL`).

## Required Vercel environment variable
`OPENAI_API_KEY`

Optional:
`OPENAI_RISK_MODEL=gpt-6-luna`

## Database
Run `sql/2026-10-07-ai-risk-review.sql` in Supabase before deploying.

## Product Admin
Product Admin now reports 30-day AI reviews, input/output tokens, and estimated AI cost globally and per customer organization.
