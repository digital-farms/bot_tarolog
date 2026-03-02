import { ReadingContext } from "./tarot/reading";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env variable: ${key}`);
  return val;
}

function buildPrompt(ctx: ReadingContext, sensitive: boolean): string {
  const cardsBlock = ctx.positions
    .map((p) => {
      const orient = p.reversed ? "перевёрнутая" : "прямая";
      return [
        `Позиция: ${p.position}`,
        `Карта: ${p.cardName} (${orient})`,
        `Ключевые слова: ${p.keywords.join(", ")}`,
        `Краткое значение: ${p.shortMeaning}`,
      ].join("\n");
    })
    .join("\n\n");

  const sensitiveNote = sensitive
    ? "\nВАЖНО: вопрос касается медицины/юридических/финансовых тем. Дай нейтральную трактовку без категоричных инструкций, мягко порекомендуй обратиться к профильному специалисту."
    : "";

  return `Ты — опытный таролог с многолетней практикой. Говори от лица карт, используй образный, мистический, но тёплый язык. Обращайся на "ты". Используй обороты вроде "карты шепчут...", "энергия расклада указывает...", "в этой позиции раскрывается...". Не будь сухим справочником — будь проводником.

Вопрос обратившегося: "${ctx.question}"
Расклад: ${ctx.spread.name}

Выпавшие карты:
${cardsBlock}
${sensitiveNote}

Структура ответа:
1. Трактовка по каждой позиции (1–3 абзаца в зависимости от количества карт). Описывай образно, что карта "говорит" в этой позиции, как она связана с вопросом.
2. Общий вывод — объедини послание карт в целостную картину.
3. 2–4 мягких практических шага для саморефлексии. Формулируй как приглашение, не как инструкцию ("попробуй обратить внимание на...", "позволь себе...").

Правила:
- Объём: 900–1400 символов.
- Никакой разметки: ни HTML, ни markdown (**, ##, - и т.д.). Только чистый текст с переносами строк.
- Можно 1–2 эмоджи в самом начале ответа.
- Пиши на русском.
- Тон: мистичный, тёплый, без категоричности. Это зеркало для саморефлексии, не приговор судьбы.`;
}

export async function getInterpretation(
  ctx: ReadingContext,
  sensitive: boolean
): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const model = process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini";

  const body = {
    model,
    messages: [
      {
        role: "user" as const,
        content: buildPrompt(ctx, sensitive),
      },
    ],
    max_tokens: 1536,
    temperature: 0.8,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from LLM");
  }

  return cleanLlmOutput(content.trim());
}

function cleanLlmOutput(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}
