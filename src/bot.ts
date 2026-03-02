import "dotenv/config";
import { Bot, InlineKeyboard, Context, InputFile } from "grammy";
import { Spread, getAllSpreads, getSpreadById } from "./tarot/spreads";
import { drawCards } from "./tarot/deck";
import { buildReadingContext, formatCardsMessage } from "./tarot/reading";
import { checkSafety } from "./safety";
import { getInterpretation } from "./llm";
import { generateVoice } from "./tts";
import { sendCardsMediaGroup } from "./tarot/images";

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

  const startKb = new InlineKeyboard().text("🔮 Начать расклад", "begin_reading");

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
function spreadKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of getAllSpreads()) {
    const label = s.price > 0
      ? `✦ ${s.name} (${s.count}) — ⭐ ${s.price}`
      : `✦ ${s.name} (${s.count})`;
    kb.text(label, `spread:${s.id}`).row();
  }
  kb.text("❓ Чем отличаются расклады?", "spreads_info").row();
  return kb;
}

async function askSpread(ctx: Context) {
  await ctx.reply(
    "🃏 <b>Какой расклад тебя зовёт?</b>",
    { parse_mode: "HTML", reply_markup: spreadKeyboard() }
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
      const desc = err?.description ?? "";
      if (desc.includes("VOICE_MESSAGES_FORBIDDEN")) {
        await ctx.reply(
          "🔇 Не могу отправить голосовое — у тебя запрещён приём голосовых сообщений в настройках Telegram. Разреши их и попробуй снова.",
        );
      } else {
        await ctx.reply(
          "🌑 Не удалось озвучить расклад... Попробуй чуть позже.",
        );
      }
    }
    return;
  }

  // ── Оплата расклада ──
  const spreadId = payload.replace("pay:", "");
  state.spreadId = spreadId;

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

  if (spread.price > 0 && !state.paid) {
    state.phase = "awaiting_payment";
    await sendStarInvoice(ctx, spread);

    const cancelKb = new InlineKeyboard()
      .text("❌ Отменить", "cancel_payment");
    await ctx.reply(
      `⭐ Для этого расклада нужна оплата (<b>${spread.price} Stars</b>). Оплати выше или отмени расклад.`,
      { parse_mode: "HTML", reply_markup: cancelKb }
    );
    return;
  }

  state.paid = false;

  const question = state.question!;
  const drawn = drawCards(spread.count);
  const readingCtx = buildReadingContext(question, spread, drawn);
  const cardsMsg = formatCardsMessage(readingCtx);

  await ctx.reply(
    `🃏 <b>${spread.name}</b>\n\n${cardsMsg}\n\n` +
      "<i>Карты раскрываются, ожидай... Позволь им рассказать свою историю</i> 🌙",
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
    "⭐ Оплати <b>1 Star</b> выше — и я озвучу расклад приятным голосом.",
    { parse_mode: "HTML", reply_markup: cancelKb }
  );
});

// ── Обработка ошибок ────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error("Bot error:", err.message ?? err);
});

// ── Запуск ──────────────────────────────────────────────────────────────────
bot.start({
  onStart: () => console.log("Tarot bot started!"),
});
