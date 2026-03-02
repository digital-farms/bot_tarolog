import { readFileSync, existsSync, mkdirSync, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

interface ManifestEntry {
  card_id: number;
  commons_filename: string;
}

const PROJECT_ROOT = join(__dirname, "..");
const MANIFEST_PATH = join(PROJECT_ROOT, "data", "rws_manifest.json");
const OUTPUT_DIR = join(PROJECT_ROOT, "data", "images", "rws");

function getWikimediaDirectUrl(filename: string): string {
  const { createHash } = require("crypto");
  const name = filename.replace(/ /g, "_");
  const md5 = createHash("md5").update(name).digest("hex");
  const a = md5[0];
  const ab = md5[0] + md5[1];
  return `https://upload.wikimedia.org/wikipedia/commons/${a}/${ab}/${encodeURIComponent(name)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function downloadFile(url: string, dest: string, attempt = 1): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "TarotBot/1.0 (educational project; tarot card images)" },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) {
    if (attempt >= 4) throw new Error(`HTTP 429 after ${attempt} attempts for ${url}`);
    const wait = attempt * 5_000;
    process.stdout.write(`⏳ 429 rate-limit, waiting ${wait / 1000}s (attempt ${attempt})... `);
    await sleep(wait);
    return downloadFile(url, dest, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  const body = res.body;
  if (!body) throw new Error("Empty response body");

  const nodeStream = Readable.fromWeb(body as any);
  const fileStream = createWriteStream(dest);
  await pipeline(nodeStream, fileStream);
}

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf-8")
  );

  console.log(`📦 Manifest loaded: ${manifest.length} cards`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created ${OUTPUT_DIR}`);
  }

  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of manifest) {
    const destPath = join(OUTPUT_DIR, `${entry.card_id}.jpg`);

    if (existsSync(destPath)) {
      skipped++;
      continue;
    }

    const url = getWikimediaDirectUrl(entry.commons_filename);
    process.stdout.write(
      `⬇️  [${entry.card_id}] ${entry.commons_filename} ... `
    );

    try {
      await downloadFile(url, destPath);
      downloaded++;
      console.log("✅");
    } catch (err: any) {
      errors++;
      console.log(`❌ ${err.message}`);

      // Retry once with Wikimedia API fallback
      try {
        console.log(`   🔄 Trying Wikimedia API fallback...`);
        const apiUrl = await getUrlFromApi(entry.commons_filename);
        if (apiUrl) {
          await downloadFile(apiUrl, destPath);
          downloaded++;
          errors--;
          console.log(`   ✅ Fallback succeeded`);
        }
      } catch (err2: any) {
        console.log(`   ❌ Fallback failed: ${err2.message}`);
      }
    }

    // Delay to respect Wikimedia rate limits
    await sleep(1500);
  }

  console.log(
    `\n📊 Done: ${downloaded} downloaded, ${skipped} skipped, ${errors} errors`
  );

  if (errors > 0) {
    process.exit(1);
  }
}

async function getUrlFromApi(filename: string): Promise<string | null> {
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?` +
    `action=query&titles=File:${encodeURIComponent(filename)}` +
    `&prop=imageinfo&iiprop=url&format=json`;

  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "TarotBot/1.0 (educational project)" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return null;

  const data: any = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  for (const pageId of Object.keys(pages)) {
    const info = pages[pageId]?.imageinfo?.[0];
    if (info?.url) return info.url;
  }
  return null;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
