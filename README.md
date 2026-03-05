# Tarot Text Bot

Telegram-бот для раскладов Таро с изображениями карт Rider–Waite–Smith.
Использует LLM через OpenRouter для генерации трактовок.

## Возможности

### 🃏 Расклады
- **Шёпот карты** (1 карта) — ⭐ 1 Star (первые 3 бесплатно)
- **Треугольник судьбы** (3 карты) — ⭐ 2 Stars
- **Зеркало глубин** (5 карт) — ⭐ 3 Stars
- **78 карт** с поддержкой прямой/перевёрнутой позиции
- **Изображения RWS** — карты отправляются как фото (медиа-группой)
- **LLM-трактовка** через OpenRouter
- **Озвучка расклада** — TTS за ⭐ 1 Star

### 🌅 Карта дня
- Ежедневная рассылка по крону (09:30 по Киеву) подписчикам
- Рубашка карты → оплата ⭐ 1 Star → раскрытие + короткое значение
- После раскрытия можно задать вопрос — автоматический расклад «Шёпот карты» по этой карте (оплачен)

### 🎁 Бесплатные расклады
- Новые пользователи получают 3 бесплатных «Шёпот карты»
- Количество бесплатных раскладов управляется через админ-панель

### 🛡 Админ-панель
- Веб-интерфейс на Express (`http://server:3737/ADMIN_PATH`)
- Доступна извне — слушает `0.0.0.0`, доступ по IP/домену сервера
- Скрытый URL — `ADMIN_PATH` в `.env` (по умолчанию `/admin`, рекомендуется сменить на рандомный)
- Авторизация через `ADMIN_KEY` из `.env` (cookie-сессия на 24ч, `HttpOnly`, `SameSite=Lax`)
- **Защита от перебора** — 5 неверных попыток → блокировка IP на 15 минут
- **Timing-safe** сравнение пароля (`crypto.timingSafeEqual`)
- **Security headers** — `X-Frame-Options: DENY`, `CSP`, `X-Content-Type-Options`, `Referrer-Policy`
- 404 на все неизвестные пути (не раскрывает `ADMIN_PATH`)
- Предупреждение при запуске, если `ADMIN_KEY` не задан
- **Дашборд** — статистика: пользователи, подписки, расклады, платежи Stars
- **Управление пользователями** — поиск, добавление, редактирование бесплатных раскладов, подписка на карту дня
- Конфиденциальные данные (вопросы, тексты раскладов) не отображаются в UI

### 💳 Оплата
- Telegram Stars
- **Авто-возврат звёзд** — при ошибке озвучки (TTS) или запрете голосовых сообщений Stars мгновенно возвращаются
- Предупреждение перед оплатой TTS: убедиться, что голосовые разрешены в настройках Telegram
- Фильтры безопасности: кризисные ситуации, чувствительные темы

### 💾 База данных
- SQLite (better-sqlite3) с системой миграций
- Таблицы: `users`, `readings`, `payments`, `card_cache`, `daily_subscriptions`, `daily_cards`
- Авто-кэш `file_id` — первая отправка загружает файл, далее мгновенно по `file_id`

## Быстрый старт

1. Скопируйте `.env.example` в `.env` и заполните:

```
cp .env.example .env
```

2. Заполните переменные:

```
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather
OPENROUTER_API_KEY=ваш_ключ_openrouter
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENAI_TTS_API_KEY=ваш_ключ_openai_tts   # опционально, без него озвучка недоступна
PRELOAD_CHAT_ID=ваш_chat_id              # опционально, для preload file_id
ADMIN_KEY=ваш_секретный_ключ             # ключ доступа к админ-панели (обязательно сменить!)
ADMIN_PORT=3737                          # порт админ-панели (по умолчанию 3737)
ADMIN_PATH=/my-secret-panel              # скрытый URL-путь админки (по умолчанию /admin)
```

3. Установите зависимости и скачайте изображения:

```bash
npm install
npm run download:rws
```

4. Запустите бота:

```bash
npm run dev
```

5. *(Опционально)* Предзагрузите `file_id` для всех 78 карт, чтобы бот отправлял изображения мгновенно:

```bash
npm run preload:tg
```

### Доступ к админ-панели

**Локально:** откройте `http://localhost:3737/ADMIN_PATH` и введите `ADMIN_KEY`.

**На сервере:** откройте `http://ваш_ip:3737/ADMIN_PATH` — панель доступна напрямую, защищена паролем + скрытым путём + rate-limiting.

**Дополнительная защита (опционально):**

*SSH-туннель:*
```bash
ssh -L 3737:localhost:3737 user@your-server
# затем откройте http://localhost:3737/ADMIN_PATH на своём компе
```

*Cloudflare Tunnel (HTTPS):*
```bash
cloudflared tunnel --url http://localhost:3737
```

## Изображения

Используются оригинальные изображения колоды **Rider–Waite–Smith** (Памела Колман Смит, 1909) из [Wikimedia Commons](https://commons.wikimedia.org/). Изображения находятся в **public domain** (срок авторских прав истёк).

Маппинг карт к файлам Wikimedia — `data/rws_manifest.json`. Скрипт `download:rws` скачивает файлы в `data/images/rws/`.

## Структура

```
src/
  bot.ts              — входная точка, Telegram-бот (grammY)
  admin.ts            — веб-админка (Express, cookie-auth)
  daily.ts            — крон карты дня + рассылка подписчикам
  db.ts               — SQLite база, миграции, CRUD-хелперы
  llm.ts              — модуль работы с OpenRouter
  safety.ts           — фильтры безопасности
  tarot/
    cards.ts          — чтение карт из cards.json
    deck.ts           — перемешивание, вытягивание карт
    spreads.ts        — чтение spreads.json
    reading.ts        — сборка контекста для LLM
    images.ts         — отправка изображений + кэш file_id
scripts/
  download_rws.ts     — скачивание изображений RWS с Wikimedia
  preload_tg_file_ids.ts — предзагрузка file_id в Telegram
data/
  bot.db              — SQLite база данных (в .gitignore)
  cards.json          — 78 карт Таро (русский)
  spreads.json        — 3 расклада с ценами
  rws_manifest.json   — маппинг card_id → filename на Wikimedia
  images/rws/         — скачанные изображения (в .gitignore)
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск в режиме разработки (tsx) |
| `npm run build` | Компиляция TypeScript |
| `npm start` | Запуск скомпилированного бота |
| `npm run download:rws` | Скачать изображения RWS с Wikimedia Commons |
| `npm run preload:tg` | Предзагрузить file_id для всех карт в Telegram |
