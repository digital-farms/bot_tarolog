import cron from "node-cron";
import { join } from "path";
import { InputFile } from "grammy";
import type { Bot } from "grammy";
import { getAllCards } from "./tarot/cards";
import {
  getActiveDailySubscribers,
  saveDailyCard,
  getTodayDailyCard,
  getCachedFileId,
} from "./db";
import { t, getUserLang } from "./i18n";

const RUBASHKA_PATH = join(__dirname, "..", "data", "images", "rubashka__obratnaya_storona_igralnoy_karti.jpg");

function todayDateStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
}

function pickRandomCard(): { cardId: number; reversed: boolean } {
  const cards = getAllCards();
  const card = cards[Math.floor(Math.random() * cards.length)];
  return { cardId: card.id, reversed: Math.random() < 0.5 };
}

async function sendDailyToUser(bot: Bot, userTgId: number): Promise<void> {
  const date = todayDateStr();

  let existing = getTodayDailyCard(userTgId, date);
  if (!existing) {
    const { cardId, reversed } = pickRandomCard();
    saveDailyCard(userTgId, cardId, reversed, date);
    existing = getTodayDailyCard(userTgId, date);
  }

  // Already revealed = already sent successfully before
  if (existing?.revealed) return;

  const { InlineKeyboard } = await import("grammy");
  const L = getUserLang(userTgId);

  const kb = new InlineKeyboard()
    .text(t("btn.reveal_daily", L), "reveal_daily")
    .row()
    .text(t("btn.unsub_daily", L), "unsub_daily");

  try {
    const cached = getCachedFileId(-1);
    const photo = cached
      ? cached.tg_file_id
      : new InputFile(RUBASHKA_PATH, "card_back.jpg");

    await bot.api.sendPhoto(userTgId, photo, {
      caption: t("daily.morning", L),
      parse_mode: "HTML",
      reply_markup: kb,
    });
    console.log(`✅ Daily card sent to ${userTgId}`);
  } catch (err: any) {
    if (err?.error_code === 403) {
      const { unsubscribeDailyCard } = await import("./db");
      unsubscribeDailyCard(userTgId);
      console.log(`🔕 User ${userTgId} blocked bot, unsubscribed from daily`);
    } else {
      console.error(`Daily card send error for ${userTgId}:`, err.message);
    }
  }
}

export function startDailyCron(bot: Bot): void {
  // Every day at 09:30 Kyiv time
  cron.schedule("30 9 * * *", async () => {
    console.log("🌅 Daily card cron started");
    const subscribers = getActiveDailySubscribers();
    console.log(`📨 Sending to ${subscribers.length} subscribers`);

    for (const userTgId of subscribers) {
      await sendDailyToUser(bot, userTgId);
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log("✅ Daily card cron finished");

  }, { timezone: "Europe/Kyiv" });

  console.log("⏰ Daily card cron scheduled at 09:30 Europe/Kyiv");
}

export { sendDailyToUser, todayDateStr };
