#!/usr/bin/env node
// ============================================================================
// Black Shades Home Decors — Phase 2: one-time gallery-image backfill
// ============================================================================
// PREPARED, NOT RUN. This script has never been executed. It makes no R2 or
// Supabase changes just by existing on disk.
//
// WHAT THIS DOES
// For every public.decor_items row where gallery_image_url IS NULL and
// image_url points at an existing R2-backed original
// (https://homedecor-worker-production.homedecor-blackshade.workers.dev/
//  api/images/uploads/{uuid}.{jpg|png|webp}), this script:
//   1. Downloads the original (read-only, via the same public endpoint the
//      public site already uses — no credentials needed for this step).
//   2. Resizes it per the approved Phase 1 algorithm: scale-to-fit to a
//      1000px long edge, NEVER upscale, preserve aspect ratio, re-encode to
//      WebP at quality 0.82, no background fill (so transparency survives).
//   3. Uploads the result to uploads/{SAME uuid}-gallery.webp — the exact
//      key Phase 1's Worker/frontend already expect and derive from
//      image_url. Never touches, renames, or overwrites the original.
//   4. Updates ONLY that row's gallery_image_url, guarded by
//      `.eq('id', id).is('gallery_image_url', null)` — never a broad
//      update, and never touches image_url/title/category/description/any
//      other column.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//   - Never uploads via the Worker's authenticated POST /api/upload (that
//     requires a live OTP-verified admin session this unattended script
//     cannot obtain) — it shells out to the ALREADY-AUTHENTICATED local
//     `wrangler` CLI (the same tool/session already used to deploy this
//     Worker) to PUT directly to R2 instead. See uploadViaWrangler() below.
//   - Never uses a conditional/if-none-match PUT (wrangler's R2 CLI doesn't
//     expose one — confirmed via `wrangler r2 object put --help`). Instead,
//     it ALWAYS checks for — and fully validates — an existing object at the
//     derived gallery key (via the public Worker endpoint) BEFORE ever
//     attempting to write. See checkExistingGalleryObject()/processRow().
//   - Never installs `sharp` itself. If it's not resolvable, the script
//     fails immediately with a clear, actionable message instead of
//     attempting any workaround. Install it explicitly, once, before a real
//     (non---dry-run) run:
//       npm install --save-dev sharp
//     (sharp currently happens to already resolve on this machine as an
//     incidental transitive dependency of wrangler/miniflare — do not rely
//     on that; install it explicitly as your own project devDependency.)
//
// This file lives at the repo root's scripts/ directory, OUTSIDE both
// src/ (Vite's build entry is index.html -> src/main.jsx; nothing outside
// that import graph is ever bundled) and worker/src/ (the Worker's bundle
// entry is worker/src/index.ts; this script is never imported from there).
// It is therefore structurally impossible for this script or `sharp` to
// end up in the production frontend or Worker bundle.
//
// USAGE:
//   node scripts/backfill-gallery-images.js --dry-run
//   node scripts/backfill-gallery-images.js --dry-run --limit=1
//   node scripts/backfill-gallery-images.js --limit=1 --confirm-production
//   node scripts/backfill-gallery-images.js --confirm-production
//
// PRODUCTION SAFETY: any REAL (non---dry-run) run whose effective WORKER_URL
// is the production Worker is refused unless --confirm-production is also
// passed. --dry-run never requires it (it never writes anything regardless
// of target). See the gate in main() below.
//
// REQUIRED ENVIRONMENT VARIABLES (reusing the Worker's own existing naming
// convention — see worker/.dev.vars / the Env interface in
// worker/src/index.ts — not inventing new names):
//   SUPABASE_URL               Same meaning as the Worker's SUPABASE_URL.
//                               Defaults to the known production project URL
//                               below if unset — override for a local/dev
//                               Supabase stack instead.
//   SUPABASE_SERVICE_ROLE_KEY  Same credential the Worker already holds as a
//                               production secret (confirmed present via
//                               `wrangler secret list --env production`).
//                               REQUIRED — never defaulted, never logged,
//                               never written to any file by this script.
//                               Needed because RLS requires an OTP-verified
//                               admin session for decor_items writes (see
//                               supabase/migrations/003_otp_verified_rls.sql)
//                               — a service-role key is this project's own
//                               existing, established pattern for a trusted
//                               server-side-only component to bypass that,
//                               exactly how the Worker itself already does.
//
// OPTIONAL:
//   WORKER_URL   Base URL of the image Worker. Defaults to the production
//                Worker URL (same one already embedded in every existing
//                R2-backed image_url value). Override only for testing
//                against a local Worker (worker:dev).
//
// Example (operator runs this themselves — never paste the real key to an
// assistant/AI):
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/backfill-gallery-images.js --dry-run
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WRANGLER_CONFIG_PATH = path.join(REPO_ROOT, 'worker', 'wrangler.jsonc');

