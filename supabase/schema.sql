create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',
  subscription_status text not null default 'inactive',
  trial_ends_at timestamptz,
  max_tenants int not null default 1,
  max_users int not null default 50,
  retention_days int not null default 30,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','admin','analyst','viewer')),
  primary key (organization_id,user_id)
);

create table microsoft_tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  connected_at timestamptz not null default now(),
  token_secret_ref text,
  unique(organization_id,tenant_id)
);

create table signins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  microsoft_tenant_id uuid not null references microsoft_tenants(id) on delete cascade,
  graph_signin_id text not null,
  user_principal_name text,
  created_at timestamptz not null,
  ip_address inet,
  city text,
  state text,
  country text,
  app_name text,
  client_app text,
  browser text,
  operating_system text,
  success boolean,
  microsoft_risk text,
  raw jsonb,
  unique(microsoft_tenant_id,graph_signin_id)
);

create table ip_intelligence (
  ip_address inet primary key,
  asn text,
  organization text,
  city text,
  region text,
  country text,
  is_vpn boolean,
  is_proxy boolean,
  is_tor boolean,
  is_hosting boolean,
  fraud_score int,
  last_checked_at timestamptz not null default now(),
  raw jsonb
);

create table security_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  signin_id uuid not null references signins(id) on delete cascade,
  risk_score int not null,
  risk_level text not null,
  reasons jsonb not null default '[]'::jsonb,
  disposition text check (disposition in ('new','safe','investigate','confirmed_suspicious')) default 'new',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
