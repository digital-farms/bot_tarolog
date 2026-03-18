import "dotenv/config";
import { existsSync } from "fs";
import { join } from "path";
import { Bot, InlineKeyboard, Context, InputFile } from "grammy";
import { Spread, getAllSpreads, getSpreadById, getLocalizedSpread } from "./tarot/spreads";
import { drawCards } from "./tarot/deck";
import { buildReadingContext, formatCardsMessage } from "./tarot/reading";
import { checkSafety } from "./safety";
import { getInterpretation } from "./llm";
import { generateVoice } from "./tts";
import { sendCardsMediaGroup } from "./tarot/images";
import {
  upsertUser, touchUser,
  saveReading, updateReadingInterpretation,
  savePayment,
  getCachedFileId, upsertCardCache,
  subscribeDailyCard, unsubscribeDailyCard, isDailySubscribed,
  getTodayDailyCard, revealDailyCard,
  getFreeReadings, decrementFreeReading,
} from "./db";
import { startDailyCron, sendDailyToUser, todayDateStr } from "./daily";
import { startAdmin } from "./admin";
import { getCardById, getCardName } from "./tarot/cards";
import { t, getUserLang, setUserLang, detectLang, Lang } from "./i18n";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN не задан в .env");
  process.exit(1);
}

const bot = new Bot(token);

type Phase = "idle" | "awaiting_question" | "awaiting_spread" | "confirming" | "awaiting_payment";

interface UserState {
  phase: Phase;
  lang: Lang;
  question?: string;
  spreadId?: string;
  pendingText?: string;
  paid?: boolean;
  lastInterpretation?: string;
  lastReadingId?: number;
  dailyCardId?: number;
  dailyCardReversed?: boolean;
  lastPaymentChargeId?: string;
}

const sessions = new Map<number, UserState>();

function getState(chatId: number): UserState {
  if (!sessions.has(chatId)) sessions.set(chatId, { phase: "idle", lang: "ru" });
  return sessions.get(chatId)!;
}

function getLang(ctx: Context): Lang {
  const state = sessions.get(ctx.chat!.id);
  if (state?.lang) return state.lang;
  if (ctx.from) return getUserLang(ctx.from.id);
  return "ru";
}

async function withChatAction<T>(
  ctx: Context,
  action: "typing" | "record_voice" | "upload_voice",
  fn: () => Promise<T>
): Promise<T> {
  const chatId = ctx.chat!.id;
  const send = () => ctx.api.sendChatAction(chatId, action).catch(() => {});
  await send();
  const interval = setInterval(send, 4000);
  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}

function DISCLAIMER(lang: Lang): string {
  return t("common.disclaimer", lang);
}

// ── /start ──────────────────────────────────────────────────────────────────
bot.command("start", async (ctx) => {
  const state = getState(ctx.chat.id);
  state.phase = "idle";
  state.question = undefined;
  state.spreadId = undefined;
  state.pendingText = undefined;

  upsertUser(
    ctx.from!.id,
    ctx.from?.username,
    ctx.from?.first_name,
    ctx.from?.language_code
  );
  subscribeDailyCard(ctx.from!.id);

  // Auto-detect language for first-time users, then show chooser
  const detected = detectLang(ctx.from?.language_code);
  state.lang = getUserLang(ctx.from!.id) || detected;

  const langKb = new InlineKeyboard()
    .text("\ud83c\uddfa\ud83c\udde6 Українська", "set_lang:uk")
    .text("\ud83c\uddec\ud83c\udde7 English", "set_lang:en")
    .text("\ud83c\uddf7\ud83c\uddfa Русский", "set_lang:ru");

  await ctx.reply(
    t("lang.choose", state.lang),
    { parse_mode: "HTML", reply_markup: langKb }
  );
});