// --- Known, fixed architectural facts (not secrets) — see the Phase 2 task
// brief and worker/wrangler.jsonc's env.production block. ---
const R2_BUCKET_NAME = 'homedecor-images-prod';
const DEFAULT_SUPABASE_URL = 'https://kmuomlwrolehqxqvacwq.supabase.co';
const PRODUCTION_WORKER_URL = 'https://homedecor-worker-production.homedecor-blackshade.workers.dev';
const UPLOAD_PREFIX = 'uploads/';

// --- Approved Phase 1 architecture constants — must match
// src/admin/components/ImageForm.jsx's createGalleryVariant() exactly. ---
const GALLERY_MAX_LONG_EDGE = 1000;
const GALLERY_QUALITY = 0.82;

// Matches worker/src/index.ts's VALID_KEY_PATTERN's original-key half
// exactly — only ever classifies a row as "R2-backed, eligible" if its
// image_url's key truly has this exact server-generated shape. Anything
// else (the static-asset seed rows' assets/services/*.webp,
// assets/hero/hero-bg.webp paths, or any future unexpected value) is safely
// skipped, never guessed at.
const ORIGINAL_KEY_PATTERN =
  /^uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i;

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const confirmProduction = argv.includes('--confirm-production');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : null;
  if (limitArg && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error(`Invalid --limit value: "${limitArg}". Must be a positive integer, e.g. --limit=5.`);
  }
  return { dryRun, confirmProduction, limit };
}

function requireEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See the usage comment at the top of this script.`
    );
  }
  return value;
}

function formatBytes(bytes) {
  if (bytes == null) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Extracts { uuid, ext, key } from an image_url, ONLY if it matches the
 * Worker's exact server-generated original-key shape under the given
 * worker base URL. Returns null for anything else (static-asset seed rows,
 * a different Worker's URL, a malformed value) — those rows are skipped,
 * never guessed at or force-matched.
 */
function parseOriginalFromImageUrl(imageUrl, workerUrl) {
  const prefix = `${workerUrl}/api/images/`;
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(prefix)) return null;
  const key = decodeURIComponent(imageUrl.slice(prefix.length));
  const match = ORIGINAL_KEY_PATTERN.exec(key);
  if (!match) return null;
  return { uuid: match[1], ext: match[2].toLowerCase(), key };
}

function deriveGalleryKey(uuid) {
  return `${UPLOAD_PREFIX}${uuid}-gallery.webp`;
}

/** Downloads an original, verifying it actually arrived completely. */
async function downloadOriginal(workerUrl, key) {
  const res = await fetch(`${workerUrl}/api/images/${key}`);
  if (!res.ok) {
    throw new Error(`Failed to download original ${key}: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error(`Downloaded original ${key} is empty (0 bytes).`);
  }
  const declaredLength = res.headers.get('content-length');
  if (declaredLength && Number(declaredLength) !== buffer.length) {
    throw new Error(
      `Downloaded original ${key} is incomplete: expected ${declaredLength} bytes, got ${buffer.length}.`
    );
  }
  return buffer;
}

/**
 * Checks whether a gallery object already exists at the derived key and, if
 * so, fully validates it (correct content-type, non-empty, decodes as a
 * genuine WebP whose long edge respects the 1000px cap) before it's ever
 * trusted as a valid "already backfilled" result. Returns:
 *   { exists: false }
 *   { exists: true, valid: true, bytes, width, height }
 *   { exists: true, valid: false, reason }
 */
