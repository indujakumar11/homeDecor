-- ============================================================================
-- Black Shades Home Decors — Phase 5A: AAL2 authorization for decor_items
-- ============================================================================
-- Context: Phase 3/4 of the Supabase-native-TOTP migration introduced a
-- SECOND, independent way for an admin to authenticate (Supabase's own
-- aal2, reached via supabase.auth.mfa.verify()) alongside the original
-- Twilio/mock OTP flow (whose success is recorded as the custom
-- app_metadata.otp_verified JWT claim — see 003_otp_verified_rls.sql /
-- 004_admin_authorization_hardening.sql). Phase 4 updated the Worker's own
-- R2-upload/delete authorization to accept EITHER signal
-- (worker/src/index.ts's authorizeAdminRequest), but deliberately left
-- these RLS policies untouched, so an admin who only ever used the new
-- TOTP/aal2 login path could reach aal2 and successfully delete/upload R2
-- objects via the Worker, while their DIRECT Supabase REST writes to
-- decor_items (src/services/galleryService.js — a plain browser-to-Supabase
-- call that never goes through the Worker at all) were silently blocked by
-- RLS, since app_metadata.otp_verified was never true for them. For DELETE
-- specifically this is a silent 0-rows-affected failure (RLS USING clauses
-- filter rather than error), not a visible one — this was diagnosed as a
-- real production bug (Delete Decor appearing to succeed while the R2
-- images were deleted and the database row silently remained).
--
-- This migration closes that gap the same additive way Phase 4 closed it
-- Worker-side: decor_items write policies now accept EITHER
--   (aal2 AND an enabled admin_users row for auth.uid())
--   OR
--   (the existing app_metadata.otp_verified = 'true' claim)
-- Neither condition is weakened or removed — this is a strict OR-widening
-- of who may be authorized, with the exact same underlying admin_users
-- allowlist enforced either way. AAL2 alone is never sufficient: a
-- non-admin Supabase account (signup is open — see
-- supabase/config.toml's [auth.email] enable_signup) that reaches aal2 via
-- its own TOTP enrollment still cannot write, because it has no
-- admin_users row (or has enabled=false).
--
-- SELECT/public-read policies ("Public can read decor_items"/"...categories"
-- from 001_initial_schema.sql) are completely untouched by this migration.
-- categories' write policies are also untouched (it has none — see
-- 003_otp_verified_rls.sql's own closing comment; this app never writes
-- categories from the client).
-- ============================================================================

-- --------------------------------------------------------------------------
-- is_enabled_admin() — SECURITY DEFINER helper, required (not optional)
-- --------------------------------------------------------------------------
-- public.admin_users has RLS enabled with ZERO policies for `authenticated`/
-- `anon` and `revoke all ... from authenticated, anon, public` (see
-- 004_admin_authorization_hardening.sql) — only `service_role` (which
-- bypasses RLS entirely) can read it directly. A plain inline subquery in a
-- decor_items RLS policy evaluated AS the `authenticated` role (e.g.
-- `exists (select 1 from admin_users where ...)`) would therefore always
-- fail/see nothing, regardless of the row's actual contents. SECURITY
-- DEFINER is the standard, already-established Postgres/Supabase pattern
-- for this exact situation (public.custom_access_token_hook already uses
-- it for the identical reason — see 003_otp_verified_rls.sql) — the
-- function runs with its OWNER's privileges (the migration-applying role,
-- which owns/bypasses RLS on tables it created, exactly like the existing
-- hook already does), not the calling session's limited ones.
--
-- Recursion: impossible by construction. admin_users has NO policies at
-- all (not even for service_role, which doesn't need any — see above), so
-- there is no policy expression on admin_users that could call back into
-- this function or into decor_items. This function is the only thing that
-- ever reads admin_users from the RLS path, and it does so exactly once,
-- directly, with no further policy evaluation in between.
--
-- Uses auth.uid() exclusively — the authenticated user's own id as
-- established by their verified Supabase session — never a parameter, so
-- it is structurally impossible for a caller (or a malicious policy
-- expression elsewhere) to ask "is some OTHER user id an enabled admin."
-- Matches worker/src/index.ts's isEnabledAdmin() exactly in semantics (row
-- exists AND enabled = true, else false) — same allowlist, same rule,
-- enforced independently at both the Worker and database layers.
--
-- set search_path = '' + fully-qualified public.admin_users: the same
-- search-path-hijacking defense already used by custom_access_token_hook,
-- applied here for the same reason.
create or replace function public.is_enabled_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  admin_enabled boolean;
begin
  select enabled into admin_enabled
  from public.admin_users
  where user_id = auth.uid();

  return coalesce(admin_enabled, false);
