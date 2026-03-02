# Tarot Text Bot

Telegram-бот для раскладов Таро с изображениями карт Rider–Waite–Smith.
Использует LLM через OpenRouter для генерации трактовок.

## Возможности

- **3 расклада**:
  - **Шёпот карты** (1 карта) — бесплатно
  - **Треугольник судьбы** (3 карты) — ⭐ 1 Star
  - **Зеркало глубин** (5 карт) — ⭐ 3 Stars
- **78 карт** с поддержкой прямой/перевёрнутой позиции
- **Изображения RWS** — карты отправляются как фото (медиа-группой) сразу при раскрытии
- **Авто-кэш `file_id`** — первая отправка загружает файл, далее мгновенно по `file_id`
- **LLM-трактовка** через OpenRouter
- **Озвучка расклада** — TTS за ⭐ 1 Star
- **Оплата Telegram Stars**
- **Фильтры безопасности**: кризисные ситуации, чувствительные темы

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
PRELOAD_CHAT_ID=ваш_chat_id        # опционально, для preload file_id
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

## Изображения

Используются оригинальные изображения колоды **Rider–Waite–Smith** (Памела Колман Смит, 1909) из [Wikimedia Commons](https://commons.wikimedia.org/). Изображения находятся в **public domain** (срок авторских прав истёк).

Маппинг карт к файлам Wikimedia — `data/rws_manifest.json`. Скрипт `download:rws` скачивает файлы в `data/images/rws/`.

## Структура

```
src/
  bot.ts              — входная точка, Telegram-бот (grammY)
  llm.ts              — модуль работы с OpenRouter
  safety.ts           — фильтры безопасности
  tarot/
    cards.ts          — чтение/запись cards.json
    deck.ts           — перемешивание, вытягивание карт
    spreads.ts        — чтение spreads.json
    reading.ts        — сборка контекста для LLM
    images.ts         — отправка изображений + кэш file_id
scripts/
  download_rws.ts     — скачивание изображений RWS с Wikimedia
  preload_tg_file_ids.ts — предзагрузка file_id в Telegram
data/
  cards.json          — 78 карт Таро (русский) + image_path + tg_file_id
  spreads.json        — 3 расклада
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
