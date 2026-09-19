-- ============================================================================
-- Black Shades Home Decors — production catalog seed (categories + decor_items)
-- ============================================================================
-- Source: local-data.sql (a local Supabase pg_dump), filtered down to ONLY
-- public.categories and public.decor_items. Nothing else from that dump is
-- reproduced here — no auth.users, no public.admin_users, no
-- public.otp_authorizations, no storage/*, no sequences. Production already
-- has migrations 001–005 applied and both target tables are currently empty;
-- this file only adds catalog rows, it does not touch schema, RLS, grants,
-- or any authentication/authorization table.
--
-- UUIDs, category_id relationships, titles, descriptions, image_url, and the
-- created_at/updated_at timestamps are preserved exactly as they exist
-- locally, so the production catalog matches local dev 1:1. image_url values
-- are left as local static asset paths (e.g. assets/services/murals.webp) —
-- intentionally NOT rewritten to R2 URLs, per instructions; that is a
-- separate, later migration.
--
-- Encoding: saved as UTF-8 with the correct single-byte-sequence é
-- (0xC3 0xA9) in "Interior Décor" — the source dump was checked byte-for-
-- byte and already contains the correct UTF-8 encoding for this file (no
-- "Interior DÃ©cor" double-encoding was actually present to fix), but the
-- category name is retyped directly here regardless so this file's encoding
-- is verified independently of the dump.
--
-- This file is NOT executed by this migration step — see the accompanying
-- report for verification performed instead of execution.
-- ============================================================================

INSERT INTO "public"."categories" ("id", "name", "slug", "created_at") VALUES
	('00000000-0000-0000-0000-000000000001', 'Interior Décor', 'interior-decor', '2026-09-14 13:20:52.355633+00'),
	('00000000-0000-0000-0000-000000000002', 'Sculptures', 'sculptures', '2026-09-14 13:20:52.355633+00'),
	('00000000-0000-0000-0000-000000000003', 'Murals', 'murals', '2026-09-14 13:20:52.355633+00'),
	('00000000-0000-0000-0000-000000000004', 'Corporate Interiors', 'corporate-interiors', '2026-09-14 13:20:52.355633+00'),
	('00000000-0000-0000-0000-000000000005', 'Retail & Commercial', 'retail-commercial', '2026-09-14 13:20:52.355633+00'),
	('00000000-0000-0000-0000-000000000006', 'Signage', 'signage', '2026-09-14 13:20:52.355633+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "public"."decor_items" ("id", "category_id", "title", "description", "image_url", "created_at", "updated_at") VALUES
	('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Celestial Gallop Bas-Relief Wall', 'An expansive 24-foot hand-sculpted bronze and gold leaf relief mural capturing galloping wild horses on dark textured stone.', 'assets/services/murals.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Contemporary Villa Grand Lounge', 'Turnkey luxury living suite with vertical walnut louvers, Italian black marble media facade, and warm cove backlighting.', 'assets/services/interior-decor.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Sacred Ganesha FRP Art Installation', 'Life-size contemporary Lord Ganesha sculpture crafted in reinforced fiberglass with charcoal stone texture and 24K gold accents.', 'assets/services/frp-sculptures.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Parametric Backlit World Map', 'Multilayered walnut wood and champagne acrylic world map installation with zoned LED backlight for a global executive suite.', 'assets/services/parametric.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Classical Philosopher Stone Powder Bust', 'Precision-cast Makrana marble stone powder bust with antique wood plinth, capturing fine neoclassical drapery and texture.', 'assets/services/marble-sculptures.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'Executive MD Suite & Boardroom', 'Bespoke executive environment with fluted wall treatments, leather acoustic cladding, and automated architectural lighting.', 'assets/services/corporate.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000006', 'Monumental Entrance Pylon & Branding', '28-foot monolithic outdoor totem pylon with dark ACP cladding, 3D acrylic illuminated lettering, and internal steel frame.', 'assets/services/signage.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000005', 'Gourmet Marketplace & Retail Interior', 'Turnkey supermarket fit-out featuring bespoke wooden produce gondolas, zoned track lighting, and industrial ceiling aesthetics.', 'assets/services/supermarket.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00'),
	('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Architectural Geometric Facade Relief', 'Full-height geometric fractured stone wall with perimeter gold cove lighting, creating a dramatic architectural statement.', 'assets/hero/hero-bg.webp', '2026-09-14 13:20:52.355633+00', '2026-09-14 13:20:52.355633+00')
ON CONFLICT (id) DO NOTHING;
