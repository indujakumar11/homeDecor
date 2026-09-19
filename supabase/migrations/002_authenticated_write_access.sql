-- ============================================================================
-- Black Shades Home Decors — Authenticated admin write access
-- Step 3B.1: Real Supabase Auth (Step 3B) changed the Admin Portal's
-- effective database role from `anon` to `authenticated` once an admin is
-- logged in. The Step 1 DEV-ONLY policies/grants only covered `anon`, so
-- Add/Edit/Delete Decor started failing with "permission denied" for a
-- logged-in admin. This migration replaces those anon-scoped dev policies
-- with `authenticated`-scoped ones.
--
-- Not the final security model: `authenticated` here just means "any
-- Supabase Auth user" — there is still no admin/staff role distinction
-- (no admin table, no custom claim). That refinement, along with AAL2
-- enforcement, belongs to a later security step. This migration only fixes
-- the anon/authenticated mismatch introduced by Step 3B.
-- ============================================================================

-- --------------------------------------------------------------------------
-- decor_items — drop the DEV-ONLY anon write policies/grants
-- --------------------------------------------------------------------------
drop policy if exists "DEV ONLY - anon can insert decor_items" on public.decor_items;
drop policy if exists "DEV ONLY - anon can update decor_items" on public.decor_items;
drop policy if exists "DEV ONLY - anon can delete decor_items" on public.decor_items;

revoke insert, update, delete on public.decor_items from anon;

-- --------------------------------------------------------------------------
-- categories — drop the DEV-ONLY anon write policy/grant
-- --------------------------------------------------------------------------
-- The Admin Portal only ever reads categories (see
-- src/services/galleryService.js — getCategories() is a SELECT, and no
-- code path inserts/updates/deletes a category). No authenticated write
-- grant is added here for that reason; public/authenticated SELECT access
-- (granted in 001_initial_schema.sql) is untouched.
drop policy if exists "DEV ONLY - anon can manage categories" on public.categories;

revoke insert, update, delete on public.categories from anon;

-- --------------------------------------------------------------------------
-- decor_items — authenticated admin write access
-- --------------------------------------------------------------------------
-- `authenticated` = any signed-in Supabase Auth user. There is no
-- admin/staff role table yet (explicitly out of scope for this step — see
-- the header comment), so this is equivalent to "logged in via the Admin
-- Portal's real Supabase Auth login". Row-level scoping (using/with check)
-- is intentionally `true`: decor_items has no owner/tenant column to scope
-- by, so the only thing that can gate access is auth status itself.
grant insert, update, delete on public.decor_items to authenticated;

create policy "Authenticated admin can insert decor_items"
  on public.decor_items
  for insert
  to authenticated
  with check (true);

create policy "Authenticated admin can update decor_items"
  on public.decor_items
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated admin can delete decor_items"
  on public.decor_items
  for delete
  to authenticated
  using (true);
