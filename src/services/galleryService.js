/**
 * ============================================================================
 * MOCK GALLERY DATA SERVICE (localStorage-backed)
 * ============================================================================
 * Single source of truth for gallery images, used by both the admin portal
 * and the public site's Gallery component. Backed by localStorage for now.
 *
 * Planned replacement: these functions will call a Cloudflare Worker which
 * reads/writes image metadata in Supabase PostgreSQL and files in Cloudflare
 * R2. The function signatures here (getImages, getImageById,
 * getImagesByCategory, addImage, updateImage, deleteImage) are the contract
 * the UI depends on — swapping the implementation to real network calls
 * (and making them async under the hood, e.g. returning Promises) should not
 * require changes to the components that call this service.
 * ============================================================================
 */

import { projectsData } from '../data/projectsData';
import { getCategoryIdByName } from '../data/categories';

const STORAGE_KEY = 'hd_gallery_items';

function readStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return seedFromProjectsData();
  }
  try {
    return JSON.parse(raw);
  } catch {
    return seedFromProjectsData();
  }
}

function writeStore(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** First-run seed: convert the site's existing static project data into the shared gallery schema. */
function seedFromProjectsData() {
  const now = new Date().toISOString();
  const seeded = projectsData.map((p) => ({
    id: p.id,
    categoryId: getCategoryIdByName(p.category) || 'interior-decor',
    title: p.title,
    description: p.description || '',
    imageUrl: p.image,
    // Preserved from the original static data so the public site's existing
    // project detail modal (location / scope / year) keeps working unchanged.
    location: p.location,
    scope: p.scope,
    year: p.year,
    createdAt: now,
    updatedAt: now,
  }));
  writeStore(seeded);
  return seeded;
}

function generateId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getImages() {
  return readStore().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getImageById(id) {
  return readStore().find((img) => img.id === id) || null;
}

export function getImagesByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return getImages();
  return getImages().filter((img) => img.categoryId === categoryId);
}

export function addImage(data) {
  const items = readStore();
  const now = new Date().toISOString();
  const newItem = {
    id: generateId(),
    categoryId: data.categoryId,
    title: data.title,
    description: data.description || '',
    imageUrl: data.imageUrl,
    createdAt: now,
    updatedAt: now,
  };
  items.push(newItem);
  writeStore(items);
  return newItem;
}

export function updateImage(id, data) {
  const items = readStore();
  const index = items.findIndex((img) => img.id === id);
  if (index === -1) return null;

  const updated = {
    ...items[index],
    ...data,
    id: items[index].id,
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  writeStore(items);
  return updated;
}

export function deleteImage(id) {
  const items = readStore();
  const filtered = items.filter((img) => img.id !== id);
  writeStore(filtered);
  return filtered.length < items.length;
}
