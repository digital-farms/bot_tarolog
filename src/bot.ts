import "dotenv/config";
import { existsSync } from "fs";
import { join } from "path";
import { Bot, InlineKeyboard, Context, InputFile } from "grammy";
import { Spread, getAllSpreads, getSpreadById } from "./tarot/spreads";
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
import { getCardById } from "./tarot/cards";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN не задан в .env");
  process.exit(1);
}

const bot = new Bot(token);

type Phase = "idle" | "awaiting_question" | "awaiting_spread" | "confirming" | "awaiting_payment";

interface UserState {
  phase: Phase;
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
  if (!sessions.has(chatId)) sessions.set(chatId, { phase: "idle" });
  return sessions.get(chatId)!;
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

const DISCLAIMER =
  "\n\n· · ·\n🔮 Расклад — инструмент саморефлексии и развлечения. Не является медицинским, юридическим или финансовым советом.";

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

  const startKb = new InlineKeyboard()
    .text("🔮 Начать расклад", "begin_reading");

  await ctx.reply(
    "🌙 <b>Добро пожаловать в пространство Таро.</b>\n\n" +
      "Я помогу тебе заглянуть за завесу привычного и увидеть ситуацию глазами карт. " +
      "Это не пророчество и не приговор — <i>воспринимай расклад как зеркало, " +
      "в котором отражаются скрытые грани твоего вопроса.</i>\n\n" +
      "Когда будешь готов(а), нажми кнопку ниже ✨",
    { parse_mode: "HTML", reply_markup: startKb }
  );
});

// ── Кнопка «Начать расклад» ────────────────────────────────────────────────
bot.callbackQuery("begin_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.phase = "awaiting_question";
  state.question = undefined;
  state.spreadId = undefined;

  await ctx.reply(
    "🕯 <b>Сосредоточься и задай свой вопрос.</b>\n\n" +
      "<i>Чем яснее намерение — тем точнее отклик карт.</i> " +
      "Напиши то, что тревожит, интересует или не даёт покоя.",
    { parse_mode: "HTML" }
  );
});

// ── Выбор расклада (inline keyboard) ────────────────────────────────────────
function spreadKeyboard(userId: number): InlineKeyboard {
  const freeLeft = getFreeReadings(userId);
  const kb = new InlineKeyboard();
  for (const s of getAllSpreads()) {
    let label: string;
    if (s.id === "whisper" && freeLeft > 0) {
      label = `✦ ${s.name} (${s.count}) — бесплатно [${freeLeft}]`;
    } else if (s.price > 0) {
      label = `✦ ${s.name} (${s.count}) — ⭐ ${s.price}`;
    } else {
      label = `✦ ${s.name} (${s.count})`;
    }
    kb.text(label, `spread:${s.id}`).row();
  }
  kb.text("❓ Чем отличаются расклады?", "spreads_info").row();
  return kb;
}

async function askSpread(ctx: Context) {
  await ctx.reply(
    "🃏 <b>Какой расклад тебя зовёт?</b>",
    { parse_mode: "HTML", reply_markup: spreadKeyboard(ctx.from!.id) }
  );
}

// ── Информация о раскладах ──────────────────────────────────────────────────
bot.callbackQuery("spreads_info", async (ctx) => {
  await ctx.answerCallbackQuery();

  const lines = getAllSpreads().map((s) => {
    const priceTag = s.price > 0 ? `⭐ ${s.price}` : "бесплатно";
    return `<b>✦ ${s.name}</b>  •  ${s.count} карт  •  ${priceTag}\n<i>${s.description}</i>`;
  });

  const backKb = new InlineKeyboard().text("🃏 Вернуться к выбору", "back_to_spreads");

  await ctx.reply(
    "🌙 <b>О раскладах</b>\n\n" + lines.join("\n\n"),
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
    await ctx.reply(
      "🕯 <b>Сначала задай свой вопрос</b> — карты ждут намерения.",
      { parse_mode: "HTML" }
    );
    return;
  }

  await doReading(ctx, state);
});

