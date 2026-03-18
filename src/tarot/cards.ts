import { readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

import type { Lang } from "../i18n";

export interface Card {
  id: number;
  name_ru: string;
  name_uk?: string;
  name_en?: string;
  arcana: "major" | "minor";
  suit: string | null;
  rank: number;
  keywords_upright: string[];
  keywords_reversed: string[];
  short_upright: string;
  short_reversed: string;
  image_path: string;
  tg_file_id: string | null;
  tg_file_unique_id: string | null;
}

export function getCardName(card: Card, lang: Lang): string {
  if (lang === "uk" && card.name_uk) return card.name_uk;
  if (lang === "en" && card.name_en) return card.name_en;
  return card.name_ru;
}

const DATA_PATH = join(__dirname, "..", "..", "data", "cards.json");

let _cards: Card[] | null = null;

export function getAllCards(): Card[] {
  if (!_cards) {
    const raw = readFileSync(DATA_PATH, "utf-8");
    _cards = JSON.parse(raw) as Card[];
  }
  return _cards;
}

export function getCardById(id: number): Card | undefined {
  return getAllCards().find((c) => c.id === id);
}

export function reloadCards(): Card[] {
  _cards = null;
  return getAllCards();
}

export function saveCards(cards?: Card[]): void {
  const data = cards ?? getAllCards();
  const tmp = DATA_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tmp, DATA_PATH);
  _cards = data;
}

export function updateCardFileId(
  cardId: number,
  fileId: string,
  fileUniqueId: string
): void {
  const cards = getAllCards();
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;
  card.tg_file_id = fileId;
  card.tg_file_unique_id = fileUniqueId;
  saveCards(cards);
}
