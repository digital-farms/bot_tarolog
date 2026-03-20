import type { Lang } from "./i18n";
import { t } from "./i18n";

export interface Level {
  id: number;
  key: string;      // locale key suffix: "neophyte", "seeker", etc.
  emoji: string;
  threshold: number; // min readings to reach this level
  bonus: number;     // free readings awarded on level-up
}

const LEVELS: Level[] = [
  { id: 0, key: "neophyte",  emoji: "🌑", threshold: 0,   bonus: 0 },
  { id: 1, key: "seeker",    emoji: "🌘", threshold: 5,   bonus: 1 },
  { id: 2, key: "adept",     emoji: "🌗", threshold: 15,  bonus: 2 },
  { id: 3, key: "mystic",    emoji: "🌖", threshold: 35,  bonus: 3 },
  { id: 4, key: "master",    emoji: "🌕", threshold: 75,  bonus: 4 },
  { id: 5, key: "oracle",    emoji: "✨", threshold: 200, bonus: 5 },
];

export interface UserLevel {
  level: Level;
  next: Level | null;
  current: number;   // total readings
  progress: string;  // e.g. "████░░░░ 10/35"
}

export function getLevel(totalReadings: number): UserLevel {
  let lvl = LEVELS[0];
  for (const l of LEVELS) {
    if (totalReadings >= l.threshold) lvl = l;
  }

  const idx = LEVELS.indexOf(lvl);
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;

  let progress: string;
  if (!next) {
    progress = "████████████ MAX";
  } else {
    const done = totalReadings - lvl.threshold;
    const total = next.threshold - lvl.threshold;
    const filled = Math.round((done / total) * 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    progress = `${bar} ${totalReadings}/${next.threshold}`;
  }

  return { level: lvl, next, current: totalReadings, progress };
}

export function getLevelName(level: Level, lang: Lang): string {
  return t(`level.${level.key}`, lang);
}

/**
 * Check if a user leveled up after a reading.
 * Call with the NEW total readings count.
 * Returns the new level if leveled up, null otherwise.
 */
export function checkLevelUp(prevTotal: number, newTotal: number): Level | null {
  const prevLvl = getLevel(prevTotal).level;
  const newLvl = getLevel(newTotal).level;
  if (newLvl.id > prevLvl.id) return newLvl;
  return null;
}
