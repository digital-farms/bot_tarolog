import { ReadingContext } from "./tarot/reading";
import { t, Lang } from "./i18n";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env variable: ${key}`);
  return val;
}

function buildPrompt(ctx: ReadingContext, sensitive: boolean, lang: Lang = "ru"): string {
  const cardsBlock = ctx.positions
    .map((p) => {
      const orient = t(p.reversed ? "common.reversed" : "common.upright", lang);
      return [
        `${t("llm.position_label", lang)}: ${p.position}`,
        `${t("llm.card_label", lang)}: ${p.cardName} (${orient})`,
        `${t("llm.keywords_label", lang)}: ${p.keywords.join(", ")}`,
        `${t("llm.meaning_label", lang)}: ${p.shortMeaning}`,
      ].join("\n");
    })
    .join("\n\n");

  const sensitiveNote = sensitive ? t("llm.sensitive_note", lang) : "";

  return t("llm.prompt", lang, {
    question: ctx.question,
    spread_name: ctx.spread.name,
    cards_block: cardsBlock,
    sensitive_note: sensitiveNote,
  });
}

export async function getInterpretation(
  ctx: ReadingContext,
  sensitive: boolean,
  lang: Lang = "ru"
): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const model = process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini";

  const body = {
    model,
    messages: [
      {
        role: "user" as const,
        content: buildPrompt(ctx, sensitive, lang),
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

export async function getClarifyInterpretation(
  prompt: string,
): Promise<string> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  const model = process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini";

  const body = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
    max_tokens: 800,
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
  if (!content) throw new Error("Empty response from LLM");

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