// ── Оплата Telegram Stars ──────────────────────────────────────────────────
async function sendStarInvoice(ctx: Context, spread: Spread) {
  await ctx.api.sendInvoice(
    ctx.chat!.id,
    `🔮 ${spread.name}`,
    "Расклад карт Таро с персональной трактовкой от карт",
    `pay:${spread.id}`,
    "XTR",
    [{ label: spread.name, amount: spread.price }],
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

    if (!state.lastInterpretation) {
      await ctx.reply("🌑 <i>Нечего озвучивать — расклад не найден.</i>", { parse_mode: "HTML" });
      return;
    }

    try {
      const audioBuf = await withChatAction(ctx, "record_voice", () =>
        generateVoice(state.lastInterpretation!)
      );

      const voiceKb = new InlineKeyboard()
        .text("🔮 Новый расклад", "new_reading")
        .row()
        .text("🃏 Сменить расклад", "change_spread")
        .row()
        .text("✏️ Изменить вопрос", "change_question");

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
          await ctx.reply(
            "🔇 <b>Не удалось отправить голосовое</b> — у тебя запрещён приём голосовых сообщений.\n\n" +
            "⭐ <b>Звёзды возвращены.</b>\n\n" +
            "Чтобы получить озвучку:\n" +
            "<i>Настройки Telegram → Конфиденциальность → Голосовые сообщения → Разрешить для всех</i>",
            { parse_mode: "HTML" }
          );
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
          await ctx.reply(
            "🔇 Не удалось отправить голосовое — у тебя запрещён приём голосовых. Напиши @support для возврата звёзд.",
          );
        }
      } else {
        // Other TTS/send error — also refund
        try {
          await ctx.api.raw.refundStarPayment({
            user_id: ctx.from!.id,
            telegram_payment_charge_id: payment.telegram_payment_charge_id,
          });
          await ctx.reply(
            "🌑 <i>Не удалось озвучить расклад...</i> ⭐ Звёзды возвращены. Попробуй чуть позже.",
            { parse_mode: "HTML" }
          );
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
          await ctx.reply(
            "🌑 Не удалось озвучить расклад... Попробуй чуть позже.",
          );
        }
      }
    }
    return;
  }

  // ── Оплата карты дня ──
  if (payload === "pay:daily") {
    savePayment(ctx.from!.id, payment.total_amount, payload, payment.telegram_payment_charge_id);

    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (!today || today.revealed) {
      state.phase = "idle";
      await ctx.reply("✨ <i>Карта дня уже раскрыта или не найдена.</i>", { parse_mode: "HTML" });
      return;
    }

    revealDailyCard(today.id);
    const card = getCardById(today.card_id);
    if (!card) {
      state.phase = "idle";
      await ctx.reply("🌑 <i>Что-то пошло не так...</i>", { parse_mode: "HTML" });
      return;
    }

    const reversed = today.reversed === 1;
    const orient = reversed ? "перевёрнутая" : "прямая";
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
          caption:
            `🌅 <b>Твоя карта дня: ${card.name_ru}</b> (${orient})\n\n` +
            `✨ <i>${meaning}</i>\n\n` +
            `🔑 ${keywords.join(", ")}`,
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

    await ctx.reply(
      "🕯 <b>Задай вопрос этой карте</b> — <i>и она раскроет для тебя свой шёпот.</i>",
      { parse_mode: "HTML" }
    );
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
  await ctx.reply("⭐ <b>Оплата получена.</b> <i>Карты благодарят за доверие...</i>", { parse_mode: "HTML" });
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
  await ctx.reply(
    "✏️ Напиши вопрос заново — <i>карты терпеливо ждут.</i>",
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("decline_question", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.pendingText = undefined;
  state.phase = "idle";
  await ctx.reply("✨ Хорошо. <i>Когда захочешь обратиться к картам — я здесь.</i>", {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("🔮 Начать расклад", "begin_reading"),
  });
});

// ── Отмена оплаты ─────────────────────────────────────────────────────────
bot.callbackQuery("cancel_payment", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.phase = "idle";
  state.spreadId = undefined;
  state.paid = false;

  const kb = new InlineKeyboard().text("🔮 Начать расклад", "begin_reading");
  await ctx.reply(
    "✨ Расклад отменён. <i>Когда будешь готов(а) — карты ждут.</i>",
    { parse_mode: "HTML", reply_markup: kb }
  );
});

// ── Callback: кнопки после расклада ─────────────────────────────────────────
bot.callbackQuery("new_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);
  state.question = undefined;
  state.spreadId = undefined;
  state.phase = "awaiting_question";
  await ctx.reply(
    "🕯 <b>Новый расклад...</b> Сосредоточься и задай свой вопрос.",
    { parse_mode: "HTML" }
  );
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
  await ctx.reply(
    "🕯 Расклад сохранён. <i>Сформулируй новый вопрос — карты готовы слушать.</i>",
    { parse_mode: "HTML" }
  );
});

