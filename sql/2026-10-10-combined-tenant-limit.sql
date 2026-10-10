-- Enforce 50 total Microsoft 365 + Google Workspace tenant connections per organization.
-- Run once in Supabase SQL Editor before deploying the application.
-- Lock the parent organization row to serialize inserts across BOTH tenant tables.
CREATE OR REPLACE FUNCTION public.enforce_combined_tenant_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ms_count bigint;
  google_count bigint;
BEGIN
  PERFORM 1 FROM public.organizations WHERE id = NEW.organization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = '23503';
  END IF;

  SELECT count(*) INTO ms_count FROM public.microsoft_tenants WHERE organization_id = NEW.organization_id;
  SELECT count(*) INTO google_count FROM public.google_workspace_tenants WHERE organization_id = NEW.organization_id;
  IF ms_count + google_count >= 50 THEN
    RAISE EXCEPTION 'Tenant limit reached (50). Delete an existing tenant before adding another.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_combined_tenant_limit_ms ON public.microsoft_tenants;
CREATE TRIGGER enforce_combined_tenant_limit_ms
BEFORE INSERT ON public.microsoft_tenants
FOR EACH ROW EXECUTE FUNCTION public.enforce_combined_tenant_limit();

DROP TRIGGER IF EXISTS enforce_combined_tenant_limit_google ON public.google_workspace_tenants;
CREATE TRIGGER enforce_combined_tenant_limit_google
BEFORE INSERT ON public.google_workspace_tenants
FOR EACH ROW EXECUTE FUNCTION public.enforce_combined_tenant_limit();
