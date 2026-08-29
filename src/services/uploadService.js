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
 */
export async function deleteUploadedImage(deleteUrl) {
  try {
    await fetch(deleteUrl, { method: 'DELETE' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[uploadService] Best-effort cleanup of orphaned R2 object failed:', err);
  }
}
