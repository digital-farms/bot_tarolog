import { Card, getAllCards } from "./cards";

export interface DrawnCard {
  card: Card;
  reversed: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawCards(count: number): DrawnCard[] {
  const shuffled = shuffle(getAllCards());
  return shuffled.slice(0, count).map((card) => ({
    card,
    reversed: Math.random() < 0.5,
  }));
}

export function drawOneExcluding(excludeIds: Set<number>): DrawnCard {
  const available = getAllCards().filter(c => !excludeIds.has(c.id));
  const shuffled = shuffle(available);
  return { card: shuffled[0], reversed: Math.random() < 0.5 };
}
