import { readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

export interface Card {
  id: number;
  name_ru: string;
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
