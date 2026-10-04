/**
 * Canonical application URL helpers.
 *
 * Local development works without any URL environment variables.
 * Production should set APP_URL=https://monitoring.microseconds.com.
 * Provider-specific redirect URI variables remain supported as overrides.
 */
export function appUrl() {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (configured || "http://localhost:3000").replace(/\/$/, "");
}

export function microsoftRedirectUri() {
  return process.env.MICROSOFT_REDIRECT_URI || `${appUrl()}/api/microsoft/callback`;
}

export function googleRedirectUriFromApp() {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl()}/api/google/callback`;
}
