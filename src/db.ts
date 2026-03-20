import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(__dirname, "..", "data", "bot.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    runMigrations(_db);
  }
  return _db;
}

// ── Миграции ────────────────────────────────────────────────────────────────

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.exec(m.sql);
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(m.name);
    console.log(`✅ Migration applied: ${m.name}`);
  }
}

const MIGRATIONS = [
  {
    name: "001_initial",
    sql: `
      CREATE TABLE users (
        tg_id       INTEGER PRIMARY KEY,
        username    TEXT,
        first_name  TEXT,
        language    TEXT DEFAULT 'ru',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE readings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_tg_id      INTEGER NOT NULL REFERENCES users(tg_id),
        spread_id       TEXT NOT NULL,
        question        TEXT NOT NULL,
        cards_json      TEXT NOT NULL,
        interpretation  TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_readings_user ON readings(user_tg_id);

      CREATE TABLE payments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_tg_id      INTEGER NOT NULL REFERENCES users(tg_id),
        amount_stars    INTEGER NOT NULL,
        payload         TEXT NOT NULL,
        tg_payment_id   TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_payments_user ON payments(user_tg_id);

      CREATE TABLE card_cache (
        card_id           INTEGER PRIMARY KEY,
        tg_file_id        TEXT NOT NULL,
        tg_file_unique_id TEXT NOT NULL,
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: "002_daily_card",
    sql: `
      CREATE TABLE daily_subscriptions (
        user_tg_id  INTEGER PRIMARY KEY REFERENCES users(tg_id),
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE daily_cards (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_tg_id  INTEGER NOT NULL REFERENCES users(tg_id),
        card_id     INTEGER NOT NULL,
        reversed    INTEGER NOT NULL DEFAULT 0,
        revealed    INTEGER NOT NULL DEFAULT 0,
        date        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_daily_cards_user_date ON daily_cards(user_tg_id, date);
    `,
  },
  {
    name: "003_free_readings",
    sql: `
      ALTER TABLE users ADD COLUMN free_readings_left INTEGER NOT NULL DEFAULT 3;
    `,
  },
  {
    name: "004_referrals",
    sql: `
      ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL;
      ALTER TABLE users ADD COLUMN referral_rewarded INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN referral_count INTEGER NOT NULL DEFAULT 0;
    `,
  },
];

// ── Users ───────────────────────────────────────────────────────────────────

export function upsertUser(
  tgId: number,
  username?: string,
  firstName?: string,
  language?: string
): void {
  getDb()
    .prepare(
      `INSERT INTO users (tg_id, username, first_name, language)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tg_id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         last_active_at = datetime('now')`
    )
    .run(tgId, username ?? null, firstName ?? null, language ?? "ru");
}

export function touchUser(tgId: number): void {
  getDb()
    .prepare("UPDATE users SET last_active_at = datetime('now') WHERE tg_id = ?")
    .run(tgId);
}

export function getFreeReadings(tgId: number): number {
  const row = getDb()
    .prepare("SELECT free_readings_left FROM users WHERE tg_id = ?")
    .get(tgId) as { free_readings_left: number } | undefined;
  return row?.free_readings_left ?? 0;
}

export function decrementFreeReading(tgId: number): void {
  getDb()
    .prepare("UPDATE users SET free_readings_left = MAX(free_readings_left - 1, 0) WHERE tg_id = ?")
    .run(tgId);
}

export function addFreeReadings(tgId: number, count: number): void {
  getDb()
    .prepare("UPDATE users SET free_readings_left = free_readings_left + ? WHERE tg_id = ?")
    .run(count, tgId);
}

export function getReadingsCount(tgId: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS cnt FROM readings WHERE user_tg_id = ?")
    .get(tgId) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

// ── Referrals ────────────────────────────────────────────────────────────────

export function setReferrer(tgId: number, referrerTgId: number): boolean {
  // Only set if not already referred and not self-referral
  if (tgId === referrerTgId) return false;
  const row = getDb()
    .prepare("SELECT referred_by FROM users WHERE tg_id = ?")
    .get(tgId) as { referred_by: number | null } | undefined;
  if (!row || row.referred_by != null) return false;
  getDb()
    .prepare("UPDATE users SET referred_by = ? WHERE tg_id = ?")
    .run(referrerTgId, tgId);
  return true;
}

export function tryRewardReferrer(tgId: number): { referrerId: number; rewarded: boolean } | null {
  const row = getDb()
    .prepare("SELECT referred_by, referral_rewarded FROM users WHERE tg_id = ?")
    .get(tgId) as { referred_by: number | null; referral_rewarded: number } | undefined;
  if (!row || row.referred_by == null || row.referral_rewarded === 1) return null;

  const referrerId = row.referred_by;
  getDb().exec("BEGIN");
  try {
    getDb()
      .prepare("UPDATE users SET referral_rewarded = 1 WHERE tg_id = ?")
      .run(tgId);
    getDb()
      .prepare("UPDATE users SET free_readings_left = free_readings_left + 1, referral_count = referral_count + 1 WHERE tg_id = ?")
      .run(referrerId);
    getDb().exec("COMMIT");
    return { referrerId, rewarded: true };
  } catch (e) {
    getDb().exec("ROLLBACK");
    console.error("Referral reward error:", e);
    return null;
  }
}

export function getReferralCount(tgId: number): number {
  const row = getDb()
    .prepare("SELECT referral_count FROM users WHERE tg_id = ?")
    .get(tgId) as { referral_count: number } | undefined;
  return row?.referral_count ?? 0;
}

// ── Readings ────────────────────────────────────────────────────────────────

export interface ReadingRow {
  id: number;
  user_tg_id: number;
  spread_id: string;
  question: string;
  cards_json: string;
  interpretation: string | null;
  created_at: string;
}

export function saveReading(
  userTgId: number,
  spreadId: string,
  question: string,
  cardsJson: string,
  interpretation: string | null
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO readings (user_tg_id, spread_id, question, cards_json, interpretation)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userTgId, spreadId, question, cardsJson, interpretation);
  return Number(result.lastInsertRowid);
}

export function updateReadingInterpretation(
  readingId: number,
  interpretation: string
): void {
  getDb()
    .prepare("UPDATE readings SET interpretation = ? WHERE id = ?")
    .run(interpretation, readingId);
}

export function getLastReadings(userTgId: number, limit = 10): ReadingRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM readings WHERE user_tg_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userTgId, limit) as ReadingRow[];
}

// ── Profile stats ──────────────────────────────────────────────────────────

export interface UserProfile {
  tg_id: number;
  username: string | null;
  first_name: string | null;
  language: string;
  created_at: string;
  free_readings_left: number;
  total_readings: number;
  total_stars: number;
}

export function getUserProfile(tgId: number): UserProfile | null {
  const row = getDb()
    .prepare(`
      SELECT
        u.tg_id,
        u.username,
        u.first_name,
        u.language,
        u.created_at,
        u.free_readings_left,
        (SELECT COUNT(*) FROM readings WHERE user_tg_id = u.tg_id) AS total_readings,
        (SELECT COALESCE(SUM(amount_stars), 0) FROM payments WHERE user_tg_id = u.tg_id) AS total_stars
      FROM users u
      WHERE u.tg_id = ?
    `)
    .get(tgId) as UserProfile | undefined;
  return row ?? null;
}

// ── Payments ────────────────────────────────────────────────────────────────

export function savePayment(
  userTgId: number,
  amountStars: number,
  payload: string,
  tgPaymentId?: string
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO payments (user_tg_id, amount_stars, payload, tg_payment_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(userTgId, amountStars, payload, tgPaymentId ?? null);
  return Number(result.lastInsertRowid);
}

// ── Card cache ──────────────────────────────────────────────────────────────

export function getCachedFileId(
  cardId: number
): { tg_file_id: string; tg_file_unique_id: string } | null {
  const row = getDb()
    .prepare("SELECT tg_file_id, tg_file_unique_id FROM card_cache WHERE card_id = ?")
    .get(cardId) as { tg_file_id: string; tg_file_unique_id: string } | undefined;
  return row ?? null;
}

export function upsertCardCache(
  cardId: number,
  fileId: string,
  fileUniqueId: string
): void {
  getDb()
    .prepare(
      `INSERT INTO card_cache (card_id, tg_file_id, tg_file_unique_id)
       VALUES (?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET
         tg_file_id = excluded.tg_file_id,
         tg_file_unique_id = excluded.tg_file_unique_id,
         updated_at = datetime('now')`
    )
    .run(cardId, fileId, fileUniqueId);
}

// ── Daily subscriptions ─────────────────────────────────────────────────────

export function subscribeDailyCard(userTgId: number): void {
  getDb()
    .prepare(
      `INSERT INTO daily_subscriptions (user_tg_id, active)
       VALUES (?, 1)
       ON CONFLICT(user_tg_id) DO UPDATE SET active = 1`
    )
    .run(userTgId);
}

export function unsubscribeDailyCard(userTgId: number): void {
  getDb()
    .prepare("UPDATE daily_subscriptions SET active = 0 WHERE user_tg_id = ?")
    .run(userTgId);
}

export function isDailySubscribed(userTgId: number): boolean {
  const row = getDb()
    .prepare("SELECT active FROM daily_subscriptions WHERE user_tg_id = ?")
    .get(userTgId) as { active: number } | undefined;
  return row?.active === 1;
}

export function getActiveDailySubscribers(): number[] {
  const rows = getDb()
    .prepare("SELECT user_tg_id FROM daily_subscriptions WHERE active = 1")
    .all() as { user_tg_id: number }[];
  return rows.map((r) => r.user_tg_id);
}

// ── Daily cards ─────────────────────────────────────────────────────────────

export interface DailyCardRow {
  id: number;
  user_tg_id: number;
  card_id: number;
  reversed: number;
  revealed: number;
  date: string;
}

export function saveDailyCard(
  userTgId: number,
  cardId: number,
  reversed: boolean,
  date: string
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO daily_cards (user_tg_id, card_id, reversed, date)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_tg_id, date) DO NOTHING`
    )
    .run(userTgId, cardId, reversed ? 1 : 0, date);
  return Number(result.lastInsertRowid);
}

export function getTodayDailyCard(
  userTgId: number,
  date: string
): DailyCardRow | null {
  const row = getDb()
    .prepare("SELECT * FROM daily_cards WHERE user_tg_id = ? AND date = ?")
    .get(userTgId, date) as DailyCardRow | undefined;
  return row ?? null;
}

export function revealDailyCard(id: number): void {
  getDb()
    .prepare("UPDATE daily_cards SET revealed = 1 WHERE id = ?")
    .run(id);
}
