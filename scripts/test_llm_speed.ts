import "dotenv/config";
import { getInterpretation } from "../src/llm";
import { ReadingContext } from "../src/tarot/reading";

const mock: ReadingContext = {
  question: "Что ждёт меня в ближайший месяц?",
  spread: { id: "triangle", name: "Треугольник судьбы", count: 3, positions: ["Прошлое", "Настоящее", "Будущее"], price: 1, description: "" },
  positions: [
    { position: "Прошлое", cardName: "Шут", reversed: false, keywords: ["начало", "свобода"], shortMeaning: "Новое начало, спонтанность" },
    { position: "Настоящее", cardName: "Башня", reversed: true, keywords: ["разрушение", "перемены"], shortMeaning: "Избежание катастрофы" },
    { position: "Будущее", cardName: "Звезда", reversed: false, keywords: ["надежда", "вдохновение"], shortMeaning: "Свет в конце тоннеля" },
  ],
};

async function main() {
  const model = process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini";
  console.log(`Модель: ${model}`);
  console.log("Запрос к LLM...\n");

  const t0 = Date.now();
  const result = await getInterpretation(mock, false);
  const ms = Date.now() - t0;

  console.log(`--- Ответ (${result.length} символов) ---`);
  console.log(result);
  console.log(`\n⏱  Время: ${(ms / 1000).toFixed(1)}с`);
}

main().catch((e) => {
  console.error("Ошибка:", e.message);
  process.exit(1);
});
