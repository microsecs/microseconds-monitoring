# Browser-local timestamp fix

Microsoft Graph and Google Workspace event timestamps remain stored as absolute provider timestamps in the database. Server-rendered sign-in, incident, and dashboard event times now use `src/components/LocalDateTime.tsx`, which formats timestamps in the browser after hydration. This prevents Vercel's UTC server timezone from being presented to users as though it were their local time.

No SQL migration or historical data rewrite is required.
