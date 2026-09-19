-- ============================================================================
-- Black Shades Home Decors — OTP-verified database authorization
-- Step 3D: closes the gap left by Step 3B.1. Since Step 3B, `authenticated`
-- RLS policies grant decor_items writes to ANY signed-in Supabase user —
-- but "signed in" only means email+password succeeded. The custom OTP step
-- (Step 3C.1/3C.2) is enforced by React's ProtectedRoute and by the Worker's
-- OTP-proof check, but NEITHER of those lives in the database: a
-- password-only session's access token could always be used to call
-- Supabase's REST API directly and write to decor_items, bypassing
-- ProtectedRoute and the Worker entirely. This migration makes the
-- database itself aware of OTP verification via a JWT claim, so that
-- direct API access is governed by the same rule as everything else.
--
-- Mechanism (Postgres Custom Access Token Hook — a standard Supabase Auth
-- feature, not a paid add-on, confirmed present in this project's
-- supabase/config.toml template and supported by the locally installed
-- GoTrue v2.195.0): every time GoTrue mints an access token (sign-in OR
-- token refresh), it calls public.custom_access_token_hook(event), which
-- reads a small server-only table (otp_authorizations) and stamps
-- `app_metadata.otp_verified` into the token's claims accordingly. RLS
-- policies below then require that claim, in addition to the `authenticated`
-- role, for decor_items writes.
--
-- otp_authorizations is the actual server-controlled authorization signal.
-- It is written ONLY by the Worker, using the service-role key (a Worker
-- secret — see worker/.dev.vars — never sent to React/the browser), right
-- after a successful /api/dev/otp/verify. `authenticated` and `anon` (the
-- only roles the browser can ever act as, always via the public anon key)
-- have ZERO privileges on this table — see the REVOKE below — so it is
-- structurally impossible for client-side JavaScript to set or forge OTP
-- authorization, regardless of what it puts in localStorage, sessionStorage,
-- a request header, or a request body.
-- ============================================================================

-- --------------------------------------------------------------------------
-- otp_authorizations
-- --------------------------------------------------------------------------
create table if not exists public.otp_authorizations (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.otp_authorizations is
  'Server-controlled record of successful custom OTP verification (Step 3C.1/3C.2 DEV OTP; later Twilio Verify). Read only by custom_access_token_hook() to decide whether to mint the app_metadata.otp_verified claim. Written only by the Worker via the service-role key. authenticated/anon have no privileges here by design — see the REVOKE below — so the browser can never set or forge this.';

alter table public.otp_authorizations enable row level security;
-- No policies are created for this table on purpose: the REVOKE below
-- already reduces authenticated/anon to zero privileges (RLS policies can
-- only ever narrow what a GRANT already permits, so an absent GRANT means
-- there is nothing for a policy to permit anyway). service_role bypasses
-- RLS entirely (confirmed: `service_role` carries the BYPASSRLS attribute
-- in this local install), which is what the Worker's writes rely on.
revoke all on public.otp_authorizations from authenticated, anon, public;
grant select, insert, update, delete on public.otp_authorizations to service_role;

-- --------------------------------------------------------------------------
-- custom_access_token_hook — stamps app_metadata.otp_verified into every
-- newly-minted access token (sign-in and refresh alike).
-- --------------------------------------------------------------------------
-- SECURITY DEFINER + a locked-down search_path is the standard safe pattern
-- for hook functions: GoTrue invokes this as `supabase_auth_admin`, which
-- (confirmed locally) does NOT have BYPASSRLS or blanket table access, so
-- SECURITY DEFINER lets the function run with its owner's privileges
-- instead of granting supabase_auth_admin broad direct table access. The
-- empty search_path plus fully-qualified `public.otp_authorizations`
-- prevents search_path-hijacking attacks against SECURITY DEFINER
-- functions.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  otp_expires_at timestamptz;
  otp_valid boolean := false;
begin
  claims := event->'claims';

  select expires_at into otp_expires_at
  from public.otp_authorizations
  where user_id = (event->>'user_id')::uuid;

  if otp_expires_at is not null and otp_expires_at > now() then
    otp_valid := true;
  end if;

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- Nested under app_metadata, not top-level and not URL-namespaced: this
  -- matches Supabase's own documented custom-claim convention for this
  -- hook (see the official custom-access-token-hook example), rather than
  -- an arbitrary choice.
  claims := jsonb_set(claims, '{app_metadata, otp_verified}', to_jsonb(otp_valid));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ----------------------------------------------------------------------------
-- Enable the hook (local dev). In supabase/config.toml this is the
-- equivalent of uncommenting:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
-- That change is applied separately in config.toml itself (see the Step 3D
-- report) — config.toml is not a database migration and Supabase does not
-- let a SQL migration toggle it, so this comment exists purely so the
-- config change and this migration are never reviewed apart from each
-- other.
-- ----------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- decor_items — require the otp_verified claim for writes
-- --------------------------------------------------------------------------
-- Replaces the Step 3B.1 policies, which allowed ANY authenticated session
-- to write. The GRANT from 002_authenticated_write_access.sql
-- (insert/update/delete to `authenticated`) is intentionally left as-is —
-- GRANT only decides whether a role may attempt the operation at all; RLS
-- below is what actually restricts it to OTP-verified sessions. An
-- authenticated-but-not-otp-verified request still passes the GRANT check
-- but matches zero rows under these policies, so PostgREST reports it as
-- a permission/RLS failure exactly like an anon write does today.
drop policy if exists "Authenticated admin can insert decor_items" on public.decor_items;
drop policy if exists "Authenticated admin can update decor_items" on public.decor_items;
drop policy if exists "Authenticated admin can delete decor_items" on public.decor_items;

create policy "OTP-verified admin can insert decor_items"
  on public.decor_items
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true');

create policy "OTP-verified admin can update decor_items"
  on public.decor_items
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true');

create policy "OTP-verified admin can delete decor_items"
  on public.decor_items
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true');

-- categories: intentionally untouched. The Admin Portal only ever SELECTs
-- categories (src/services/galleryService.js has no category write path),
-- so — per Step 3B.1's same reasoning — no OTP-gated write policy is added
-- here. Its existing public/authenticated SELECT policy from
-- 001_initial_schema.sql is unaffected by this migration.
