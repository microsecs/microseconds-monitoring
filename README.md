# MicroSECONDS 365 Security

Standalone, SaaS-ready Microsoft 365 sign-in security monitoring application.

## Included in this starter
- Multi-organization database model
- Multiple Microsoft tenants per organization
- Subscription-ready plan fields
- Dashboard UI
- Microsoft authorization route placeholder
- Microsoft Graph sign-in client
- Risk scoring engine
- IP intelligence data model

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Create a separate Supabase project and run `supabase/schema.sql`
4. Create a Microsoft Entra multi-tenant app registration
5. Add the required Microsoft Graph application permission for sign-in logs and configure the redirect URI
6. Fill in the environment variables
7. `npm run dev`

## Security note
Do not store Microsoft refresh tokens directly in ordinary database columns. Store only an encrypted token reference / secret-manager reference in `microsoft_tenants.token_secret_ref`.
