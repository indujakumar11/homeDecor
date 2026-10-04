-- ============================================================================
-- Black Shades Home Decors — add decor_items.gallery_image_url
-- ============================================================================
-- Phase 1 of the gallery image optimization project (see the accompanying
-- design/review reports). Adds a single nullable column that will hold the
-- URL of a smaller, WebP-encoded "gallery card" variant of a decor item's
-- image — generated client-side in the Admin Portal (src/admin/components/
-- ImageForm.jsx) and stored alongside the existing full-resolution original
-- in R2 under the derived key `uploads/{uuid}-gallery.webp` (see
-- worker/src/index.ts).
--
-- `image_url` (the original, full-resolution image) is NOT modified by this
-- migration and keeps its existing meaning/behavior unchanged.
--
-- Nullable, no default, no backfill: existing rows (all 39 at the time of
-- writing — 31 R2-backed + 8 static-asset seed rows) get NULL automatically
-- and keep working exactly as they do today. The public Gallery and Admin
-- Portal read this column with a `gallery_image_url ?? image_url` fallback
-- (src/services/galleryService.js's mapItem(), consumed by
-- src/components/Gallery/Gallery.jsx and src/admin/components/ImageCard.jsx),
-- so NULL is a fully valid, intentional, permanent state for any row that
-- never gets an optimized variant (e.g. the 8 static-asset rows), not just a
-- transient "not backfilled yet" state.
--
-- No RLS policy change is needed: the existing "Public can read decor_items"
-- / "OTP-verified admin can insert/update decor_items" policies (see
-- 001_initial_schema.sql, 003_otp_verified_rls.sql) apply to the whole row,
-- not to specific columns — a new nullable column is automatically covered
-- by every existing policy with no changes required.
-- ============================================================================

alter table public.decor_items
  add column if not exists gallery_image_url text;

comment on column public.decor_items.gallery_image_url is
  'Optional URL of a smaller, WebP-encoded "gallery card" variant of image_url, generated client-side at upload/edit time (see src/admin/components/ImageForm.jsx) and stored in R2 under uploads/{same-uuid}-gallery.webp (see worker/src/index.ts). NULL means no optimized variant exists yet (or never will, e.g. the original static-asset seed rows) — readers must fall back to image_url in that case (gallery_image_url ?? image_url), never treat NULL as an error.';