// ── Выбор языка ─────────────────────────────────────────────────────────────
bot.callbackQuery(/^set_lang:/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const lang = ctx.callbackQuery.data.replace("set_lang:", "") as Lang;
  if (!["ru", "uk", "en"].includes(lang)) return;

  const state = getState(ctx.chat!.id);
  state.lang = lang;
  setUserLang(ctx.from!.id, lang);

  // Убираем кнопки выбора языка
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch (_) {}

  const kb = new InlineKeyboard()
    .text(t("btn.begin_reading", lang), "begin_reading");

  await ctx.reply(
    t("lang.set", lang) + "\n\n" + t("start.welcome", lang),
    { parse_mode: "HTML", reply_markup: kb }
  );
});

// ── Кнопка «Начать расклад» ────────────────────────────────────────────────
bot.callbackQuery("begin_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.phase = "awaiting_question";
  state.question = undefined;
  state.spreadId = undefined;

  const L = getLang(ctx);
  await ctx.reply(t("start.ask_question", L), { parse_mode: "HTML" });
});

// ── Выбор расклада (inline keyboard) ────────────────────────────────────────
function spreadKeyboard(userId: number, lang: Lang): InlineKeyboard {
  const freeLeft = getFreeReadings(userId);
  const kb = new InlineKeyboard();
  for (const s of getAllSpreads()) {
    const ls = getLocalizedSpread(s, lang);
    let label: string;
    if (s.id === "whisper" && freeLeft > 0) {
      label = t("spread.label_free", lang, { name: ls.name, count: ls.count, left: freeLeft });
    } else if (s.price > 0) {
      label = t("spread.label_paid", lang, { name: ls.name, count: ls.count, price: s.price });
    } else {
      label = t("spread.label_basic", lang, { name: ls.name, count: ls.count });
    }
    kb.text(label, `spread:${s.id}`).row();
  }
  kb.text(t("btn.spreads_info", lang), "spreads_info").row();
  return kb;
}

async function askSpread(ctx: Context) {
  const L = getLang(ctx);
  await ctx.reply(
    t("spread.choose", L),
    { parse_mode: "HTML", reply_markup: spreadKeyboard(ctx.from!.id, L) }
  );
}

// ── Информация о раскладах ──────────────────────────────────────────────────
bot.callbackQuery("spreads_info", async (ctx) => {
  await ctx.answerCallbackQuery();
  const L = getLang(ctx);

  const lines = getAllSpreads().map((s) => {
    const ls = getLocalizedSpread(s, L);
    const priceTag = s.price > 0 ? `⭐ ${s.price}` : t("spread.price_free", L);
    return t("spread.info_line", L, { name: ls.name, count: ls.count, priceTag, description: ls.description });
  });

  const backKb = new InlineKeyboard().text(t("btn.back_to_spreads", L), "back_to_spreads");

  await ctx.reply(
    t("spread.info_title", L) + "\n\n" + lines.join("\n\n"),
    { parse_mode: "HTML", reply_markup: backKb }
  );
});

bot.callbackQuery("back_to_spreads", async (ctx) => {
  await ctx.answerCallbackQuery();
  await askSpread(ctx);
});

// ── Callback: выбор расклада ────────────────────────────────────────────────
bot.callbackQuery(/^spread:/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const spreadId = ctx.callbackQuery.data.replace("spread:", "");
  const state = getState(ctx.chat!.id);
  state.spreadId = spreadId;
  state.phase = "awaiting_spread";

  if (!state.question) {
    state.phase = "awaiting_question";
    const L = getLang(ctx);
    await ctx.reply(t("spread.ask_question_first", L), { parse_mode: "HTML" });
    return;
  }

  await doReading(ctx, state);
});

