-- ============================================================================
-- Black Shades Home Decors — least-privilege client grants + current-admin
-- check on every decor_items write
-- ============================================================================
-- Two narrow corrections, found by auditing production grants/policies
-- (Steps 26–29):
--
-- 1. Client-role table grants. Production showed anon/authenticated holding
--    TRUNCATE, TRIGGER and REFERENCES on public.categories and
--    public.decor_items. No migration grants them — they came from the
--    schema's default privileges when 001_initial_schema.sql created the
--    tables. The app never uses them (it only SELECTs both tables and, as an
--    admin, INSERTs/UPDATEs/DELETEs decor_items), and TRUNCATE in particular
--    is not subject to RLS at all. They are revoked here. The intended grants
--    are restated explicitly (no-ops where already in place), so this file
--    documents the complete client-role privilege set for these two tables.
--
-- 2. decor_items write policies. In 008_aal2_decor_items_authorization.sql
--    the AAL2 branch checks public.is_enabled_admin() at query time, but the
--    app_metadata.otp_verified branch only trusts the claim inside the access
--    token. custom_access_token_hook() (004) only ever issues that claim to
--    an enabled admin, but an already-issued token keeps it until it expires,
--    so an admin disabled in admin_users could keep writing until then. Every
--    write branch now also requires public.is_enabled_admin(), so disabling an
--    admin takes effect immediately. For an enabled admin the result is
--    identical to 008 (AAL2/TOTP sessions and OTP-verified sessions both still
--    work); for anyone else it is strictly narrower.
--
-- Deliberately NOT changed here: default privileges (they would affect every
-- future object in the schema), service_role, admin_users,
-- otp_authorizations, custom_access_token_hook(), is_enabled_admin(), the
-- public SELECT policies, and set_updated_at().
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Client-role table privileges
-- --------------------------------------------------------------------------
revoke truncate, trigger, references on public.categories, public.decor_items from anon, authenticated;

-- categories: read-only for clients (no code path writes categories).
revoke insert, update, delete on public.categories from anon, authenticated;

-- decor_items: anonymous visitors never write.
revoke insert, update, delete on public.decor_items from anon;

-- Intended grants, restated explicitly. RLS policies below (and the public
-- SELECT policies from 001_initial_schema.sql) decide which rows each role
-- can actually read or write.
grant select on public.categories, public.decor_items to anon, authenticated;
grant insert, update, delete on public.decor_items to authenticated;

-- --------------------------------------------------------------------------
-- 2. decor_items write policies — every branch requires a current enabled
--    admin (public.is_enabled_admin(), SECURITY DEFINER, auth.uid()-bound;
--    see 008_aal2_decor_items_authorization.sql) plus either a native AAL2
--    session or the hook-issued otp_verified claim.
-- --------------------------------------------------------------------------
-- Policies being replaced (from 008):
drop policy if exists "AAL2 admin or OTP-verified admin can insert decor_items" on public.decor_items;
drop policy if exists "AAL2 admin or OTP-verified admin can update decor_items" on public.decor_items;
drop policy if exists "AAL2 admin or OTP-verified admin can delete decor_items" on public.decor_items;

-- Replacement names, dropped first so this migration can be safely re-run.
drop policy if exists "Enabled admin (AAL2 or OTP-verified) can insert decor_items" on public.decor_items;
drop policy if exists "Enabled admin (AAL2 or OTP-verified) can update decor_items" on public.decor_items;
drop policy if exists "Enabled admin (AAL2 or OTP-verified) can delete decor_items" on public.decor_items;

create policy "Enabled admin (AAL2 or OTP-verified) can insert decor_items"
  on public.decor_items
  for insert
  to authenticated
  with check (
    public.is_enabled_admin()
    and (
      (auth.jwt() ->> 'aal') = 'aal2'
      or (auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true'
    )
  );

create policy "Enabled admin (AAL2 or OTP-verified) can update decor_items"
  on public.decor_items
  for update
  to authenticated
  using (
    public.is_enabled_admin()
    and (
      (auth.jwt() ->> 'aal') = 'aal2'
      or (auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true'
    )
  )
  with check (
    public.is_enabled_admin()
    and (
      (auth.jwt() ->> 'aal') = 'aal2'
      or (auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true'
    )
  );

create policy "Enabled admin (AAL2 or OTP-verified) can delete decor_items"
  on public.decor_items
  for delete
  to authenticated
  using (
    public.is_enabled_admin()
    and (
      (auth.jwt() ->> 'aal') = 'aal2'
      or (auth.jwt() -> 'app_metadata' ->> 'otp_verified') = 'true'
    )
  );
