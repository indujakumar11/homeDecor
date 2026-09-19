-- ============================================================================
-- Black Shades Home Decors — Admin allowlist + authorization hardening
-- Step 3D.1: closes the gap left by Step 3D. Since Step 3D, the rule was
-- effectively "any Supabase authenticated account + successful custom OTP =
-- admin database/R2 access." That's unacceptable while public signup is
-- enabled ([auth.email] enable_signup = true in supabase/config.toml) —
-- nothing stopped a self-registered, non-admin account from completing the
-- same OTP flow and gaining full decor_items write access. This migration
-- introduces a real server-side admin allowlist and makes BOTH the Worker
-- and the database's own custom_access_token_hook require it, so
-- "authenticated" and "admin" are no longer the same thing.
-- ============================================================================

-- --------------------------------------------------------------------------
-- admin_users — the actual authorization allowlist. Not a credentials
-- table: no password, no OTP secret, nothing but "is this user id allowed
-- to become an OTP-authorized admin, and is that currently enabled."
-- --------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Server-controlled admin allowlist. Membership here (with enabled=true) is required, in addition to a valid public.otp_authorizations record, before custom_access_token_hook() will stamp app_metadata.otp_verified=true. Managed only via migrations/service-role — authenticated/anon have zero privileges (see REVOKE below), so no client-side action can add, remove, or re-enable an admin.';

alter table public.admin_users enable row level security;
-- No policies are defined for this table, on purpose — same reasoning as
-- otp_authorizations (Step 3D): the REVOKE below already reduces
-- authenticated/anon to zero privileges, so there is nothing for a policy
-- to permit. service_role bypasses RLS (BYPASSRLS, confirmed locally) and
-- is the only role that ever touches this table (via the Worker, or via
-- this migration itself).
revoke all on public.admin_users from authenticated, anon, public;
grant select, insert, update, delete on public.admin_users to service_role;

-- --------------------------------------------------------------------------
-- No admin bootstrap in this migration, intentionally.
-- --------------------------------------------------------------------------
-- Earlier versions of this migration inserted a local development test
-- account (looked up by a hardcoded @blackshades.local email) so the admin
-- flow worked out of the box locally. That is a local-dev convenience, not
-- something a migration applied to a real database should ever do — a
-- migration file is version-controlled and shared, and hardcoding a
-- specific person's email or UUID into it (dev or production) is exactly
-- the kind of local-only assumption that must not ship. This migration
-- creates the admin_users table and its authorization model only; it
-- deliberately leaves the table EMPTY. Provisioning the first real admin is
-- a separate, explicit, out-of-band action — e.g. a one-off statement run
-- with the service-role/postgres connection against the target database
-- (never committed to this repo):
--   insert into public.admin_users (user_id, enabled, phone)
--   values ('<real auth.users id>', true, '<real E.164 phone>');
-- Until that is done, admin_users has zero rows, so custom_access_token_hook
-- below can never stamp otp_verified=true for anyone — this is the correct,
-- safe default for a freshly-migrated database, local or production alike.

-- --------------------------------------------------------------------------
-- custom_access_token_hook — now requires BOTH an enabled admin_users row
-- AND a valid (unexpired) otp_authorizations row before stamping
-- app_metadata.otp_verified=true. Redefining (not modifying the migration
-- that first created) this function, exactly as Supabase's own hook
-- mechanism expects — `create or replace function` targeting the same
-- name is the normal, supported way to evolve a hook's logic.
-- --------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  target_user_id uuid;
  is_enabled_admin boolean := false;
  otp_valid boolean := false;
begin
  target_user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  select coalesce(enabled, false) into is_enabled_admin
  from public.admin_users
  where user_id = target_user_id;

  -- Only ever check OTP authorization for accounts that are already an
  -- enabled admin — a non-admin's otp_authorizations row (which should
  -- never exist, since the Worker now also gates writes to that table on
  -- admin status) is irrelevant regardless.
  if is_enabled_admin then
    select exists (
      select 1
      from public.otp_authorizations
      where user_id = target_user_id
        and expires_at > now()
    ) into otp_valid;
  end if;

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  claims := jsonb_set(claims, '{app_metadata, otp_verified}', to_jsonb(is_enabled_admin and otp_valid));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- --------------------------------------------------------------------------
-- decor_items — unchanged policy definitions from 003_otp_verified_rls.sql.
-- --------------------------------------------------------------------------
-- No change needed here: the policies already require
-- `(auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true'`, and that
-- claim itself now can only ever be true for an enabled admin with a valid
-- OTP authorization, per the hook redefinition above. Re-stating this
-- explicitly rather than silently relying on it: INSERT/UPDATE/DELETE on
-- decor_items are gated by the SAME three policies created in
-- 003_otp_verified_rls.sql — "OTP-verified admin can insert/update/delete
-- decor_items" — nothing about them needs to change, because the meaning
-- of the claim they check just became strictly narrower.