// ── Текстовое сообщение ────────────────────────────────────────────────────
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;

  const state = getState(ctx.chat.id);

  // Проверка безопасности всегда
  const safety = checkSafety(text);
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
    await ctx.reply("⭐ Сначала оплати или отмени расклад выше.", { parse_mode: "HTML" });
    return;
  }

  // Иначе — спрашиваем, хочет ли пользователь сделать расклад на этот текст
  state.pendingText = text;
  state.phase = "confirming";

  const confirmKb = new InlineKeyboard()
    .text("🔮 Да, сделать расклад", "confirm_question")
    .row()
    .text("✏️ Уточнить вопрос", "edit_question")
    .row()
    .text("Нет, просто так", "decline_question");

  await ctx.reply(
    "✨ <b>Хочешь обратиться к картам с этим вопросом?</b>",
    { parse_mode: "HTML", reply_markup: confirmKb }
  );
});

// ── Основная логика расклада ────────────────────────────────────────────────
async function doReading(ctx: Context, state: UserState) {
  const spread = getSpreadById(state.spreadId!);
  if (!spread) {
    await ctx.reply("🌑 <i>Расклад затерялся в тумане...</i> Попробуй выбрать снова.", { parse_mode: "HTML" });
    return;
  }

  // Free whisper readings for new users
  const isFreeWhisper = spread.id === "whisper" && !state.paid && getFreeReadings(ctx.from!.id) > 0;

  if (spread.price > 0 && !state.paid && !isFreeWhisper) {
    state.phase = "awaiting_payment";
    await sendStarInvoice(ctx, spread);

    const freeLeft = spread.id === "whisper" ? getFreeReadings(ctx.from!.id) : -1;
    const freeHint = freeLeft === 0 ? "\n<i>(Бесплатные расклады закончились)</i>" : "";

    const cancelKb = new InlineKeyboard()
      .text("❌ Отменить", "cancel_payment");
    await ctx.reply(
      `⭐ Для этого расклада нужна оплата (<b>${spread.price} Stars</b>). Оплати выше или отмени расклад.${freeHint}`,
      { parse_mode: "HTML", reply_markup: cancelKb }
    );
    return;
  }

  if (isFreeWhisper) {
    decrementFreeReading(ctx.from!.id);
    const left = getFreeReadings(ctx.from!.id);
    if (left > 0) {
      await ctx.reply(
        `✨ <i>Бесплатный расклад! Осталось ещё: ${left}</i>`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        "✨ <i>Это твой последний бесплатный расклад «Шёпот карты».</i>",
        { parse_mode: "HTML" }
      );
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

  const readingCtx = buildReadingContext(question, spread, drawn);
  const cardsMsg = formatCardsMessage(readingCtx);

  const cardsJson = JSON.stringify(
    drawn.map((d) => ({ id: d.card.id, name: d.card.name_ru, reversed: d.reversed }))
  );
  const readingId = saveReading(ctx.from!.id, spread.id, question, cardsJson, null);
  state.lastReadingId = readingId;

  await ctx.reply(
    `🃏 <b>${spread.name}</b>\n\n${cardsMsg}\n\n` +
      "<i>Карты раскрываются, ожидай минутку... Позволь им рассказать свою историю</i> 🌙",
    { parse_mode: "HTML" }
  );

  try {
    await sendCardsMediaGroup(ctx.api, ctx.chat!.id, drawn);
  } catch (imgErr) {
    console.error("Image send error:", imgErr);
  }

  try {
    const safety = checkSafety(question);
    const sensitive = safety.safe ? safety.sensitive : false;
    const interpretation = await withChatAction(ctx, "typing", () =>
      getInterpretation(readingCtx, sensitive)
    );

    state.lastInterpretation = interpretation;
    if (state.lastReadingId) {
      updateReadingInterpretation(state.lastReadingId, interpretation);
    }

    const afterKb = new InlineKeyboard()
      .text("🎙 Озвучить расклад — ⭐ 1", "voice_reading")
      .row()
      .text("🔮 Новый расклад", "new_reading")
      .row()
      .text("🃏 Сменить расклад", "change_spread")
      .row()
      .text("✏️ Изменить вопрос", "change_question");

    await ctx.reply(interpretation + DISCLAIMER, {
      reply_markup: afterKb,
    });

    state.phase = "idle";
  } catch (err) {
    console.error("LLM error:", err);
    await ctx.reply(
      "🌑 <i>Карты молчат...</i> Что-то пошло не так. Попробуй чуть позже.",
      { parse_mode: "HTML" }
    );
    state.phase = "idle";
  }
}

// ── Озвучка расклада ─────────────────────────────────────────────────────────
bot.callbackQuery("voice_reading", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);

  if (!state.lastInterpretation) {
    await ctx.reply("🌑 <i>Нечего озвучивать — сначала сделай расклад.</i>", { parse_mode: "HTML" });
    return;
  }

  state.phase = "awaiting_payment";

  await ctx.api.sendInvoice(
    ctx.chat!.id,
    "🎙 Озвучить расклад",
    "Голосовое сообщение с трактовкой карт",
    "pay:voice",
    "XTR",
    [{ label: "Озвучка расклада", amount: 1 }],
    { provider_token: "" }
  );

  const cancelKb = new InlineKeyboard().text("❌ Отменить", "cancel_payment");
  await ctx.reply(
    "⭐ Оплати <b>1 Star</b> выше — и я озвучу расклад приятным голосом.\n\n" +
    "💡 <i>Убедись, что в настройках Telegram разрешены голосовые сообщения от всех, иначе озвучка не дойдёт.</i>",
    { parse_mode: "HTML", reply_markup: cancelKb }
  );
});