// ── Оплата Telegram Stars ──────────────────────────────────────────────────
async function sendStarInvoice(ctx: Context, spread: Spread) {
  const L = getLang(ctx);
  await ctx.api.sendInvoice(
    ctx.chat!.id,
    t("payment.invoice_title", L, { name: getLocalizedSpread(spread, L).name }),
    t("payment.invoice_desc", L),
    `pay:${spread.id}`,
    "XTR",
    [{ label: getLocalizedSpread(spread, L).name, amount: spread.price }],
    { provider_token: "" }
  );
}

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload;

  if (!payload.startsWith("pay:")) return;

  const state = getState(ctx.chat.id);

  // ── Оплата озвучки ──
  if (payload === "pay:voice") {
    savePayment(ctx.from!.id, payment.total_amount, payload, payment.telegram_payment_charge_id);
    state.lastPaymentChargeId = payment.telegram_payment_charge_id;
    state.phase = "idle";

    const L = getLang(ctx);
    if (!state.lastInterpretation) {
      await ctx.reply(t("voice.not_found", L), { parse_mode: "HTML" });
      return;
    }

    try {
      const audioBuf = await withChatAction(ctx, "record_voice", () =>
        generateVoice(state.lastInterpretation!)
      );

      const voiceKb = new InlineKeyboard()
        .text(t("btn.new_reading", L), "new_reading")
        .row()
        .text(t("btn.change_spread", L), "change_spread")
        .row()
        .text(t("btn.change_question", L), "change_question");

      await ctx.replyWithVoice(new InputFile(audioBuf, "reading.ogg"), {
        reply_markup: voiceKb,
      });
    } catch (err: any) {
      console.error("TTS error:", err);
      const desc = err?.description ?? err?.message ?? "";
      if (desc.includes("VOICE_MESSAGES_FORBIDDEN")) {
        // Refund Stars — user can't receive voice messages
        try {
          await ctx.api.raw.refundStarPayment({
            user_id: ctx.from!.id,
            telegram_payment_charge_id: payment.telegram_payment_charge_id,
          });
          await ctx.reply(t("voice.forbidden_refund", L), { parse_mode: "HTML" });
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
          await ctx.reply(t("voice.forbidden_no_refund", L));
        }
      } else {
        // Other TTS/send error — also refund
        try {
          await ctx.api.raw.refundStarPayment({
            user_id: ctx.from!.id,
            telegram_payment_charge_id: payment.telegram_payment_charge_id,
          });
          await ctx.reply(t("voice.error_refund", L), { parse_mode: "HTML" });
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
          await ctx.reply(t("voice.error_no_refund", L));
        }
      }
    }
    return;
  }

  // ── Оплата карты дня ──
  if (payload === "pay:daily") {
    savePayment(ctx.from!.id, payment.total_amount, payload, payment.telegram_payment_charge_id);

    const L = getLang(ctx);
    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (!today || today.revealed) {
      state.phase = "idle";
      await ctx.reply(t("daily.revealed_already", L), { parse_mode: "HTML" });
      return;
    }

    revealDailyCard(today.id);
    const card = getCardById(today.card_id);
    if (!card) {
      state.phase = "idle";
      await ctx.reply(t("common.error", L), { parse_mode: "HTML" });
      return;
    }

    const reversed = today.reversed === 1;
    const orient = t(reversed ? "common.reversed" : "common.upright", L);
    const meaning = reversed ? card.short_reversed : card.short_upright;
    const keywords = reversed ? card.keywords_reversed : card.keywords_upright;

    // Send card photo
    const cached = getCachedFileId(card.id);
    const imgPath = join(__dirname, "..", "data", "images", "rws", `${card.id}.jpg`);

    const photoSrc = cached
      ? cached.tg_file_id
      : existsSync(imgPath)
        ? new InputFile(imgPath, `${card.name_ru}.jpg`)
        : null;

    if (photoSrc) {
      try {
        const result = await ctx.api.sendPhoto(ctx.chat!.id, photoSrc, {
          caption: t("daily.card_caption", L, {
            name: getCardName(card, L), orient, meaning, keywords: keywords.join(", "),
          }),
          parse_mode: "HTML",
        });
        if (!cached && result.photo?.length) {
          const biggest = result.photo[result.photo.length - 1];
          upsertCardCache(card.id, biggest.file_id, biggest.file_unique_id);
        }
      } catch (imgErr) {
        console.error("Daily card image error:", imgErr);
      }
    }

    // Set up state for auto Шёпот карт with daily card
    state.spreadId = "whisper";
    state.dailyCardId = card.id;
    state.dailyCardReversed = reversed;
    state.paid = true;
    state.phase = "awaiting_question";

    await ctx.reply(t("daily.ask_card_question", L), { parse_mode: "HTML" });
    return;
  }

  // ── Оплата расклада ──
  const spreadId = payload.replace("pay:", "");
  state.spreadId = spreadId;

  savePayment(
    ctx.from!.id,
    payment.total_amount,
    payload,
    payment.telegram_payment_charge_id
  );

  state.paid = true;
  const L2 = getLang(ctx);
  await ctx.reply(t("payment.received", L2), { parse_mode: "HTML" });
  await doReading(ctx, state);
});

