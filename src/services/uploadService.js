/**
 * ============================================================================
 * IMAGE UPLOAD SERVICE (local Cloudflare Worker + local R2)
 * ============================================================================
 * Talks only to the local Worker (see worker/) — never to R2 or Supabase
 * directly. No R2 keys or Cloudflare credentials exist anywhere in this file
 * or anywhere else in the React app; the Worker is the only thing that talks
 * to R2.
 *
 * DEVELOPMENT ONLY: VITE_WORKER_URL has no production value yet. This whole
 * module is scoped to the local dev Worker introduced in Step 2A/2B.
 * ============================================================================
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

/**
 * Uploads a File to the local Worker, which stores it in local R2.
 * Returns { key, imageUrl, deleteUrl } on success.
 * Throws an Error with a user-facing message on any failure.
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(`${WORKER_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(
      'Unable to reach the local upload server. Make sure the Worker is running (npm run worker:dev).'
    );
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    // fall through — result stays null, handled below
  }

  if (!response.ok) {
    throw new Error(result?.error || `Image upload failed (${response.status}).`);
  }

  return {
    key: result.key,
    imageUrl: `${WORKER_URL}${result.retrieveUrl}`,
    deleteUrl: `${WORKER_URL}${result.retrieveUrl}`,
  };
}

/**
 * Best-effort cleanup of an R2 object — used when an upload succeeds but the
 * following Supabase write fails, so we don't leave an orphaned image.
 * Never throws: if this also fails, we're already reporting the original
 * error to the user, and there is no stronger guarantee to offer here (see
 * README notes on this not being a transactional operation).
 *
 * Returns true if the delete request came back ok, false otherwise — callers
 * that want to log/report the outcome can check this; callers that just want
 * "try, and move on regardless" can ignore the return value entirely.
 */
export async function deleteUploadedImage(deleteUrl) {
  try {
    const res = await fetch(deleteUrl, { method: 'DELETE' });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[uploadService] R2 cleanup request for ${deleteUrl} returned ${res.status}.`);
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[uploadService] Best-effort cleanup of orphaned R2 object failed:', err);
    return false;
  }
}

/**
 * Extracts the R2 object key from an image_url this app itself produced
 * (always `${WORKER_URL}/api/images/<key>` — see uploadImage above).
 *
 * Returns null for anything that doesn't match that exact prefix, which is
 * the correct, safe outcome for e.g. the seed data's plain static asset
 * paths (`assets/services/murals.webp`) — those were never stored in R2, so
 * there is nothing to clean up and no key to guess at. This is deliberately
 * a strict prefix check against a URL shape this codebase fully controls,
 * not a heuristic over an arbitrary string.
 */
export function getWorkerImageKey(imageUrl) {
  const prefix = `${WORKER_URL}/api/images/`;
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(prefix)) return null;
  const key = imageUrl.slice(prefix.length);
  return key ? decodeURIComponent(key) : null;
}

/**
 * Best-effort delete of a Worker-hosted image, given its stored image_url
 * rather than a fresh upload's key. Returns false (without throwing) for a
 * non-R2-managed URL, or if the delete request itself fails/errors — see
 * deleteUploadedImage above for the same "never throws" reasoning.
 */
export async function deleteImageByUrl(imageUrl) {
  const key = getWorkerImageKey(imageUrl);
  if (!key) return false;
  return deleteUploadedImage(`${WORKER_URL}/api/images/${key}`);
}
