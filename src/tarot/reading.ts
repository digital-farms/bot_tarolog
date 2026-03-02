import { DrawnCard } from "./deck";
import { Spread } from "./spreads";

export interface ReadingContext {
  question: string;
  spread: Spread;
  positions: {
    position: string;
    cardName: string;
    reversed: boolean;
    keywords: string[];
    shortMeaning: string;
  }[];
}

export function buildReadingContext(
  question: string,
  spread: Spread,
  drawn: DrawnCard[]
): ReadingContext {
  const positions = spread.positions.map((pos, i) => {
    const d = drawn[i];
    const reversed = d.reversed;
    return {
      position: pos,
      cardName: d.card.name_ru,
      reversed,
      keywords: reversed
        ? d.card.keywords_reversed
        : d.card.keywords_upright,
      shortMeaning: reversed
        ? d.card.short_reversed
        : d.card.short_upright,
    };
  });

  return { question, spread, positions };
}

export function formatCardsMessage(ctx: ReadingContext): string {
  const lines = ctx.positions.map((p) => {
    const orient = p.reversed ? "перевёрнутая" : "прямая";
    return `<b>${p.position}</b>: <i>${p.cardName}</i> (${orient})`;
  });
  return lines.join("\n");
}