async function checkExistingGalleryObject(workerUrl, key, sharp) {
  const res = await fetch(`${workerUrl}/api/images/${key}`);
  if (res.status === 404) return { exists: false };
  if (!res.ok) {
    return { exists: true, valid: false, reason: `Unexpected HTTP ${res.status} retrieving existing object.` };
  }

  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length === 0) {
    return { exists: true, valid: false, reason: 'Existing object is retrievable but empty (0 bytes).' };
  }
  if (!contentType.includes('webp')) {
    return { exists: true, valid: false, reason: `Existing object has unexpected content-type "${contentType}" (expected image/webp).` };
  }

  try {
    const meta = await sharp(buffer).metadata();
    if (meta.format !== 'webp') {
      return { exists: true, valid: false, reason: `Existing object does not decode as WebP (decoded format: "${meta.format}").` };
    }
    if (!meta.width || !meta.height) {
      return { exists: true, valid: false, reason: 'Existing object has no readable dimensions.' };
    }
    if (Math.max(meta.width, meta.height) > GALLERY_MAX_LONG_EDGE) {
      return {
        exists: true,
        valid: false,
        reason: `Existing object is ${meta.width}x${meta.height}, exceeding the ${GALLERY_MAX_LONG_EDGE}px long-edge cap — does not look like a valid gallery variant.`,
      };
    }
    return { exists: true, valid: true, bytes: buffer.length, width: meta.width, height: meta.height };
  } catch (err) {
    return {
      exists: true,
      valid: false,
      reason: `Existing object is not a decodable image: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Resizes+re-encodes exactly per the approved Phase 1 algorithm. Requires
 * `sharp` to be installed (not done by this script — see the header
 * comment). Throws a clear, actionable error if it's missing rather than a
 * confusing bare "Cannot find module".
 */
async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch (err) {
    throw new Error(
      'The "sharp" package is not available. This script needs it for local, ' +
        'one-time image resizing (never bundled into the frontend or Worker — ' +
        'see the header comment). Install it first, explicitly, with:\n' +
        '  npm install --save-dev sharp\n' +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function resizeToGalleryWebp(sharp, originalBuffer) {
  const image = sharp(originalBuffer);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read source image dimensions.');
  }

  const longEdge = Math.max(metadata.width, metadata.height);
  const scale = longEdge > GALLERY_MAX_LONG_EDGE ? GALLERY_MAX_LONG_EDGE / longEdge : 1; // never upscale
  const targetWidth = Math.max(1, Math.round(metadata.width * scale));
  const targetHeight = Math.max(1, Math.round(metadata.height * scale));

  let pipeline = image;
  if (scale < 1) {
    pipeline = pipeline.resize(targetWidth, targetHeight, { fit: 'fill' });
  }
  // No .flatten()/background fill — preserves alpha channel for sources
  // that have one, matching ImageForm.jsx's createGalleryVariant() exactly.
  const outputBuffer = await pipeline.webp({ quality: Math.round(GALLERY_QUALITY * 100) }).toBuffer();

  return {
    buffer: outputBuffer,
    width: targetWidth,
    height: targetHeight,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
}

/** Re-decodes the just-produced buffer to confirm it's a valid WebP at the expected size before ever uploading it. */
async function validateGalleryBuffer(sharp, buffer, expectedWidth, expectedHeight) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Encoded gallery buffer is empty.');
  }
  const meta = await sharp(buffer).metadata();
  if (meta.format !== 'webp') {
    throw new Error(`Encoded output is "${meta.format}", expected "webp".`);
  }
  if (meta.width !== expectedWidth || meta.height !== expectedHeight) {
    throw new Error(
      `Encoded output is ${meta.width}x${meta.height}, expected ${expectedWidth}x${expectedHeight}.`
    );
  }
}

/**
 * Uploads via the ALREADY-AUTHENTICATED local `wrangler` CLI (same session
 * used earlier to deploy this Worker / manage its secrets) — never via the
 * Worker's own authenticated upload endpoint, which this unattended script
 * cannot obtain a live OTP-verified session for. Pipes the buffer over
 * stdin (`--pipe`) — no temp file is ever written to disk.
 */
function uploadViaWrangler(key, buffer) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `${R2_BUCKET_NAME}/${key}`,
        '--pipe',
        '--remote',
        '--content-type',
        'image/webp',
        // No --cache-control here: passing a comma-containing value through
        // this spawn's shell:true (Windows) wrapping breaks wrangler's own
        // arg parsing (observed: "Unknown arguments: max-age=31536000,,
        // immutable"). It's unnecessary anyway — the production Worker's
        // handleGetImage (worker/src/index.ts) already sets
        // Cache-Control: public, max-age=31536000, immutable on every GET
        // response unconditionally (IMAGE_CACHE_CONTROL), regardless of
        // whatever metadata is stored on the R2 object itself. Browsers see
        // the correct header either way.
        '--config',
        WRANGLER_CONFIG_PATH,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' }
    );

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler r2 object put exited with code ${code}: ${stderr.trim()}`));
    });

    child.stdin.write(buffer);
    child.stdin.end();
  });
}

