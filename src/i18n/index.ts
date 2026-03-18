import ru from "./locales/ru";
import uk from "./locales/uk";
import en from "./locales/en";
import { getDb } from "../db";

export type Lang = "ru" | "uk" | "en";

const locales: Record<Lang, Record<string, string>> = { ru, uk, en };

const SUPPORTED_LANGS: Lang[] = ["ru", "uk", "en"];

export function isLang(s: string): s is Lang {
  return SUPPORTED_LANGS.includes(s as Lang);
}

/**
 * Get a localized string by key.
 * Supports {placeholder} substitution via vars.
 * Falls back to Russian if the key is missing in the requested locale.
 */
export function t(
  key: string,
  lang: Lang,
  vars?: Record<string, string | number>
): string {
  const str = locales[lang]?.[key] ?? locales.ru[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * Resolve user language from DB. Returns "ru" as default.
 */
export function getUserLang(tgId: number): Lang {
  const row = getDb()
    .prepare("SELECT language FROM users WHERE tg_id = ?")
    .get(tgId) as { language: string } | undefined;
  const lang = row?.language;
  if (lang && isLang(lang)) return lang;
  return "ru";
}

/**
 * Detect language from Telegram language_code.
 */
export function detectLang(languageCode?: string): Lang {
  if (!languageCode) return "ru";
  const lc = languageCode.toLowerCase();
  if (lc === "uk" || lc === "ua") return "uk";
  if (lc.startsWith("en")) return "en";
  return "ru";
}

/**
 * Save user's language choice to DB.
 */
export function setUserLang(tgId: number, lang: Lang): void {
  getDb()
    .prepare("UPDATE users SET language = ? WHERE tg_id = ?")
    .run(lang, tgId);
}
