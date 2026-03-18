const locale: Record<string, string> = {
  // ── Common ──────────────────────────────────────────────────────────────────
  "common.upright": "upright",
  "common.reversed": "reversed",
  "common.disclaimer": "\n\n· · ·\n🔮 A reading is a tool for self-reflection and entertainment. It is not medical, legal, or financial advice.",
  "common.error": "🌑 <i>Something went wrong...</i>",
  "common.cards_suffix": "cards",

  // ── Buttons ─────────────────────────────────────────────────────────────────
  "btn.begin_reading": "🔮 Start a reading",
  "btn.new_reading": "🔮 New reading",
  "btn.change_spread": "🃏 Change spread",
  "btn.change_question": "✏️ Change question",
  "btn.voice_reading": "🎙 Voice reading — ⭐ 1",
  "btn.spreads_info": "❓ What's the difference between spreads?",
  "btn.back_to_spreads": "🃏 Back to spread selection",
  "btn.confirm_yes": "🔮 Yes, do a reading",
  "btn.confirm_edit": "✏️ Rephrase question",
  "btn.confirm_no": "No, just chatting",
  "btn.cancel": "❌ Cancel",
  "btn.reveal_daily": "🔮 Reveal daily card — ⭐ 1",
  "btn.unsub_daily": "🔕 Unsubscribe from daily card",

  // ── Language selection ──────────────────────────────────────────────────────
  "lang.choose": "🌍 <b>Choose language / Обери мову / Выбери язык</b>",
  "lang.set": "✅ Language set: <b>English</b> 🇬🇧",

  // ── Start ───────────────────────────────────────────────────────────────────
  "start.welcome": "🌙 <b>Welcome to the Tarot space.</b>\n\nI will help you look beyond the veil of the ordinary and see your situation through the eyes of the cards. This is neither a prophecy nor a verdict — <i>think of the reading as a mirror reflecting the hidden facets of your question.</i>\n\nWhen you're ready, press the button below ✨",
  "start.ask_question": "🕯 <b>Focus and ask your question.</b>\n\n<i>The clearer your intention — the more precise the cards' response.</i> Write what troubles, interests, or keeps you awake at night.",

  // ── Spread selection ────────────────────────────────────────────────────────
  "spread.choose": "🃏 <b>Which spread calls to you?</b>",
  "spread.label_free": "✦ {name} ({count}) — free [{left}]",
  "spread.label_paid": "✦ {name} ({count}) — ⭐ {price}",
  "spread.label_basic": "✦ {name} ({count})",
  "spread.info_title": "🌙 <b>About the spreads</b>",
  "spread.info_line": "<b>✦ {name}</b>  •  {count} cards  •  {priceTag}\n<i>{description}</i>",
  "spread.price_free": "free",
  "spread.not_found": "🌑 <i>The spread has been lost in the mist...</i> Try choosing again.",
  "reading.spread_not_found": "🌑 <i>The spread has been lost in the mist...</i> Try choosing again.",
  "spread.ask_question_first": "🕯 <b>Ask your question first</b> — the cards await your intention.",

  // ── Question flow ───────────────────────────────────────────────────────────
  "question.confirm": "✨ <b>Would you like the cards to answer this question?</b>",
  "question.rewrite": "✏️ Write your question again — <i>the cards wait patiently.</i>",
  "question.declined": "✨ Alright. <i>When you wish to consult the cards — I'm here.</i>",
  "question.new": "🕯 <b>New reading...</b> Focus and ask your question.",
  "question.change": "🕯 Spread saved. <i>Formulate a new question — the cards are ready to listen.</i>",

  // ── Payment ─────────────────────────────────────────────────────────────────
  "payment.invoice_title": "🔮 {name}",
  "payment.invoice_desc": "Tarot card reading with a personal interpretation",
  "payment.received": "⭐ <b>Payment received.</b> <i>The cards are grateful for your trust...</i>",
  "payment.needed": "⭐ This spread requires payment (<b>{price} Stars</b>). Pay above or cancel the reading.",
  "payment.required": "⭐ This spread requires payment (<b>{price} Stars</b>). Pay above or cancel the reading.",
  "payment.pay_first": "⭐ Please pay or cancel the reading above first.",
  "payment.cancelled": "✨ Reading cancelled. <i>When you're ready — the cards await.</i>",

  // ── Reading ─────────────────────────────────────────────────────────────────
  "reading.free_remaining": "✨ <i>Free reading! Remaining: {left}</i>",
  "reading.free_left": "✨ <i>Free reading! Remaining: {left}</i>",
  "reading.free_ended": "<i>(Free readings have run out)</i>",
  "reading.free_last": "✨ <i>This is your last free \"Card Whisper\" reading.</i>",
  "reading.header": "🃏 <b>{name}</b>\n\n{cards}\n\n<i>The cards are revealing themselves, hold on a moment... Let them tell their story</i> 🌙",
  "reading.cards_drawn": "🃏 <b>{spread}</b>\n\n{cards}\n\n<i>The cards are revealing themselves, hold on a moment... Let them tell their story</i> 🌙",
  "reading.error": "🌑 <i>The cards are silent...</i> Something went wrong. Try again later.",
  "reading.llm_error": "🌑 <i>The cards are silent...</i> Something went wrong. Try again later.",
  "reading.card_caption": "🃏 {name} ({orient})",

  // ── Voice ───────────────────────────────────────────────────────────────────
  "voice.nothing": "🌑 <i>Nothing to voice — do a reading first.</i>",
  "voice.no_reading": "🌑 <i>Nothing to voice — do a reading first.</i>",
  "voice.not_found": "🌑 <i>Nothing to voice — no reading found.</i>",
  "voice.invoice_title": "🎙 Voice reading",
  "voice.invoice_desc": "Voice message with the card interpretation",
  "voice.prompt": "⭐ Pay <b>1 Star</b> above — and I'll voice the reading in a pleasant tone.\n\n💡 <i>Make sure voice messages from everyone are allowed in your Telegram settings, otherwise the recording won't reach you.</i>",
  "voice.pay_prompt": "⭐ Pay <b>1 Star</b> above — and I'll voice the reading in a pleasant tone.\n\n💡 <i>Make sure voice messages from everyone are allowed in your Telegram settings, otherwise the recording won't reach you.</i>",
  "voice.invoice_label": "Voice reading",
  "voice.forbidden_refund": "🔇 <b>Could not send voice message</b> — you have voice messages disabled.\n\n⭐ <b>Stars refunded.</b>\n\nTo receive a voice reading:\n<i>Telegram Settings → Privacy → Voice Messages → Allow from Everyone</i>",
  "voice.forbidden_no_refund": "🔇 Could not send voice message — you have voice messages disabled. Contact @support for a refund.",
  "voice.error_refund": "🌑 <i>Could not voice the reading...</i> ⭐ Stars refunded. Try again later.",
  "voice.error_no_refund": "🌑 Could not voice the reading... Try again later.",

  // ── Daily card ──────────────────────────────────────────────────────────────
  "daily.morning": "🌅 <b>Good morning!</b>\n\nThe cards have already chosen a message for you today...\nA mysterious card awaits — <i>ready to discover what it conceals?</i> ✨",
  "daily.waiting": "🌅 <i>Your daily card is already waiting!</i> Press the button to reveal it.",
  "daily.waiting_short": "🌅 <i>Your daily card is already waiting!</i>",
  "daily.revealed_today": "✨ <i>You've already revealed today's card.</i> Come back tomorrow for a new one!",
  "daily.already_today": "✨ <i>You've already revealed today's card.</i> Come back tomorrow for a new one!",
  "daily.revealed_short": "✨ <i>You've already revealed today's card.</i> A new one tomorrow!",
  "daily.already_revealed": "✨ <i>You've already revealed today's card.</i> A new one tomorrow!",
  "daily.revealed_already": "✨ <i>Daily card already revealed or not found.</i>",
  "daily.subscribed": "🌅 <b>You're subscribed to the daily card!</b>\n\nEvery morning a mysterious card will await you. <i>Reveal it — and discover the message of the day.</i> ✨",
  "daily.subscribed_short": "🌅 <b>You're subscribed to the daily card!</b>\n<i>Every morning a mysterious card will await you.</i> ✨",
  "daily.not_chosen": "🌑 <i>Daily card hasn't been chosen yet.</i> Type /daily",
  "daily.already_revealed_name": "✨ You've already revealed today's card: <b>{name}</b>",
  "daily.already_revealed_card": "✨ You've already revealed today's card: <b>{name}</b>",
  "daily.reveal_invoice_title": "🔮 Reveal daily card",
  "daily.reveal_title": "🔮 Reveal daily card",
  "daily.reveal_invoice_desc": "Discover which card the Universe chose for you today",
  "daily.reveal_desc": "Discover which card the Universe chose for you today",
  "daily.reveal_label": "Daily card",
  "daily.reveal_prompt": "⭐ Pay <b>1 Star</b> — and the card will be revealed.",
  "daily.reveal_pay": "⭐ Pay <b>1 Star</b> — and the card will be revealed.",
  "daily.unsubscribed": "🔕 <i>You've unsubscribed from the daily card.</i> To subscribe again — type /daily",
  "daily.card_caption": "🌅 <b>Your daily card: {name}</b> ({orient})\n\n✨ <i>{meaning}</i>\n\n🔑 {keywords}",
  "daily.ask_card_question": "🕯 <b>Ask this card a question</b> — <i>and it will reveal its whisper to you.</i>",

  // ── Profile ────────────────────────────────────────────────────────────────
  "profile.title": "🔮 <b>Your profile, {name}</b>",
  "profile.stats": "📊 Readings: <b>{readings}</b>\n⭐ Stars spent: <b>{stars}</b>\n🃏 Free readings left: <b>{free}</b>\n📅 With us since: <b>{since}</b>",
  "profile.daily_on": "subscribed ✅",
  "profile.daily_off": "not subscribed",
  "profile.lang_ru": "Русский 🇷🇺",
  "profile.lang_uk": "Українська 🇺🇦",
  "profile.lang_en": "English 🇬🇧",
  "btn.profile": "👤 Profile",
  "btn.history": "📜 History",
  "btn.daily_card": "🌅 Daily card",
  "btn.change_lang": "🌍 Language",
  "history.title": "📜 <b>Recent readings</b>",
  "history.empty": "📜 <i>You have no readings yet.</i> Start your first one! 🔮",
  "history.item": "<b>{n}.</b> {spread} — <i>{question}</i>\n🕐 {date}",
  "history.back": "👤 Back to profile",

  // ── Safety ──────────────────────────────────────────────────────────────────
  "safety.crisis": "<b>I sense that you may be going through a very difficult time right now.</b>\nThe cards cannot help here — but real people can. Please reach out to someone you trust or a helpline.\n\n🇬🇧 <b>UK</b>\n  Samaritans: <code>116 123</code> (free, 24/7)\n  Crisis Text Line: text <code>SHOUT</code> to <code>85258</code>\n\n🇺🇸 <b>USA</b>\n  National Suicide Prevention: <code>988</code> (call or text, 24/7)\n  Crisis Text Line: text <code>HOME</code> to <code>741741</code>\n\n🇺🇦 <b>Україна</b>\n  Лайфлайн Україна: <code>7333</code>\n  Гаряча лінія: <code>0-800-500-335</code>\n\n🇷🇺 <b>Россия</b>\n  Телефон доверия: <code>8-800-2000-122</code>\n\n<i>You are not alone. Help is available right now</i> 💙",

  // ── LLM prompt ──────────────────────────────────────────────────────────────
  "llm.position_label": "Position",
  "llm.card_label": "Card",
  "llm.keywords_label": "Keywords",
  "llm.meaning_label": "Brief meaning",
  "llm.sensitive_note": "\nIMPORTANT: the question touches on medical/legal/financial topics. Provide a neutral interpretation without categorical instructions, gently recommend consulting a relevant professional.",
  "llm.prompt": "You are an experienced tarot reader with years of practice. Speak on behalf of the cards, using vivid, mystical, yet warm language. Address the querent as \"you\". Use phrases like \"the cards whisper...\", \"the energy of the spread points to...\", \"in this position reveals itself...\". Don't be a dry reference — be a guide.\n\nThe querent's question: \"{question}\"\nSpread: {spread_name}\n\nDrawn cards:\n{cards_block}\n{sensitive_note}\n\nResponse structure:\n1. Interpretation for each position (1–3 paragraphs depending on the number of cards). Describe vividly what the card \"says\" in this position, how it relates to the question.\n2. Overall conclusion — unite the cards' messages into a cohesive picture.\n3. 2–4 gentle practical steps for self-reflection. Frame them as invitations, not instructions (\"try paying attention to...\", \"allow yourself to...\").\n\nRules:\n- Length: 900–1400 characters.\n- No markup: no HTML, no markdown (**, ##, - etc.). Only plain text with line breaks.\n- You may use 1–2 emojis at the very beginning of the response.\n- Write in English.\n- Tone: mystical, warm, without being categorical. This is a mirror for self-reflection, not a fate sentence.",
};

export default locale;
