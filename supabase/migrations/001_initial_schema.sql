-- ============================================================================
-- Black Shades Home Decors — Initial Supabase schema
-- Step 1 of the production migration: categories + decor_items only.
-- No image storage (R2), no real auth, no Workers — see project notes.
-- ============================================================================

-- --------------------------------------------------------------------------
-- categories
-- --------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Decor category taxonomy (Murals, Sculptures, etc.) — one row per category shown in admin/public filters.';

-- --------------------------------------------------------------------------
-- decor_items
-- --------------------------------------------------------------------------
create table if not exists public.decor_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  title       text not null,
  description text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.decor_items is 'Gallery/decor items managed by the admin portal and displayed on the public site. One category has many decor_items.';

-- Every list/filter query in the app filters or joins on category_id.
create index if not exists idx_decor_items_category_id on public.decor_items (category_id);

-- --------------------------------------------------------------------------
-- updated_at auto-maintenance
-- --------------------------------------------------------------------------
-- The admin "Edit Decor" flow relies on updated_at changing on every save;
-- setting it here means callers never need to (and can't forget to) pass it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_decor_items_set_updated_at on public.decor_items;
create trigger trg_decor_items_set_updated_at
  before update on public.decor_items
  for each row
  execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.decor_items enable row level security;

-- RLS policies only decide *which rows* a role can see/touch — Postgres
-- still requires the underlying GRANT before a role may attempt the
-- operation at all. Supabase's default anon/authenticated roles do not
-- automatically receive privileges on tables created by a custom migration,
-- so these are required for the policies below to have any effect.
grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.decor_items to anon, authenticated;

-- Public read access is a real, intended production policy: the public
-- website (anonymous visitors) must be able to read categories and decor
-- items, and none of this data is sensitive.
create policy "Public can read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy "Public can read decor_items"
  on public.decor_items
  for select
  to anon, authenticated
  using (true);

-- ============================================================================
-- DEVELOPMENT ONLY — temporary write access
-- ============================================================================
-- The admin portal currently uses mock (localStorage-based) authentication,
-- not Supabase Auth — there is no server-verifiable notion of "this request
-- came from a logged-in admin" yet. Until real authentication ships, the
-- browser's anon key is the only credential available, so these policies
-- grant write access to the anon role just so Add/Edit/Delete Decor work
-- end-to-end for local development and review.
--
-- THIS IS NOT PRODUCTION-SAFE. Anyone with the published anon key (it is
-- public by design, embedded in the frontend bundle) can currently insert,
-- update, or delete decor_items and categories. Do not point this database
-- at real production data while these policies are in place.
--
-- MUST BE REPLACED when real Supabase Auth is implemented, e.g.:
--   using (auth.role() = 'authenticated' and auth.jwt() ->> 'role' = 'admin')
-- (or an equivalent check against a real admin/staff table) —
-- drop these four policies first, and revoke the two grants below.
grant insert, update, delete on public.decor_items to anon;
grant insert, update, delete on public.categories to anon;

create policy "DEV ONLY - anon can insert decor_items"
  on public.decor_items
  for insert
  to anon
  with check (true);

create policy "DEV ONLY - anon can update decor_items"
  on public.decor_items
  for update
  to anon
  using (true)
  with check (true);

create policy "DEV ONLY - anon can delete decor_items"
  on public.decor_items
  for delete
  to anon
  using (true);

create policy "DEV ONLY - anon can manage categories"
  on public.categories
  for all
  to anon
  using (true)
  with check (true);
