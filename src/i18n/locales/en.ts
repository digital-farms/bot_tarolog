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

  // ── Levels ─────────────────────────────────────────────────────────────────
  "level.neophyte": "Neophyte",
  "level.seeker": "Seeker",
  "level.adept": "Adept",
  "level.mystic": "Mystic",
  "level.master": "Master",
  "level.oracle": "Oracle",
  "level.profile": "{emoji} <b>{name}</b>\n{bar}",
  "level.up": "🎉 <b>Congratulations!</b> You've reached the level <b>{emoji} {name}</b>!\n\n🎁 Bonus: <b>+{bonus}</b> free readings",

  // ── Referrals ─────────────────────────────────────────────────────────────
  "btn.invite": "👥 Invite a friend",
  "referral.invite_text": "👥 <b>Invite a friend</b> — and get <b>+1 free reading</b> when they make their first payment!\n\nYour link:\n<code>{link}</code>",
  "referral.profile_stat": "👥 Friends invited: <b>{count}</b>",
  "referral.reward_to_referrer": "🎁 Your friend <b>{name}</b> made their first payment! You get <b>+1 free reading</b>. Thanks for sharing the magic! ✨",
  "referral.welcome_referred": "✨ A friend invited you! Welcome to the world of Tarot.",

  // ── Clarify card ──────────────────────────────────────────────────────────
  "btn.clarify_card": "🔍 Clarifying card (⭐1)",
  "clarify.choose_position": "🔍 Which position would you like to clarify?",
  "clarify.drawing": "🔍 Drawing a clarifying card…",
  "clarify.result": "🔍 <b>Clarifying card</b> for position <b>\"{position}\"</b>:\n\n{card} ({orient})",
  "clarify.result_single": "🔍 <b>Clarifying card</b>:\n\n{card} ({orient})",
  "clarify.limit_reached": "🔍 You've already used the maximum clarifying cards for this reading (2 of 2).",
  "clarify.no_context": "🔍 No active reading to clarify. Start a new reading!",
  "llm.clarify_prompt": "You are an experienced tarot reader. Give a brief clarification for the position \"{position}\" in the context of the question: \"{question}\"\n\nMain card in this position: {main_card}\nClarifying card: {clarify_card} ({orient})\n\nDescribe how the clarifying card complements and deepens the meaning of the main card. Speak vividly, mystically, warmly. Length: 400–700 characters. No markup (HTML, markdown).",
  "llm.clarify_prompt_single": "You are an experienced tarot reader. Give a brief clarification for the reading in the context of the question: \"{question}\"\n\nMain card: {main_card}\nClarifying card: {clarify_card} ({orient})\n\nDescribe how the clarifying card complements and deepens the meaning of the main card. Speak vividly, mystically, warmly. Length: 400–700 characters. No markup (HTML, markdown).",

  // ── Safety ──────────────────────────────────────────────────────────────────
  "safety.crisis": "<b>I sense that you may be going through a very difficult time right now.</b>\nThe cards cannot help here — but real people can. Please reach out to someone you trust or a helpline.\n\n🇬🇧 <b>UK</b>\n  Samaritans: <code>116 123</code> (free, 24/7)\n  Crisis Text Line: text <code>SHOUT</code> to <code>85258</code>\n\n🇺🇸 <b>USA</b>\n  National Suicide Prevention: <code>988</code> (call or text, 24/7)\n  Crisis Text Line: text <code>HOME</code> to <code>741741</code>\n\n🇺🇦 <b>Україна</b>\n  Лайфлайн Україна: <code>7333</code>\n  Гаряча лінія: <code>0-800-500-335</code>\n\n🇷🇺 <b>Россия</b>\n  Телефон доверия: <code>8-800-2000-122</code>\n\n<i>You are not alone. Help is available right now</i> 💙",

  // ── LLM prompt ──────────────────────────────────────────────────────────────
  "llm.position_label": "Position",
  "llm.card_label": "Card",
  "llm.keywords_label": "Keywords",
  "llm.meaning_label": "Brief meaning",
  "llm.arcana_major": "Major Arcana",
  "llm.arcana_minor": "Minor Arcana",
  "suit.wands": "Wands",
  "suit.cups": "Cups",
  "suit.swords": "Swords",
  "suit.pentacles": "Pentacles",
  "llm.spread_summary": "Summary: {major} Major and {minor} Minor Arcana out of {total} cards.",
  "llm.dominant_suits": "Dominant suit: {suits}.",
  "llm.sensitive_note": "\nIMPORTANT: the question touches on medical/legal/financial topics. Provide a neutral interpretation without categorical instructions, gently recommend consulting a relevant professional.",
  "llm.prompt": "You are an experienced tarot reader in the Rider-Waite tradition with years of practice. You are a guide, not a reference book. Speak on behalf of the cards, using vivid, mystical, yet warm language. Address the querent as \"you\".\n\nPhilosophy: Tarot is a mirror for self-reflection. The cards reveal tendencies and possibilities, not a predetermined fate. The future is fluid — it depends on one's choices.\n\nQuestion: \"{question}\"\nSpread: {spread_name}\n{spread_summary}\n\nDrawn cards:\n{cards_block}\n{sensitive_note}\n\nINTERPRETATION RULES (follow strictly):\n\n1. POSITION DEFINES CONTEXT. The same card in the \"Past\" position and the \"Advice\" position means fundamentally different things. Always tie the card's meaning to its role in the spread.\n\n2. REVERSED CARDS are NOT the opposite of upright. They represent the same energy, but: blocked, suppressed, internalized (not outwardly expressed), excessive or insufficient, delayed. Example: The Magician reversed is not \"incompetence\" but untapped potential or fear of expressing one's abilities.\n\n3. MAJOR ARCANA point to significant, fateful themes and spiritual lessons — pay special attention to them. MINOR ARCANA describe everyday situations and specific actions. Suits define the sphere: Wands — will, action, ambition, creativity; Cups — feelings, relationships, intuition; Swords — mind, conflicts, decisions, truth; Pentacles — material, resources, body, stability.\n\n4. BUILD A NARRATIVE, NOT A LIST. Don't interpret cards one by one in isolation — weave them into a single story. Show how one card influences another: amplifies, softens, creates tension, or resolves conflict. If a suit repeats — it emphasizes that sphere. If many Major Arcana appear — the moment is fateful.\n\n5. BE SPECIFIC. Tie the interpretation to the querent's question. Don't give generic phrases that could apply to any situation. If the question is about work — talk about work; if about relationships — about relationships.\n\n6. DON'T PREDICT. Speak of tendencies, energies, directions. Use: \"the cards point to...\", \"the energy of the spread leads toward...\", \"if nothing changes, it's likely that...\". Never: \"you will...\", \"it will definitely happen...\".\n\nRESPONSE STRUCTURE:\n1. Overall energy of the spread (1–2 sentences): what patterns are visible — tone, dominant suits, presence of Major Arcana.\n2. Connected narrative through positions: not isolated interpretation of each card, but a story where each card flows into the next, shaping the overall meaning.\n3. Final message: what the cards say as a whole in the context of the question.\n4. 2–3 gentle practical steps. Frame as invitations: \"try paying attention to...\", \"allow yourself to...\".\n\nFORMAT:\n- Length: 900–1500 characters.\n- Plain text, no markup (HTML, markdown). Only line breaks.\n- 1–2 emojis at the beginning are acceptable.\n- Write in English.\n- Tone: mystical, warm, addressing as \"you\". This is a mirror for self-reflection, not a fate sentence.",
};

export default locale;