// ── Карта дня ───────────────────────────────────────────────────────────────
bot.command("daily", async (ctx) => {
  upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name, ctx.from?.language_code);

  if (isDailySubscribed(ctx.from!.id)) {
    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (today && !today.revealed) {
      const kb = new InlineKeyboard()
        .text("🔮 Раскрыть карту дня — ⭐ 1", "reveal_daily")
        .row()
        .text("🔕 Отписаться от карты дня", "unsub_daily");
      await ctx.reply(
        "🌅 <i>Твоя карта дня уже ждёт!</i> Нажми кнопку, чтобы раскрыть.",
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }
    if (today && today.revealed) {
      await ctx.reply(
        "✨ <i>Ты уже раскрыл(а) карту дня сегодня.</i> Приходи завтра за новой!",
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔮 Начать расклад", "begin_reading") }
      );
      return;
    }
    // Subscribed but no card for today yet — send it now
    await sendDailyToUser(bot, ctx.from!.id);
    return;
  }

  subscribeDailyCard(ctx.from!.id);
  await ctx.reply(
    "🌅 <b>Ты подписан(а) на карту дня!</b>\n\n" +
      "Каждое утро тебя будет ждать таинственная карта. " +
      "<i>Раскрой её — и узнай послание дня.</i> ✨",
    { parse_mode: "HTML" }
  );
  await sendDailyToUser(bot, ctx.from!.id);
});

bot.callbackQuery("toggle_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name, ctx.from?.language_code);

  if (isDailySubscribed(ctx.from!.id)) {
    const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
    if (today && !today.revealed) {
      const kb = new InlineKeyboard()
        .text("🔮 Раскрыть карту дня — ⭐ 1", "reveal_daily")
        .row()
        .text("🔕 Отписаться от карты дня", "unsub_daily");
      await ctx.reply(
        "🌅 <i>Твоя карта дня уже ждёт!</i>",
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }
    if (today && today.revealed) {
      await ctx.reply(
        "✨ <i>Ты уже раскрыл(а) карту дня.</i> Завтра будет новая!",
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔮 Начать расклад", "begin_reading") }
      );
      return;
    }
    await sendDailyToUser(bot, ctx.from!.id);
    return;
  }

  subscribeDailyCard(ctx.from!.id);
  await ctx.reply(
    "🌅 <b>Ты подписан(а) на карту дня!</b>\n" +
      "<i>Каждое утро тебя будет ждать таинственная карта.</i> ✨",
    { parse_mode: "HTML" }
  );
  await sendDailyToUser(bot, ctx.from!.id);
});

bot.callbackQuery("reveal_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = getState(ctx.chat!.id);

  const today = getTodayDailyCard(ctx.from!.id, todayDateStr());
  if (!today) {
    await ctx.reply("🌑 <i>Карта дня ещё не выбрана.</i> Напиши /daily", { parse_mode: "HTML" });
    return;
  }
  if (today.revealed) {
    const card = getCardById(today.card_id);
    if (card) {
      await ctx.reply(
        `✨ Ты уже раскрыл(а) карту дня: <b>${card.name_ru}</b>`,
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔮 Начать расклад", "begin_reading") }
      );
    }
    return;
  }

  // Send invoice for reveal
  state.phase = "awaiting_payment";
  await ctx.api.sendInvoice(
    ctx.chat!.id,
    "🔮 Раскрыть карту дня",
    "Узнай, какую карту выбрала для тебя Вселенная сегодня",
    "pay:daily",
    "XTR",
    [{ label: "Карта дня", amount: 1 }],
    { provider_token: "" }
  );

  const cancelKb = new InlineKeyboard().text("❌ Отменить", "cancel_payment");
  await ctx.reply(
    "⭐ Оплати <b>1 Star</b> — и карта раскроется.",
    { parse_mode: "HTML", reply_markup: cancelKb }
  );
});

bot.callbackQuery("unsub_daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  unsubscribeDailyCard(ctx.from!.id);
  await ctx.reply(
    "🔕 <i>Ты отписан(а) от карты дня.</i> Чтобы подписаться снова — напиши /daily",
    { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔮 Начать расклад", "begin_reading") }
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
