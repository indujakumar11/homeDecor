// ============================================================================
// ONE-TIME SCRIPT — category carousel thumbnail generation
// ============================================================================
// Generates small WebP thumbnails for the home-page CategoryCarousel from
// the existing static originals in public/assets/categories and
// public/assets/services. Run manually with `node scripts/generate-category-
// thumbnails.mjs` whenever a source image changes — NOT part of the build,
// NOT imported by the app, and the `sharp` package it depends on is a
// devDependency used only by this script (never bundled into the site).
//
// Originals are read-only here (fs.readFile only) — nothing in this script
// ever writes back to the source files, only to new `*-thumb.webp` files.
//
// Sizing: scale to fit within a 200x200 box (fit: 'inside'), preserving the
// original aspect ratio and never upscaling an already-small source
// (withoutEnlargement) — matches the carousel's ~96px (78px mobile) display
// size with headroom for retina displays, without cropping any content.
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const THUMB_MAX_EDGE = 200;
const THUMB_QUALITY = 78;

const TARGETS = [
  { dir: 'public/assets/categories', files: ['murals.jpg', 'frp-sculptures.jpg', 'marble-sculptures.jpg', 'parametric.jpg', 'interior-decor.jpg'] },
  { dir: 'public/assets/services', files: ['signage.webp', 'corporate.webp', 'supermarket.webp', 'turnkey.webp'] },
];

function thumbNameFor(file) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  return `${base}-thumb.webp`;
}

async function main() {
  for (const { dir, files } of TARGETS) {
    const absDir = path.join(ROOT, dir);
    const existing = new Set(await readdir(absDir));

    for (const file of files) {
      if (!existing.has(file)) {
        console.warn(`[skip] ${dir}/${file} not found`);
        continue;
      }

      const srcPath = path.join(absDir, file);
      const outName = thumbNameFor(file);
      const outPath = path.join(absDir, outName);

      const srcMeta = await sharp(srcPath).metadata();
      const srcSize = (await stat(srcPath)).size;

      await sharp(srcPath)
        .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(outPath);

      const outMeta = await sharp(outPath).metadata();
      const outSize = (await stat(outPath)).size;

      console.log(
        `${dir}/${outName}: ${srcMeta.width}x${srcMeta.height} (${(srcSize / 1024).toFixed(0)} KB) ` +
        `-> ${outMeta.width}x${outMeta.height} (${(outSize / 1024).toFixed(1)} KB)`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