end;
$$;

comment on function public.is_enabled_admin() is
  'SECURITY DEFINER helper: true only if auth.uid() has an admin_users row with enabled=true. Used by decor_items RLS policies to allow a SECURITY DEFINER bypass of admin_users own RLS lockdown for this one narrow, auth.uid()-bound check — never accepts a caller-supplied user id. See 008_aal2_decor_items_authorization.sql.';

-- Only the roles that can ever reach these RLS policies need to call this
-- — matches the same `authenticated` scope the decor_items policies below
-- are themselves restricted to. Not granted to anon/public: an
-- unauthenticated caller has no auth.uid() anyway (null), and has no
-- business invoking this at all.
revoke all on function public.is_enabled_admin() from public, anon;
grant execute on function public.is_enabled_admin() to authenticated;

-- --------------------------------------------------------------------------
-- decor_items — widen INSERT/UPDATE/DELETE to accept aal2+admin OR the
-- existing otp_verified claim. SELECT is untouched (no changes below touch
-- the "Public can read decor_items" policy from 001_initial_schema.sql).
-- --------------------------------------------------------------------------
drop policy if exists "OTP-verified admin can insert decor_items" on public.decor_items;
drop policy if exists "OTP-verified admin can update decor_items" on public.decor_items;
drop policy if exists "OTP-verified admin can delete decor_items" on public.decor_items;

-- aal2 is Supabase's own standard top-level JWT claim (set automatically
-- once a session completes native MFA) — read directly via
-- `auth.jwt() ->> 'aal'`, never from anything client-supplied. Combined
-- with is_enabled_admin() (auth.uid()-bound, SECURITY DEFINER) so AAL2
-- alone is never sufficient — exactly mirroring
-- worker/src/index.ts's tryAal2AdminAuthorization(), which also requires
-- both signals together, not either alone.
create policy "AAL2 admin or OTP-verified admin can insert decor_items"
  on public.decor_items
  for insert
  to authenticated
  with check (
    ((auth.jwt() ->> 'aal') = 'aal2' and public.is_enabled_admin())
    or
    ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true')
  );

create policy "AAL2 admin or OTP-verified admin can update decor_items"
  on public.decor_items
  for update
  to authenticated
  using (
    ((auth.jwt() ->> 'aal') = 'aal2' and public.is_enabled_admin())
    or
    ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true')
  )
  with check (
    ((auth.jwt() ->> 'aal') = 'aal2' and public.is_enabled_admin())
    or
    ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true')
  );

create policy "AAL2 admin or OTP-verified admin can delete decor_items"
  on public.decor_items
  for delete
  to authenticated
  using (
    ((auth.jwt() ->> 'aal') = 'aal2' and public.is_enabled_admin())
    or
    ((auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true')
  );

-- No GRANT changes needed: 002_authenticated_write_access.sql's
-- `grant insert, update, delete on decor_items to authenticated` already
-- covers this — GRANT only decides whether `authenticated` may attempt the
-- operation at all; the policies above are what actually restrict it.
-- anon/public remain with no write grant at all, unchanged — this
-- migration cannot make an anonymous/public caller able to write, since it
-- never touches that GRANT and the policies above are scoped `to
-- authenticated` only, exactly as the policies they replace already were.
