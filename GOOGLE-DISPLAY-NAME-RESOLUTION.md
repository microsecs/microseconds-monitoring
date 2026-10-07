# Google display-name resolution fix

Automatic Google Workspace sync now preserves friendly user names without restoring an expensive full-directory scan on every hourly run.

- Reuses a friendly name already stored for the same Google tenant and email address.
- Performs a targeted Google Directory lookup only for active users whose friendly name is not already known.
- Repairs stored sign-in rows for resolved users, including recent rows that were saved with only an email address.
- Leaves `user_display_name` null when Google genuinely has no friendly name; Sign-in History then shows the email once rather than duplicating it.
- Full directory enumeration remains limited to manual/non-automatic Google sync behavior.
