import "dotenv/config";
import { Bot, InputFile } from "grammy";
import { existsSync } from "fs";
import { join } from "path";
import { getAllCards } from "../src/tarot/cards";
import { getCachedFileId, upsertCardCache } from "../src/db";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN не задан в .env");
  process.exit(1);
}

const chatId = process.env["PRELOAD_CHAT_ID"];
if (!chatId) {
  console.error("PRELOAD_CHAT_ID не задан в .env");
  process.exit(1);
}

const PROJECT_ROOT = join(__dirname, "..");

async function main() {
  const bot = new Bot(token!);
  const cards = getAllCards();

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`🔄 Preloading file_ids for ${cards.length} cards...`);
  console.log(`📨 Target chat: ${chatId}\n`);

  for (const card of cards) {
    if (getCachedFileId(card.id)) {
      skipped++;
      continue;
    }

    const imagePath = join(PROJECT_ROOT, card.image_path);
    if (!existsSync(imagePath)) {
      console.log(`⚠️  [${card.id}] ${card.name_ru} — image not found, skipping`);
      errors++;
      continue;
    }

    process.stdout.write(`📤 [${card.id}] ${card.name_ru} ... `);

    try {
      const result = await bot.api.sendPhoto(
        chatId!,
        new InputFile(imagePath, `${card.name_ru}.jpg`),
        { caption: `🃏 ${card.name_ru} (id: ${card.id})` }
      );

      const photo = result.photo;
      if (photo?.length) {
        const biggest = photo[photo.length - 1];
        upsertCardCache(card.id, biggest.file_id, biggest.file_unique_id);
        sent++;
        console.log("✅");
      } else {
        errors++;
        console.log("❌ no photo in response");
      }
    } catch (err: any) {
      errors++;
      console.log(`❌ ${err.message}`);
    }

    // Delay to avoid Telegram rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `\n📊 Done: ${sent} sent, ${skipped} already cached, ${errors} errors`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
