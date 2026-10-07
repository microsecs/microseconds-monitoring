# Tenant sync UI cleanup

- Background sync locks no longer replace Last Activity with `Syncing…`.
- Sync buttons retain the `Sync` label while a background lock is active (the lock still disables the action to prevent collisions).
- Reconnect links are shown directly below tenant health only for `reconnect_required`, not ordinary `problem`/timeout states.
- Microsoft reconnect uses the existing admin-consent flow; reconnecting the same Microsoft tenant updates its existing organization-scoped tenant record rather than creating a duplicate.
- Google reconnect is likewise exposed only for `reconnect_required`.
- Existing status popup/manual-sync behavior and backend sync locks are unchanged.
