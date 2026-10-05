# MicroSECONDS Monitoring — Supabase / Resend email setup

## Custom SMTP

In Supabase, open **Authentication → SMTP Settings** and enable custom SMTP.

Use your existing Resend SMTP credentials:

- Sender name: `MicroSECONDS Monitoring`
- Sender email: `monitoring@microseconds.com`
- SMTP host: `smtp.resend.com`
- SMTP port: `465` (TLS/SSL) or your existing working Resend SMTP port
- SMTP username: `resend`
- SMTP password: your Resend API key / SMTP credential

The `microseconds.com` domain must be verified in Resend.

## Confirm signup template

Subject:

`Confirm your MicroSECONDS Monitoring account`

HTML body:

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#17212b;line-height:1.55">
  <h2 style="margin-bottom:8px">Welcome to MicroSECONDS Monitoring</h2>
  <p>Confirm your email address to finish creating your MicroSECONDS Monitoring account.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#087f8c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:7px;display:inline-block;font-weight:700">Confirm Email Address</a>
  </p>
  <p>If you did not create this account, you can ignore this email.</p>
  <p style="font-size:12px;color:#667085;margin-top:30px">MicroSECONDS Monitoring</p>
</div>
```

## Reset password template

Subject:

`Reset your MicroSECONDS Monitoring password`

HTML body:

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#17212b;line-height:1.55">
  <h2 style="margin-bottom:8px">Reset your password</h2>
  <p>We received a request to reset the password for your MicroSECONDS Monitoring account.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#087f8c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:7px;display:inline-block;font-weight:700">Reset Password</a>
  </p>
  <p>If you did not request a password reset, you can ignore this email. Your password will not change unless you use the link above.</p>
  <p style="font-size:12px;color:#667085;margin-top:30px">MicroSECONDS Monitoring</p>
</div>
```

## Application-generated security alerts

The application now defaults security alerts to:

`MicroSECONDS Monitoring <monitoring@microseconds.com>`

If `SECURITY_ALERT_FROM` is defined in Vercel, that environment variable still overrides the default. To standardize existing production configuration, set:

`SECURITY_ALERT_FROM=MicroSECONDS Monitoring <monitoring@microseconds.com>`

Then redeploy.
