# Microsoft tenant friendly-name repair

- Connection first tries Microsoft Graph /organization; if unavailable, it derives a domain from recent Microsoft sign-in UPNs.
- Subsequent manual or automatic Microsoft syncs repair placeholder names from sign-in UPN domains.
- Custom names are not overwritten by reconnection or automatic repair.
- If /organization is unavailable and no sign-in with a custom-domain UPN exists, the placeholder remains. To obtain the exact organization display name, grant and consent Microsoft Graph application permission Organization.Read.All, then reconnect (or rename manually). The domain fallback is not necessarily the legal organization name.
- No SQL migration or new environment variables. Monitoring queue and incident detection unchanged.
