/**
 * ============================================================================
 * GALLERY DATA SERVICE (Supabase-backed)
 * ============================================================================
 * Single source of truth for categories and gallery/decor items, used by both
 * the admin portal and the public site's Gallery component. Backed by the
 * Supabase `categories` and `decor_items` tables (see supabase/migrations).
 *
 * Every function here is async and returns a Promise, matching the contract
 * the UI was already built against (this is the same file the mock
 * localStorage implementation used to live in — only the internals changed).
 *
 * Planned follow-up: image_url will move from a plain URL string to a
 * Cloudflare R2-backed value. That change stays isolated to addImage/
 * updateImage — callers of this service should not need to change.
 * ============================================================================
 */

import { supabase } from '../lib/supabase';

const ITEM_COLUMNS = 'id, category_id, title, description, image_url, created_at, updated_at, categories ( name, slug )';

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? 'Uncategorized',
    categorySlug: row.categories?.slug ?? null,
    title: row.title,
    description: row.description || '',
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertNoError(error, context) {
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[galleryService] ${context}:`, error);
    throw new Error(`${context}: ${error.message}`);
  }
}

/** All categories, alphabetical by name. */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name', { ascending: true });

  assertNoError(error, 'Failed to load categories');
  return (data || []).map(mapCategory);
}

/** All decor items, newest first. */
export async function getImages() {
  const { data, error } = await supabase
    .from('decor_items')
    .select(ITEM_COLUMNS)
    .order('created_at', { ascending: false });

  assertNoError(error, 'Failed to load gallery images');
  return (data || []).map(mapItem);
}

export async function getImageById(id) {
  const { data, error } = await supabase
    .from('decor_items')
    .select(ITEM_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  assertNoError(error, 'Failed to load image');
  return data ? mapItem(data) : null;
}

export async function getImagesByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return getImages();

  const { data, error } = await supabase
    .from('decor_items')
    .select(ITEM_COLUMNS)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  assertNoError(error, 'Failed to load images for category');
  return (data || []).map(mapItem);
}

export async function addImage(data) {
  const { data: inserted, error } = await supabase
    .from('decor_items')
    .insert({
      category_id: data.categoryId,
      title: data.title,
      description: data.description || '',
      image_url: data.imageUrl,
    })
    .select(ITEM_COLUMNS)
    .single();

  assertNoError(error, 'Failed to add decor item');
  return mapItem(inserted);
}

export async function updateImage(id, data) {
  const { data: updated, error } = await supabase
    .from('decor_items')
    .update({
      category_id: data.categoryId,
      title: data.title,
      description: data.description || '',
      image_url: data.imageUrl,
    })
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .maybeSingle();

  assertNoError(error, 'Failed to update decor item');
  return updated ? mapItem(updated) : null;
}

export async function deleteImage(id) {
  const { error } = await supabase
    .from('decor_items')
    .delete()
    .eq('id', id);

  assertNoError(error, 'Failed to delete decor item');
  return true;
}
