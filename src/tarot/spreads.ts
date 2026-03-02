import { readFileSync } from "fs";
import { join } from "path";

export interface Spread {
  id: string;
  name: string;
  count: number;
  positions: string[];
  price: number;
  description: string;
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