// ── Callback: подтверждение текста как вопроса ──────────────────────────────
bot.callbackQuery("confirm_question", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);

  if (!state.pendingText) {
    state.phase = "idle";
    return;
  }

  state.question = state.pendingText;
  state.pendingText = undefined;
  state.phase = "awaiting_spread";

  if (state.spreadId) {
    await doReading(ctx, state);
  } else {
    await askSpread(ctx);
  }
});

bot.callbackQuery("edit_question", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.pendingText = undefined;
  state.phase = "awaiting_question";
  const L = getLang(ctx);
  await ctx.reply(t("question.rewrite", L), { parse_mode: "HTML" });
});

bot.callbackQuery("decline_question", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.pendingText = undefined;
  state.phase = "idle";
  const L = getLang(ctx);
  await ctx.reply(t("question.declined", L), {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading"),
  });
});

// ── Отмена оплаты ─────────────────────────────────────────────────────────
bot.callbackQuery("cancel_payment", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.phase = "idle";
  state.spreadId = undefined;
  state.paid = false;

  const L = getLang(ctx);
  const kb = new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading");
  await ctx.reply(t("payment.cancelled", L), { parse_mode: "HTML", reply_markup: kb });
});

// ── Callback: кнопки после расклада ─────────────────────────────────────────
bot.callbackQuery("new_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.question = undefined;
  state.spreadId = undefined;
  state.phase = "awaiting_question";
  const L = getLang(ctx);
  await ctx.reply(t("question.new", L), { parse_mode: "HTML" });
});

bot.callbackQuery("change_spread", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.spreadId = undefined;
  state.phase = "awaiting_spread";
  await askSpread(ctx);
});

bot.callbackQuery("change_question", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.question = undefined;
  state.phase = "awaiting_question";
  const L = getLang(ctx);
  await ctx.reply(t("question.change", L), { parse_mode: "HTML" });
});

// ── Текстовое сообщение ────────────────────────────────────────────────────
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  const state = getState(ctx.chat.id);

  const L = getLang(ctx);

  // Проверка безопасности всегда
  const safety = checkSafety(text, L);
  if (!safety.safe) {
    state.phase = "idle";
    await ctx.reply(safety.message, { parse_mode: "HTML" });
    return;
  }

  // Если бот явно ждёт вопрос — принимаем сразу
  if (state.phase === "awaiting_question") {
    state.question = text;
    state.phase = "awaiting_spread";

    if (state.spreadId) {
      await doReading(ctx, state);
    } else {
      await askSpread(ctx);
    }
    return;
  }

  // Во время ожидания оплаты — игнорируем текст
  if (state.phase === "awaiting_payment") {
    await ctx.reply(t("payment.pay_first", L), { parse_mode: "HTML" });
    return;
  }

  // Иначе — спрашиваем, хочет ли пользователь сделать расклад на этот текст
  state.pendingText = text;
  state.phase = "confirming";

  const confirmKb = new InlineKeyboard()
    .text(t("btn.confirm_yes", L), "confirm_question")
    .row()
    .text(t("btn.confirm_edit", L), "edit_question")
    .row()
    .text(t("btn.confirm_no", L), "decline_question");

  await ctx.reply(t("question.confirm", L), { parse_mode: "HTML", reply_markup: confirmKb });
});