/** Guarded, single-row, single-column update — never a broad statement. */
async function updateGalleryImageUrl(supabase, id, galleryImageUrl) {
  const { data, error } = await supabase
    .from('decor_items')
    .update({ gallery_image_url: galleryImageUrl })
    .eq('id', id)
    .is('gallery_image_url', null)
    .select('id');

  if (error) throw error;
  // Empty result (no error, but zero rows matched) means the guard didn't
  // match — most likely something else already set gallery_image_url for
  // this row between our SELECT and this UPDATE. Distinct, reportable state
  // — NOT silently treated as success.
  return { matched: Array.isArray(data) && data.length === 1 };
}

/**
 * Processes exactly one row. Never throws — all outcomes (success, skip,
 * every kind of failure) are captured in the returned result object so the
 * caller can always keep going to the next row and produce a complete
 * summary regardless of per-row failures.
 */
async function processRow(row, { workerUrl, dryRun, sharp, supabase }) {
  const result = {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    status: 'skipped',
    reason: null,
    originalKey: null,
    galleryKey: null,
    originalDimensions: null,
    originalBytes: null,
    galleryDimensions: null,
    galleryBytes: null,
    galleryBytesIsEstimate: false,
    dbUpdated: false,
    error: null,
    // Explicit flags the summary tally is built from — kept separate from
    // the free-text `status`/`reason` above so the end-of-run counts are
    // unambiguous regardless of which status string produced them.
    flags: { eligible: false, uploaded: false, alreadyExisted: false, dbUpdatedFlag: false, failed: false, orphaned: false },
  };

  const parsed = parseOriginalFromImageUrl(row.image_url, workerUrl);
  if (!parsed) {
    result.status = 'skipped';
    result.reason = 'image_url is not an R2-backed Worker key under this Worker URL (likely a static seed asset) — left untouched.';
    return result;
  }

  result.flags.eligible = true;
  result.originalKey = parsed.key;
  const galleryKey = deriveGalleryKey(parsed.uuid);
  result.galleryKey = galleryKey;

  try {
    const existing = await checkExistingGalleryObject(workerUrl, galleryKey, sharp);

    if (existing.exists && !existing.valid) {
      // Requirement: if an existing object is invalid/unreadable, report
      // clearly and do NOT touch the database.
      result.status = 'existing-gallery-object-invalid';
      result.reason = existing.reason;
      result.flags.failed = true;
      return result;
    }

    if (existing.exists && existing.valid) {
      // RESUME PATH: a VALID object already sits at the exact derived key
      // for THIS row's uuid — since the key is deterministic and unique per
      // row, this can only be a gallery variant a prior (interrupted) run
      // already produced for this exact row. Never re-download/resize/
      // re-upload — just (safely, guardedly) make sure the DB points at it.
      result.galleryDimensions = `${existing.width}x${existing.height}`;
      result.galleryBytes = existing.bytes;
      result.flags.alreadyExisted = true;
      result.status = dryRun ? 'would-resume' : 'resumed';
      result.reason = 'Valid gallery object already exists in R2 for this row (likely a prior interrupted run) — reusing it, not re-uploading.';

      if (!dryRun) {
        const galleryImageUrl = `${workerUrl}/api/images/${galleryKey}`;
        const { matched } = await updateGalleryImageUrl(supabase, row.id, galleryImageUrl);
        result.dbUpdated = matched;
        result.flags.dbUpdatedFlag = matched;
        if (!matched) {
          result.status = 'guard-mismatch';
          result.reason = 'gallery_image_url was no longer NULL by the time of this update (set concurrently elsewhere) — left untouched.';
          result.flags.failed = true;
        }
      }
      return result;
    }

    // No existing object — full download/resize/validate/upload path.
    const originalBuffer = await downloadOriginal(workerUrl, parsed.key);
    result.originalBytes = originalBuffer.length;

    const resized = await resizeToGalleryWebp(sharp, originalBuffer);
    result.originalDimensions = `${resized.originalWidth}x${resized.originalHeight}`;
    result.galleryDimensions = `${resized.width}x${resized.height}`;
    result.galleryBytes = resized.buffer.length;
    result.galleryBytesIsEstimate = dryRun;

    await validateGalleryBuffer(sharp, resized.buffer, resized.width, resized.height);

    if (dryRun) {
      result.status = 'would-process';
      result.reason = 'Dry run — downloaded, resized, and validated locally end-to-end; nothing uploaded or written.';
      return result;
    }

    await uploadViaWrangler(galleryKey, resized.buffer);
    result.flags.uploaded = true;

    // Verify the upload actually landed, and is a genuinely valid object,
    // before ever touching Supabase.
    const verification = await checkExistingGalleryObject(workerUrl, galleryKey, sharp);
    if (!verification.exists || !verification.valid) {
      result.status = 'upload-unverifiable';
      result.flags.failed = true;
      result.error =
        'Upload reported success but the object could not be verified as a valid WebP via the Worker ' +
        `(${verification.exists ? verification.reason : 'not retrievable'}) — aborting before any DB write. ` +
        `R2 key ${galleryKey} may need manual inspection.`;
      return result;
    }

    const galleryImageUrl = `${workerUrl}/api/images/${galleryKey}`;
    try {
      const { matched } = await updateGalleryImageUrl(supabase, row.id, galleryImageUrl);
      result.dbUpdated = matched;
      result.flags.dbUpdatedFlag = matched;
      if (matched) {
        result.status = 'processed';
      } else {
        result.status = 'guard-mismatch';
        result.flags.failed = true;
        result.reason =
          'Upload succeeded, but gallery_image_url was no longer NULL by the time of the update — left untouched. ' +
          'The uploaded object is not referenced by any row yet; safe to leave — a future run will detect and resume it.';
      }
    } catch (dbErr) {
      // R2 upload succeeded; DB write failed. Per the safety requirements:
      // report this clearly as an orphaned gallery object, do NOT touch the
      // original, do NOT attempt to delete the just-uploaded gallery object
      // either (a future run's resume path will pick it up safely).
      result.status = 'orphaned-gallery-object';
      result.flags.orphaned = true;
      result.error =
        `R2 upload succeeded (${galleryKey}) but the Supabase update failed: ` +
        `${dbErr instanceof Error ? dbErr.message : String(dbErr)}. The original is untouched. ` +
        'Re-run this script to safely resume this exact row.';
    }

    return result;
  } catch (err) {
    result.status = 'error';
    result.flags.failed = true;
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

function printRow(index, total, result) {
  const header = `[${index + 1}/${total}] id=${result.id}  "${result.title}"`;
  console.log(header);
  if (!result.flags.eligible) {
    console.log(`  status                : ${result.status}`);
    console.log(`  reason                : ${result.reason}`);
    console.log('');
    return;
  }
  console.log(`  original key           : ${result.originalKey}`);
  if (result.originalDimensions) console.log(`  original dimensions    : ${result.originalDimensions}`);
  if (result.originalBytes != null) console.log(`  original size          : ${formatBytes(result.originalBytes)}`);
  console.log(`  gallery key             : ${result.galleryKey}`);
  if (result.galleryDimensions) console.log(`  optimized dimensions   : ${result.galleryDimensions}`);
  if (result.galleryBytes != null) {
    console.log(`  optimized size${result.galleryBytesIsEstimate ? ' (est.)' : '       '} : ${formatBytes(result.galleryBytes)}`);
  }
  console.log(`  status                 : ${result.status}`);
  if (result.reason) console.log(`  reason                 : ${result.reason}`);
  if (result.error) console.log(`  error                  : ${result.error}`);
  console.log('');
}

async function main() {
  const { dryRun, confirmProduction, limit } = parseArgs(process.argv.slice(2));

  const supabaseUrl = requireEnv('SUPABASE_URL', DEFAULT_SUPABASE_URL);
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY'); // never logged, never written to any file
  const workerUrl = process.env.WORKER_URL || PRODUCTION_WORKER_URL;
  const isProductionTarget = workerUrl === PRODUCTION_WORKER_URL;

  console.log('============================================================');
  if (isProductionTarget) console.log('PRODUCTION BACKFILL');
  console.log(`Mode     : ${dryRun ? 'DRY RUN' : 'REAL RUN'}`);
  console.log(`Worker   : ${workerUrl}`);
  console.log(`Supabase : ${supabaseUrl}`);
  console.log(`Limit    : ${limit ?? 'ALL'}`);
  console.log('============================================================\n');

  // --- CRITICAL PRODUCTION SAFETY GATE ---
  // A real (non---dry-run) run against the production Worker is refused
  // unless --confirm-production was explicitly passed. --dry-run is always
  // allowed against any target, since it never writes anything.
  if (!dryRun && isProductionTarget && !confirmProduction) {
    console.error(
      'Refusing to run: this is a REAL RUN targeting the PRODUCTION Worker.\n' +
        'Re-run with --confirm-production if this is intentional, e.g.:\n' +
        '  node scripts/backfill-gallery-images.js --limit=1 --confirm-production\n' +
        'Or add --dry-run to preview safely without writing anything.'
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const sharp = await loadSharp();

  const { data: rows, error } = await supabase
    .from('decor_items')
    .select('id, title, image_url, gallery_image_url')
    .is('gallery_image_url', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to query decor_items:', error.message);
    process.exitCode = 1;
    return;
  }

  const eligibleRows = (rows ?? []).filter((row) => parseOriginalFromImageUrl(row.image_url, workerUrl) !== null);
  const staticAssetCount = (rows ?? []).length - eligibleRows.length;

  console.log(`Rows with gallery_image_url IS NULL : ${rows?.length ?? 0}`);
  console.log(`  R2-backed (eligible)              : ${eligibleRows.length}`);
  console.log(`  static seed assets (will skip)     : ${staticAssetCount}\n`);

  const toProcess = limit ? eligibleRows.slice(0, limit) : eligibleRows;

  // Strictly sequential — never concurrent. A few dozen small images
  // processed one-at-a-time keeps peak memory to a single image's
  // decode/encode buffers at a time (tens of MB, not hundreds), and this is
  // a one-time maintenance job where total runtime of a few minutes is
  // irrelevant.
  const results = [];
  for (const [index, row] of toProcess.entries()) {
    const result = await processRow(row, { workerUrl, dryRun, sharp, supabase });
    results.push(result);
    printRow(index, toProcess.length, result);
  }

  const skippedStaticResults = (rows ?? [])
    .filter((row) => parseOriginalFromImageUrl(row.image_url, workerUrl) === null)
    .map((row) => ({ id: row.id, title: row.title, status: 'skipped', flags: { eligible: false } }));
  const allResults = [...results, ...skippedStaticResults];

  const tally = allResults.reduce(
    (acc, r) => {
      if (!r.flags.eligible) acc.skipped += 1;
      else acc.processed += 1;
      if (r.flags.uploaded) acc.uploaded += 1;
      if (r.flags.alreadyExisted) acc.alreadyExisted += 1;
      if (r.flags.dbUpdatedFlag) acc.dbUpdated += 1;
      if (r.flags.failed) acc.failed += 1;
      if (r.flags.orphaned) acc.orphaned += 1;
      return acc;
    },
    { processed: 0, skipped: 0, uploaded: 0, alreadyExisted: 0, dbUpdated: 0, failed: 0, orphaned: 0 }
  );

  console.log('============================================================');
  console.log(`${dryRun ? 'DRY RUN SUMMARY (nothing was uploaded or written)' : 'SUMMARY'}`);
  console.log('============================================================');
  console.log(`Processed                : ${tally.processed}`);
  console.log(`Skipped                  : ${tally.skipped}`);
  console.log(`Uploaded${dryRun ? ' (would be)' : '          '} : ${tally.uploaded}`);
  console.log(`Already existed          : ${tally.alreadyExisted}`);
  console.log(`DB updated${dryRun ? ' (would be)' : '        '} : ${tally.dbUpdated}`);
  console.log(`Failed                   : ${tally.failed}`);
  console.log(`Orphaned gallery objects : ${tally.orphaned}`);

  const reportPath = path.join(
    REPO_ROOT,
    'scripts',
    `backfill-gallery-images.report.${dryRun ? 'dry-run.' : ''}${Date.now()}.json`
  );
  const fs = await import('node:fs/promises');
  // Report contains only row ids/keys/dimensions/sizes/statuses — never any
  // credential or header value.
  await fs.writeFile(reportPath, JSON.stringify({ dryRun, limit, workerUrl, tally, results: allResults }, null, 2), 'utf8');
  console.log(`\nFull per-row report written to: ${reportPath}`);

  process.exitCode = tally.failed > 0 || tally.orphaned > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
