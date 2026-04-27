/**
 * Uploads the 12 system template thumbnails from `apps/web/public/templates`
 * into the public `template-thumbnails` Supabase Storage bucket under the
 * `system/` prefix. Migration `029_template_thumbnails.sql` already seeds
 * the matching `public.templates` rows with `thumbnail_url = 'system/<file>'`,
 * so all this script does is push the binary files to storage.
 *
 * Why this exists: gpt-image-1 fetches reference images server-side and
 * cannot reach localhost (or any non-public origin). Hosting the thumbnails
 * in public Supabase Storage makes dev and prod behave identically.
 *
 * Run once after applying the migration on a fresh project:
 *   npx tsx apps/web/scripts/upload-system-template-thumbnails.ts
 *
 * Idempotent — uses `upsert: true`.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "template-thumbnails";
const TEMPLATES_DIR = path.resolve(__dirname, "..", "public", "templates");
const STORAGE_PREFIX = "system";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

async function main(): Promise<void> {
  const files = (await readdir(TEMPLATES_DIR)).filter((f) =>
    /\.(png|jpe?g|webp|gif)$/i.test(f)
  );

  if (files.length === 0) {
    console.error(`No template images found in ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  console.log(`Uploading ${files.length} system template thumbnails…\n`);

  for (const file of files) {
    const localPath = path.join(TEMPLATES_DIR, file);
    const storagePath = `${STORAGE_PREFIX}/${file}`;
    const buffer = await readFile(localPath);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: contentTypeFor(file),
        upsert: true,
      });

    if (uploadErr) {
      console.error(`  ✗ ${file}: ${uploadErr.message}`);
      continue;
    }

    console.log(`  ✓ ${storagePath}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
