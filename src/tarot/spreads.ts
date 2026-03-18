import { readFileSync } from "fs";
import { join } from "path";
import type { Lang } from "../i18n";

export interface Spread {
  id: string;
  name: string;
  name_uk?: string;
  name_en?: string;
  count: number;
  positions: string[];
  positions_uk?: string[];
  positions_en?: string[];
  price: number;
  description: string;
  description_uk?: string;
  description_en?: string;
}

export interface LocalizedSpread {
  id: string;
  name: string;
  count: number;
  positions: string[];
  price: number;
  description: string;
}

export function getLocalizedSpread(spread: Spread, lang: Lang): LocalizedSpread {
  const suffix = lang === "ru" ? "" : `_${lang}`;
  return {
    id: spread.id,
    name: (suffix && (spread as any)[`name${suffix}`]) || spread.name,
    count: spread.count,
    positions: (suffix && (spread as any)[`positions${suffix}`]) || spread.positions,
    price: spread.price,
    description: (suffix && (spread as any)[`description${suffix}`]) || spread.description,
  };
}

const DATA_PATH = join(__dirname, "..", "..", "data", "spreads.json");

let _spreads: Spread[] | null = null;

export function getAllSpreads(): Spread[] {
  if (!_spreads) {
    const raw = readFileSync(DATA_PATH, "utf-8");
    _spreads = JSON.parse(raw) as Spread[];
  }
  return _spreads;
}

export function getSpreadById(id: string): Spread | undefined {
  return getAllSpreads().find((s) => s.id === id);
}
