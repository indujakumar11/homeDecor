// Real gallery categories used across the public site (see projectCategories
// in projectsData.js). Kept as the single source of truth for the admin
// portal's category selector/filter so it never drifts from what the public
// Gallery actually renders.
export const categories = [
  { id: 'interior-decor', name: 'Interior Décor' },
  { id: 'sculptures', name: 'Sculptures' },
  { id: 'murals', name: 'Murals' },
  { id: 'corporate-interiors', name: 'Corporate Interiors' },
  { id: 'retail-commercial', name: 'Retail & Commercial' },
  { id: 'signage', name: 'Signage' },
];

export function getCategoryById(id) {
  return categories.find((c) => c.id === id);
}

export function getCategoryName(id) {
  return getCategoryById(id)?.name || 'Uncategorized';
}

export function getCategoryIdByName(name) {
  return categories.find((c) => c.name === name)?.id || null;
}
