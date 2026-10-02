-- ============================================================================
-- Black Shades Home Decors — add "Government Projects" category
-- The public Gallery, Admin "Add/Edit Decor" category <select>, and category
-- filtering (src/components/Gallery/Gallery.jsx, src/admin/components/
-- ImageForm.jsx, src/admin/pages/GalleryManagementPage.jsx) all build their
-- category list purely from `select * from public.categories` via
-- src/services/galleryService.js's getCategories() — none of them hardcode
-- a category list. So adding a new category end-to-end only requires this
-- one row; no frontend/worker code change is needed for it to appear in the
-- admin dropdown, the public filter tabs, or a project card's category
-- badge.
--
-- Continues the fixed-UUID + ON CONFLICT pattern established by
-- supabase/seed.sql (ids 00000000-0000-0000-0000-000000000001 through
-- …006 are the 6 existing categories) with the next id in that sequence.
-- Keyed on `slug` (the column's actual UNIQUE constraint — see
-- 001_initial_schema.sql) rather than `id`, so this is also safe to re-run
-- if a category with this slug were ever created some other way (e.g.
-- manually in Supabase Studio) under a different id — it won't create a
-- duplicate category either way.
-- ============================================================================

insert into public.categories (id, name, slug) values
  ('00000000-0000-0000-0000-000000000007', 'Government Projects', 'government-projects')
on conflict (slug) do nothing;