// ── Основная логика расклада ────────────────────────────────────────────────
async function doReading(ctx: Context, state: UserState) {
  const L = getLang(ctx);
  const spread = getSpreadById(state.spreadId!);
  if (!spread) {
    await ctx.reply(t("reading.spread_not_found", L), { parse_mode: "HTML" });
    return;
  }

  // Free whisper readings for new users
  const isFreeWhisper = spread.id === "whisper" && !state.paid && getFreeReadings(ctx.from!.id) > 0;

  if (spread.price > 0 && !state.paid && !isFreeWhisper) {
    state.phase = "awaiting_payment";
    await sendStarInvoice(ctx, spread);

    const freeLeft = spread.id === "whisper" ? getFreeReadings(ctx.from!.id) : -1;
    const freeHint = freeLeft === 0 ? "\n" + t("reading.free_ended", L) : "";

    const cancelKb = new InlineKeyboard()
      .text(t("btn.cancel", L), "cancel_payment");
    await ctx.reply(
      t("payment.required", L, { price: spread.price }) + freeHint,
      { parse_mode: "HTML", reply_markup: cancelKb }
    );
    return;
  }

  if (isFreeWhisper) {
    decrementFreeReading(ctx.from!.id);
    const left = getFreeReadings(ctx.from!.id);
    if (left > 0) {
      await ctx.reply(t("reading.free_left", L, { left }), { parse_mode: "HTML" });
    } else {
      await ctx.reply(t("reading.free_last", L), { parse_mode: "HTML" });
    }
  }

  state.paid = false;
  touchUser(ctx.from!.id);

  const question = state.question!;

  // Use daily card if set, otherwise draw new cards
  let drawn;
  if (state.dailyCardId != null) {
    const dailyCard = getCardById(state.dailyCardId);
    if (dailyCard) {
      drawn = [{ card: dailyCard, reversed: state.dailyCardReversed ?? false }];
    } else {
      drawn = drawCards(spread.count);
    }
    state.dailyCardId = undefined;
    state.dailyCardReversed = undefined;
  } else {
    drawn = drawCards(spread.count);
  }

  const ls = getLocalizedSpread(spread, L);
  const readingCtx = buildReadingContext(question, { ...spread, name: ls.name, positions: ls.positions }, drawn, L);
  const cardsMsg = formatCardsMessage(readingCtx, L);

  const cardsJson = JSON.stringify(
    drawn.map((d) => ({ id: d.card.id, name: d.card.name_ru, reversed: d.reversed }))
  );
  const readingId = saveReading(ctx.from!.id, spread.id, question, cardsJson, null);
  state.lastReadingId = readingId;

  await ctx.reply(
    t("reading.cards_drawn", L, { spread: ls.name, cards: cardsMsg }),
    { parse_mode: "HTML" }
  );

  try {
    await sendCardsMediaGroup(ctx.api, ctx.chat!.id, drawn, L);
  } catch (imgErr) {
    console.error("Image send error:", imgErr);
  }

  try {
    const safety = checkSafety(question, L);
    const sensitive = safety.safe ? safety.sensitive : false;
    const interpretation = await withChatAction(ctx, "typing", () =>
      getInterpretation(readingCtx, sensitive, L)
    );

    state.lastInterpretation = interpretation;
    if (state.lastReadingId) {
      updateReadingInterpretation(state.lastReadingId, interpretation);
    }

    const afterKb = new InlineKeyboard()
      .text(t("btn.voice_reading", L), "voice_reading")
      .row()
      .text(t("btn.new_reading", L), "new_reading")
      .row()
      .text(t("btn.change_spread", L), "change_spread")
      .row()
      .text(t("btn.change_question", L), "change_question");

    await ctx.reply(interpretation + DISCLAIMER(L), {
      reply_markup: afterKb,
    });

    state.phase = "idle";
  } catch (err) {
    console.error("LLM error:", err);
    await ctx.reply(t("reading.llm_error", L), { parse_mode: "HTML" });
    state.phase = "idle";
  }
}

