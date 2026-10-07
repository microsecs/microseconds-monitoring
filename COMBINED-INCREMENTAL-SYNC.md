# Combined Microsoft + Google incremental automatic sync

Automatic monitoring now uses provider-specific incremental checkpoints for both Microsoft 365 and Google Workspace.

- Microsoft: last successful sync minus 10-minute overlap; follows Graph paging up to 10,000 sign-ins per automatic pass; first/no-checkpoint pass remains bounded to 250.
- Google: last successful sync minus 10-minute overlap; Reports API paging up to 10,000 events; first/no-checkpoint automatic pass bounded to 250.
- Google automatic runs no longer enumerate the entire Workspace directory or repair all historical missing-IP rows. Those expensive repair operations remain on manual sync.
- Checkpoints are only advanced after a successful provider/database sync.
- Existing per-organization/per-tenant deduplication and isolation remain unchanged.
