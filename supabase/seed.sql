-- ============================================================================
-- Seed data — mirrors the existing static src/data/categories.js and
-- src/data/projectsData.js so the database starts with the same content the
-- site already ships with. Fixed UUIDs + ON CONFLICT DO NOTHING make this
-- safe to re-run (e.g. `supabase db reset`) without creating duplicates.
-- ============================================================================

insert into public.categories (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Interior Décor',       'interior-decor'),
  ('00000000-0000-0000-0000-000000000002', 'Sculptures',           'sculptures'),
  ('00000000-0000-0000-0000-000000000003', 'Murals',               'murals'),
  ('00000000-0000-0000-0000-000000000004', 'Corporate Interiors',  'corporate-interiors'),
  ('00000000-0000-0000-0000-000000000005', 'Retail & Commercial',  'retail-commercial'),
  ('00000000-0000-0000-0000-000000000006', 'Signage',              'signage')
on conflict (id) do nothing;

insert into public.decor_items (id, category_id, title, description, image_url) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003', -- Murals
    'Celestial Gallop Bas-Relief Wall',
    'An expansive 24-foot hand-sculpted bronze and gold leaf relief mural capturing galloping wild horses on dark textured stone.',
    'assets/services/murals.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001', -- Interior Décor
    'Contemporary Villa Grand Lounge',
    'Turnkey luxury living suite with vertical walnut louvers, Italian black marble media facade, and warm cove backlighting.',
    'assets/services/interior-decor.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002', -- Sculptures
    'Sacred Ganesha FRP Art Installation',
    'Life-size contemporary Lord Ganesha sculpture crafted in reinforced fiberglass with charcoal stone texture and 24K gold accents.',
    'assets/services/frp-sculptures.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004', -- Corporate Interiors
    'Parametric Backlit World Map',
    'Multilayered walnut wood and champagne acrylic world map installation with zoned LED backlight for a global executive suite.',
    'assets/services/parametric.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000002', -- Sculptures
    'Classical Philosopher Stone Powder Bust',
    'Precision-cast Makrana marble stone powder bust with antique wood plinth, capturing fine neoclassical drapery and texture.',
    'assets/services/marble-sculptures.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000004', -- Corporate Interiors
    'Executive MD Suite & Boardroom',
    'Bespoke executive environment with fluted wall treatments, leather acoustic cladding, and automated architectural lighting.',
    'assets/services/corporate.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000006', -- Signage
    'Monumental Entrance Pylon & Branding',
    '28-foot monolithic outdoor totem pylon with dark ACP cladding, 3D acrylic illuminated lettering, and internal steel frame.',
    'assets/services/signage.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000005', -- Retail & Commercial
    'Gourmet Marketplace & Retail Interior',
    'Turnkey supermarket fit-out featuring bespoke wooden produce gondolas, zoned track lighting, and industrial ceiling aesthetics.',
    'assets/services/supermarket.webp'
  ),
  (
    '10000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001', -- Interior Décor
    'Architectural Geometric Facade Relief',
    'Full-height geometric fractured stone wall with perimeter gold cove lighting, creating a dramatic architectural statement.',
    'assets/hero/hero-bg.webp'
  )
on conflict (id) do nothing;