// ── Озвучка расклада ─────────────────────────────────────────────────────────
bot.callbackQuery("voice_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);

  const L = getLang(ctx);
  if (!state.lastInterpretation) {
    await ctx.reply(t("voice.no_reading", L), { parse_mode: "HTML" });
    return;
  }

  state.phase = "awaiting_payment";

  await ctx.api.sendInvoice(
    ctx.chat!.id,
    t("voice.invoice_title", L),
    t("voice.invoice_desc", L),
    "pay:voice",
    "XTR",
    [{ label: t("voice.invoice_label", L), amount: 1 }],
    { provider_token: "" }
  );

  const cancelKb = new InlineKeyboard().text(t("btn.cancel", L), "cancel_payment");
  await ctx.reply(t("voice.pay_prompt", L), { parse_mode: "HTML", reply_markup: cancelKb });
});

// ── Карта дня ───────────────────────────────────────────────────────────────
bot.command("daily", async (ctx) => {
  upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name, ctx.from?.language_code);
  const L = getLang(ctx);

  if (isDailySubscribed(ctx.from!.id)) {
    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (today && !today.revealed) {
      const kb = new InlineKeyboard()
        .text(t("btn.reveal_daily", L), "reveal_daily")
        .row()
        .text(t("btn.unsub_daily", L), "unsub_daily");
      await ctx.reply(t("daily.waiting", L), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    if (today && today.revealed) {
      await ctx.reply(
        t("daily.already_today", L),
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading") }
      );
      return;
    }
    // Subscribed but no card for today yet — send it now
    await sendDailyToUser(bot, ctx.from!.id);
    return;
  }

  subscribeDailyCard(ctx.from!.id);
  await ctx.reply(t("daily.subscribed", L), { parse_mode: "HTML" });
  await sendDailyToUser(bot, ctx.from!.id);
});

bot.callbackQuery("toggle_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name, ctx.from?.language_code);
  const L = getLang(ctx);

  if (isDailySubscribed(ctx.from!.id)) {
    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (today && !today.revealed) {
      const kb = new InlineKeyboard()
        .text(t("btn.reveal_daily", L), "reveal_daily")
        .row()
        .text(t("btn.unsub_daily", L), "unsub_daily");
      await ctx.reply(t("daily.waiting_short", L), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    if (today && today.revealed) {
      await ctx.reply(
        t("daily.already_revealed", L),
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading") }
      );
      return;
    }
    await sendDailyToUser(bot, ctx.from!.id);
    return;
  }

  subscribeDailyCard(ctx.from!.id);
  await ctx.reply(t("daily.subscribed_short", L), { parse_mode: "HTML" });
  await sendDailyToUser(bot, ctx.from!.id);
});

bot.callbackQuery("reveal_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  const L = getLang(ctx);

  const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
  if (!today) {
    await ctx.reply(t("daily.not_chosen", L), { parse_mode: "HTML" });
    return;
  }
  if (today.revealed) {
    const card = getCardById(today.card_id);
    if (card) {
      await ctx.reply(
        t("daily.already_revealed_card", L, { name: getCardName(card, L) }),
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading") }
      );
    }
    return;
  }

  // Send invoice for reveal
  state.phase = "awaiting_payment";
  await ctx.api.sendInvoice(
    ctx.chat!.id,
    t("daily.reveal_title", L),
    t("daily.reveal_desc", L),
    "pay:daily",
    "XTR",
    [{ label: t("daily.reveal_label", L), amount: 1 }],
    { provider_token: "" }
  );

  const cancelKb = new InlineKeyboard().text(t("btn.cancel", L), "cancel_payment");
  await ctx.reply(t("daily.reveal_pay", L), { parse_mode: "HTML", reply_markup: cancelKb });
});

bot.callbackQuery("unsub_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  const L = getLang(ctx);
  unsubscribeDailyCard(ctx.from!.id);
  await ctx.reply(
    t("daily.unsubscribed", L),
    { parse_mode: "HTML", reply_markup: new InlineKeyboard().text(t("btn.begin_reading", L), "begin_reading") }
  );
});

// ── Обработка ошибок ────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error("Bot error:", err.message ?? err);
});

// ── Запуск ──────────────────────────────────────────────────────────────────
startDailyCron(bot);
startAdmin();

bot.start({
  onStart: () => console.log("Tarot bot started!"),
});
