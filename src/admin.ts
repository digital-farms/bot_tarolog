import crypto from "crypto";
import express from "express";
import { getDb, subscribeDailyCard, unsubscribeDailyCard, isDailySubscribed } from "./db";

const ADMIN_KEY = process.env["ADMIN_KEY"] || "changeme";
const ADMIN_PORT = parseInt(process.env["ADMIN_PORT"] || "3737", 10);
const ADMIN_PATH = process.env["ADMIN_PATH"] || "/admin";

const app = express();
app.use(express.urlencoded({ extended: false }));

// ── Security headers ────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  next();
});

// ── Cookie-based session ────────────────────────────────────────────────────
const SESSION_TOKEN = crypto.randomBytes(32).toString("hex");
const COOKIE_NAME = "tarot_admin";

function parseCookies(header: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!header) return map;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map[k] = v.join("=");
  }
  return map;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── Brute-force protection ──────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 min

function getClientIp(req: express.Request): string {
  return (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function isBlocked(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil > Date.now()) return true;
  if (entry.blockedUntil > 0) { loginAttempts.delete(ip); }
  return false;
}

function recordFailedLogin(ip: string): void {
  // Cap map size to prevent memory exhaustion from DDoS
  if (loginAttempts.size > 10000) {
    const oldest = loginAttempts.keys().next().value;
    if (oldest) loginAttempts.delete(oldest);
  }
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION;
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
}

function clearFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Router (all routes under ADMIN_PATH) ────────────────────────────────────
const router = express.Router();

router.get("/login", (_req, res) => {
  res.send(loginPage());
});

router.post("/login", (req, res) => {
  const ip = getClientIp(req);
  if (isBlocked(ip)) {
    res.send(loginPage("Слишком много попыток. Подожди 15 минут."));
    return;
  }
  if (req.body.key && safeEqual(req.body.key, ADMIN_KEY)) {
    clearFailedLogins(ip);
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    res.redirect(`${ADMIN_PATH}/`);
  } else {
    recordFailedLogin(ip);
    res.send(loginPage("Неверный ключ"));
  }
});

router.get("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
  res.redirect(`${ADMIN_PATH}/login`);
});

// ── Auth middleware ──────────────────────────────────────────────────────────
router.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME] === SESSION_TOKEN) { next(); return; }
  res.redirect(`${ADMIN_PATH}/login`);
});

// ── Layout ──────────────────────────────────────────────────────────────────
function loginPage(error?: string): string {
  const errHtml = error ? `<div style="color:#cf6f6f;margin-bottom:12px">${esc(error)}</div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вход — Таро Админ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .login { background: #1a1a2e; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.4); }
  .login h1 { color: #c9a0ff; margin-bottom: 20px; font-size: 20px; }
  input { background: #252545; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 10px 14px; font-size: 16px; width: 260px; margin-bottom: 12px; display: block; }
  button { background: #7b5ea7; color: white; border: none; border-radius: 6px; padding: 10px 24px; cursor: pointer; font-size: 16px; width: 100%; }
  button:hover { background: #9b7ec7; }
</style>
</head><body>
<div class="login">
  <h1>Таро Админ</h1>
  ${errHtml}
  <form method="post" action="${ADMIN_PATH}/login">
    <input name="key" type="password" placeholder="Ключ доступа" autofocus>
    <button type="submit">Войти</button>
  </form>
</div>
</body></html>`;
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 0; }
  .wrapper { max-width: 1100px; margin: 0 auto; padding: 20px; }
  h1 { color: #c9a0ff; margin-bottom: 16px; font-size: 22px; }
  h2 { color: #a0cfff; margin: 20px 0 10px; font-size: 17px; }
  a { color: #c9a0ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .nav { display: flex; gap: 6px; padding: 10px 20px; background: #12122a; border-bottom: 1px solid #252545; align-items: center; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; }
  .nav a { padding: 6px 14px; border-radius: 6px; font-size: 14px; color: #bbb; transition: background .15s; }
  .nav a:hover, .nav a.active { background: #252545; color: #c9a0ff; text-decoration: none; }
  .nav-right { margin-left: auto; }
  .nav-right a { color: #666 !important; font-size: 13px; }
  .card { background: #1a1a2e; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .stats-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .stat { background: #1a1a2e; border-radius: 10px; padding: 16px 20px; text-align: center; min-width: 140px; flex: 1; }
  .stat .num { font-size: 30px; font-weight: bold; color: #c9a0ff; display: block; }
  .stat .label { font-size: 12px; color: #888; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #1f1f3a; }
  th { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; position: sticky; top: 0; background: #1a1a2e; }
  tr:hover td { background: #20203a; }
  td a { color: #a0cfff; }
  input, select, textarea { background: #252545; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 6px 10px; font-size: 14px; }
  input:focus, select:focus, textarea:focus { border-color: #7b5ea7; outline: none; }
  textarea { font-family: inherit; resize: vertical; }
  button, .btn { background: #7b5ea7; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 14px; display: inline-block; text-decoration: none; transition: background .15s; }
  button:hover, .btn:hover { background: #9b7ec7; text-decoration: none; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .btn-danger { background: #7a3030; }
  .btn-danger:hover { background: #a04040; }
  .btn-green { background: #2a6a3a; }
  .btn-green:hover { background: #3a8a4a; }
  .msg { padding: 10px 16px; border-radius: 6px; margin-bottom: 12px; }
  .msg-ok { background: #1a3a2a; color: #6fcf97; }
  .msg-err { background: #3a1a1a; color: #cf6f6f; }
  .msg-info { background: #1a2a3a; color: #6fb5cf; }
  .search-bar { margin-bottom: 16px; display: flex; gap: 8px; }
  .search-bar input { width: 320px; }
  .pagination { display: flex; gap: 6px; margin-top: 12px; align-items: center; }
  .pagination a, .pagination span { padding: 4px 12px; border-radius: 4px; font-size: 13px; }
  .pagination a { background: #252545; color: #c9a0ff; }
  .pagination a:hover { background: #353565; text-decoration: none; }
  .pagination .cur { background: #7b5ea7; color: white; }
  .form-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  .form-row label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .detail-grid { display: grid; grid-template-columns: 160px 1fr; gap: 6px 16px; font-size: 14px; }
  .detail-grid dt { color: #888; }
  .detail-grid dd { color: #e0e0e0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #1a3a2a; color: #6fcf97; }
  .badge-red { background: #3a1a1a; color: #cf6f6f; }
  .badge-blue { background: #1a2a3a; color: #6fb5cf; }
  .confirm-form { display: inline; }
  .text-muted { color: #666; }
  .text-sm { font-size: 12px; }
  pre { background: #12122a; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; max-height: 300px; overflow-y: auto; }
  @media (max-width: 700px) {
    .stats-grid { flex-direction: column; }
    .search-bar input { width: 100%; }
    .form-row { flex-direction: column; align-items: stretch; }
    .detail-grid { grid-template-columns: 1fr; }
  }
`;

function page(title: string, body: string, activeNav?: string): string {
  const navItems = [
    { href: "/", label: "Статистика", icon: "bar-chart" },
    { href: "/users", label: "Пользователи", icon: "users" },
    { href: "/readings", label: "Расклады", icon: "book" },
    { href: "/payments", label: "Платежи", icon: "star" },
    { href: "/daily", label: "Карта дня", icon: "sun" },
    { href: "/cards", label: "Карты", icon: "image" },
  ];
  const nav = navItems.map(n =>
    `<a href="${ADMIN_PATH}${n.href}" class="${activeNav === n.href ? 'active' : ''}">${n.label}</a>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Таро Админ</title>
<style>${CSS}</style>
</head><body>
<div class="nav">
  ${nav}
  <span class="nav-right"><a href="${ADMIN_PATH}/logout">Выйти</a></span>
</div>
<div class="wrapper">
<h1>${title}</h1>
${body}
</div>
</body></html>`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  return `${days}д назад`;
}

function msgBox(req: express.Request): string {
  const m = req.query.msg as string || "";
  if (m === "ok") return '<div class="msg msg-ok">Сохранено</div>';
  if (m === "deleted") return '<div class="msg msg-ok">Удалено</div>';
  if (m === "added") return '<div class="msg msg-ok">Добавлено</div>';
  if (m === "exists") return '<div class="msg msg-info">Уже существует</div>';
  if (m === "err") return '<div class="msg msg-err">Ошибка</div>';
  return "";
}

function paginate(baseUrl: string, currentPage: number, totalPages: number): string {
  if (totalPages <= 1) return "";
  const parts: string[] = [];
  const range = 3;
  const start = Math.max(1, currentPage - range);
  const end = Math.min(totalPages, currentPage + range);
  if (start > 1) parts.push(`<a href="${baseUrl}&p=1">1</a>`);
  if (start > 2) parts.push(`<span class="text-muted">...</span>`);
  for (let i = start; i <= end; i++) {
    if (i === currentPage) parts.push(`<span class="cur">${i}</span>`);
    else parts.push(`<a href="${baseUrl}&p=${i}">${i}</a>`);
  }
  if (end < totalPages - 1) parts.push(`<span class="text-muted">...</span>`);
  if (end < totalPages) parts.push(`<a href="${baseUrl}&p=${totalPages}">${totalPages}</a>`);
  return `<div class="pagination">${parts.join("")}</div>`;
}

const PER_PAGE = 30;

function confirmBtn(action: string, label: string, cssClass = "btn-danger btn-sm"): string {
  return `<form method="post" action="${action}" class="confirm-form" onsubmit="return confirm('Точно?')"><button class="btn ${cssClass}">${label}</button></form>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Dashboard ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/", (_req, res) => {
  const db = getDb();
  const q = (s: string) => (db.prepare(s).get() as any).c;

  const totalUsers = q("SELECT COUNT(*) as c FROM users");
  const totalReadings = q("SELECT COUNT(*) as c FROM readings");
  const todayReadings = q("SELECT COUNT(*) as c FROM readings WHERE date(created_at) = date('now')");
  const weekReadings = q("SELECT COUNT(*) as c FROM readings WHERE created_at >= datetime('now', '-7 days')");
  const totalPayments = q("SELECT COUNT(*) as c FROM payments");
  const totalStars = q("SELECT COALESCE(SUM(amount_stars),0) as c FROM payments");
  const weekStars = q("SELECT COALESCE(SUM(amount_stars),0) as c FROM payments WHERE created_at >= datetime('now', '-7 days')");
  const dailySubs = q("SELECT COUNT(*) as c FROM daily_subscriptions WHERE active = 1");
  const todayRevealed = q("SELECT COUNT(*) as c FROM daily_cards WHERE date = date('now') AND revealed = 1");
  const cachedCards = q("SELECT COUNT(*) as c FROM card_cache");
  const newUsersToday = q("SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now')");
  const newUsersWeek = q("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days')");

  const recentUsers = db.prepare(`
    SELECT tg_id, username, first_name, created_at FROM users ORDER BY created_at DESC LIMIT 5
  `).all() as any[];

  const recentReadings = db.prepare(`
    SELECT r.id, r.spread_id, r.question, r.created_at, u.username, u.first_name, u.tg_id
    FROM readings r LEFT JOIN users u ON r.user_tg_id = u.tg_id
    ORDER BY r.created_at DESC LIMIT 5
  `).all() as any[];

  const recentUsersHtml = recentUsers.map((u: any) =>
    `<tr><td><a href="${ADMIN_PATH}/user/${u.tg_id}">${esc(u.first_name || u.username || String(u.tg_id))}</a></td><td class="text-muted text-sm">${timeAgo(u.created_at)}</td></tr>`
  ).join("");

  const recentReadingsHtml = recentReadings.map((r: any) =>
    `<tr><td><a href="${ADMIN_PATH}/reading/${r.id}">#${r.id}</a></td><td>${esc(r.spread_id)}</td><td><a href="${ADMIN_PATH}/user/${r.tg_id}">${esc(r.first_name || r.username || String(r.tg_id))}</a></td><td class="text-muted text-sm">${timeAgo(r.created_at)}</td></tr>`
  ).join("");

  res.send(page("Панель управления", `
    <div class="stats-grid">
      <div class="stat"><span class="num">${totalUsers}</span><span class="label">Пользователей</span></div>
      <div class="stat"><span class="num">${newUsersToday} / ${newUsersWeek}</span><span class="label">Новых сегодня / неделя</span></div>
      <div class="stat"><span class="num">${dailySubs}</span><span class="label">Подписок карта дня</span></div>
      <div class="stat"><span class="num">${totalReadings}</span><span class="label">Всего раскладов</span></div>
      <div class="stat"><span class="num">${todayReadings} / ${weekReadings}</span><span class="label">Раскладов сегодня / нед.</span></div>
      <div class="stat"><span class="num">${totalStars}</span><span class="label">Stars всего</span></div>
      <div class="stat"><span class="num">${weekStars}</span><span class="label">Stars за неделю</span></div>
      <div class="stat"><span class="num">${todayRevealed}</span><span class="label">Карт дня раскрыто</span></div>
      <div class="stat"><span class="num">${cachedCards}</span><span class="label">Карт в кэше</span></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="card">
        <h2>Новые пользователи</h2>
        <table>${recentUsersHtml || '<tr><td class="text-muted">Пусто</td></tr>'}</table>
      </div>
      <div class="card">
        <h2>Последние расклады</h2>
        <table>${recentReadingsHtml || '<tr><td class="text-muted">Пусто</td></tr>'}</table>
      </div>
    </div>
  `, "/"));
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Users list ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/users", (req, res) => {
  const db = getDb();
  const search = (req.query.q as string || "").trim();
  const pg = Math.max(1, parseInt(req.query.p as string || "1", 10));
  const sort = (req.query.sort as string) || "last_active";
  const offset = (pg - 1) * PER_PAGE;

  const orderMap: Record<string, string> = {
    last_active: "u.last_active_at DESC",
    created: "u.created_at DESC",
    readings: "readings_count DESC",
    free: "u.free_readings_left DESC",
    name: "u.first_name ASC",
  };
  const orderBy = orderMap[sort] || orderMap.last_active;

  let where = "";
  let params: any[] = [];
  if (search) {
    where = "WHERE CAST(u.tg_id AS TEXT) LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?";
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params) as any).c;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  const users = db.prepare(`
    SELECT u.*, ds.active as daily_active,
      (SELECT COUNT(*) FROM readings WHERE user_tg_id = u.tg_id) as readings_count,
      (SELECT COALESCE(SUM(amount_stars),0) FROM payments WHERE user_tg_id = u.tg_id) as total_stars
    FROM users u LEFT JOIN daily_subscriptions ds ON u.tg_id = ds.user_tg_id
    ${where}
    ORDER BY ${orderBy} LIMIT ? OFFSET ?
  `).all(...params, PER_PAGE, offset) as any[];

  const sortLink = (key: string, label: string) =>
    `<a href="${ADMIN_PATH}/users?q=${encodeURIComponent(search)}&sort=${key}&p=1" style="${sort === key ? 'color:#c9a0ff;font-weight:bold' : ''}">${label}</a>`;

  const rows = users.map((u: any) =>
    `<tr>
      <td><a href="${ADMIN_PATH}/user/${u.tg_id}">${u.tg_id}</a></td>
      <td>${esc(u.first_name || "—")}</td>
      <td>${esc(u.username || "—")}</td>
      <td>${u.free_readings_left}</td>
      <td>${u.daily_active ? '<span class="badge badge-green">Да</span>' : '<span class="badge badge-red">Нет</span>'}</td>
      <td>${u.readings_count}</td>
      <td>${u.total_stars}</td>
      <td class="text-sm">${timeAgo(u.last_active_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/user/${u.tg_id}/delete`, "Удалить")}</td>
    </tr>`
  ).join("");

  const baseUrl = `${ADMIN_PATH}/users?q=${encodeURIComponent(search)}&sort=${sort}`;

  res.send(page("Пользователи", `
    ${msgBox(req)}
    <div class="card">
      <h2>Добавить пользователя</h2>
      <form method="post" action="${ADMIN_PATH}/users/add" class="form-row" style="margin-top:8px">
        <label>TG ID: <input name="tg_id" type="number" required style="width:160px" placeholder="123456789"></label>
        <label>Имя: <input name="first_name" type="text" style="width:140px" placeholder="Имя"></label>
        <label>Username: <input name="username" type="text" style="width:140px" placeholder="@username"></label>
        <label>Free: <input name="free" type="number" value="3" min="0" style="width:60px"></label>
        <label>Daily:
          <select name="daily">
            <option value="1" selected>Да</option>
            <option value="0">Нет</option>
          </select>
        </label>
        <button type="submit">Добавить</button>
      </form>
    </div>

    <div class="search-bar" style="margin-top:12px">
      <form method="get">
        <input name="q" value="${esc(search)}" placeholder="Поиск по ID, имени, username...">
        <input type="hidden" name="sort" value="${esc(sort)}">
        <button type="submit">Поиск</button>
      </form>
    </div>

    <div class="text-sm text-muted" style="margin-bottom:8px">
      Всего: <b>${total}</b> &nbsp; | &nbsp; Сортировка:
      ${sortLink("last_active", "Активность")} &nbsp;
      ${sortLink("created", "Регистрация")} &nbsp;
      ${sortLink("readings", "Расклады")} &nbsp;
      ${sortLink("free", "Free")} &nbsp;
      ${sortLink("name", "Имя")}
    </div>

    <div class="card">
      <table>
        <tr><th>TG ID</th><th>Имя</th><th>Username</th><th>Free</th><th>Daily</th><th>Расклады</th><th>Stars</th><th>Активность</th><th></th></tr>
        ${rows || '<tr><td colspan="9" class="text-muted">Нет пользователей</td></tr>'}
      </table>
      ${paginate(baseUrl, pg, totalPages)}
    </div>
  `, "/users"));
});

// ── Add user (POST) ─────────────────────────────────────────────────────────
router.post("/users/add", (req, res) => {
  const tgId = parseInt(req.body.tg_id, 10);
  const freeReadings = parseInt(req.body.free, 10) || 3;
  const dailyActive = req.body.daily === "1";
  const firstName = (req.body.first_name || "").trim() || null;
  const username = (req.body.username || "").trim().replace(/^@/, "") || null;

  if (isNaN(tgId)) { res.redirect(`${ADMIN_PATH}/users?msg=err`); return; }

  const existing = getDb().prepare("SELECT tg_id FROM users WHERE tg_id = ?").get(tgId);
  if (existing) {
    res.redirect(`${ADMIN_PATH}/user/${tgId}?msg=exists`);
    return;
  }

  getDb().prepare(
    "INSERT INTO users (tg_id, username, first_name, free_readings_left) VALUES (?, ?, ?, ?)"
  ).run(tgId, username, firstName, freeReadings);

  if (dailyActive) subscribeDailyCard(tgId);

  res.redirect(`${ADMIN_PATH}/users?msg=added`);
});

// ══════════════════════════════════════════════════════════════════════════════
// ── User detail ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/user/:id", (req, res) => {
  const db = getDb();
  const tgId = parseInt(req.params.id, 10);

  const user = db.prepare("SELECT * FROM users WHERE tg_id = ?").get(tgId) as any;
  if (!user) { res.send(page("Не найден", `<div class="msg msg-err">Пользователь ${tgId} не найден.</div>`, "/users")); return; }

  const dailySub = isDailySubscribed(tgId);
  const readingsCount = (db.prepare("SELECT COUNT(*) as c FROM readings WHERE user_tg_id = ?").get(tgId) as any).c;
  const totalStars = (db.prepare("SELECT COALESCE(SUM(amount_stars),0) as c FROM payments WHERE user_tg_id = ?").get(tgId) as any).c;
  const referralCount = user.referral_count || 0;

  const readings = db.prepare(
    "SELECT id, spread_id, question, created_at FROM readings WHERE user_tg_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(tgId) as any[];
  const payments = db.prepare(
    "SELECT id, amount_stars, payload, tg_payment_id, created_at FROM payments WHERE user_tg_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(tgId) as any[];
  const dailyCards = db.prepare(
    "SELECT id, card_id, reversed, revealed, date FROM daily_cards WHERE user_tg_id = ? ORDER BY date DESC LIMIT 10"
  ).all(tgId) as any[];

  const readingsRows = readings.map((r: any) =>
    `<tr>
      <td><a href="${ADMIN_PATH}/reading/${r.id}">#${r.id}</a></td>
      <td>${esc(r.spread_id)}</td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.question || "—")}</td>
      <td class="text-sm">${timeAgo(r.created_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/reading/${r.id}/delete?ret=user&uid=${tgId}`, "Удалить")}</td>
    </tr>`
  ).join("");

  const paymentsRows = payments.map((p: any) =>
    `<tr>
      <td>#${p.id}</td>
      <td>${p.amount_stars}</td>
      <td>${esc(p.payload || "—")}</td>
      <td class="text-sm">${esc(p.tg_payment_id || "—")}</td>
      <td class="text-sm">${timeAgo(p.created_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/payment/${p.id}/delete?ret=user&uid=${tgId}`, "Удалить")}</td>
    </tr>`
  ).join("");

  const dailyRows = dailyCards.map((d: any) =>
    `<tr>
      <td>${esc(d.date)}</td>
      <td>Карта #${d.card_id}</td>
      <td>${d.reversed ? '<span class="badge badge-blue">Перевёрн.</span>' : "Прямая"}</td>
      <td>${d.revealed ? '<span class="badge badge-green">Да</span>' : '<span class="badge badge-red">Нет</span>'}</td>
    </tr>`
  ).join("");

  res.send(page(`${esc(user.first_name || user.username || String(tgId))}`, `
    ${msgBox(req)}
    <div class="card">
      <dl class="detail-grid">
        <dt>TG ID</dt><dd>${user.tg_id}</dd>
        <dt>Username</dt><dd>${esc(user.username || "—")}</dd>
        <dt>Имя</dt><dd>${esc(user.first_name || "—")}</dd>
        <dt>Язык</dt><dd>${esc(user.language || "ru")}</dd>
        <dt>Регистрация</dt><dd>${user.created_at}</dd>
        <dt>Активность</dt><dd>${timeAgo(user.last_active_at)}</dd>
        <dt>Free раскладов</dt><dd>${user.free_readings_left}</dd>
        <dt>Всего раскладов</dt><dd>${readingsCount}</dd>
        <dt>Stars потрачено</dt><dd>${totalStars}</dd>
        <dt>Карта дня</dt><dd>${dailySub ? '<span class="badge badge-green">Подписан</span>' : '<span class="badge badge-red">Отписан</span>'}</dd>
        <dt>Рефералов</dt><dd>${referralCount}</dd>
        <dt>Приглашён кем</dt><dd>${user.referred_by || "—"}</dd>
      </dl>
    </div>

    <div class="card">
      <h2>Редактировать</h2>
      <form method="post" action="${ADMIN_PATH}/user/${tgId}/update" class="form-row">
        <label>Имя: <input name="first_name" value="${esc(user.first_name || "")}" style="width:140px"></label>
        <label>Username: <input name="username" value="${esc(user.username || "")}" style="width:140px"></label>
        <label>Язык:
          <select name="language">
            <option value="ru" ${user.language === "ru" ? "selected" : ""}>ru</option>
            <option value="uk" ${user.language === "uk" ? "selected" : ""}>uk</option>
            <option value="en" ${user.language === "en" ? "selected" : ""}>en</option>
          </select>
        </label>
        <label>Free: <input name="free" type="number" value="${user.free_readings_left}" min="0" style="width:70px"></label>
        <label>Daily:
          <select name="daily">
            <option value="1" ${dailySub ? "selected" : ""}>Подписан</option>
            <option value="0" ${!dailySub ? "selected" : ""}>Отписан</option>
          </select>
        </label>
        <button type="submit">Сохранить</button>
      </form>
    </div>

    <div style="margin:12px 0">
      ${confirmBtn(`${ADMIN_PATH}/user/${tgId}/delete`, "Удалить пользователя", "btn-danger")}
    </div>

    <h2>Расклады (${readingsCount})</h2>
    <div class="card">
      <table>
        <tr><th>ID</th><th>Расклад</th><th>Вопрос</th><th>Когда</th><th></th></tr>
        ${readingsRows || '<tr><td colspan="5" class="text-muted">Нет раскладов</td></tr>'}
      </table>
    </div>

    <h2>Платежи (${payments.length})</h2>
    <div class="card">
      <table>
        <tr><th>ID</th><th>Stars</th><th>Payload</th><th>TG Payment</th><th>Когда</th><th></th></tr>
        ${paymentsRows || '<tr><td colspan="6" class="text-muted">Нет платежей</td></tr>'}
      </table>
    </div>

    <h2>Карты дня</h2>
    <div class="card">
      <table>
        <tr><th>Дата</th><th>Карта</th><th>Позиция</th><th>Раскрыта</th></tr>
        ${dailyRows || '<tr><td colspan="4" class="text-muted">Нет карт дня</td></tr>'}
      </table>
    </div>
  `, "/users"));
});

// ── User update (POST) ─────────────────────────────────────────────────────
router.post("/user/:id/update", (req, res) => {
  const tgId = parseInt(req.params.id, 10);
  const freeReadings = parseInt(req.body.free, 10);
  const dailyActive = req.body.daily === "1";
  const firstName = (req.body.first_name ?? "").trim() || null;
  const username = (req.body.username ?? "").trim().replace(/^@/, "") || null;
  const language = req.body.language || "ru";

  getDb().prepare(
    "UPDATE users SET first_name = ?, username = ?, language = ?, free_readings_left = ? WHERE tg_id = ?"
  ).run(firstName, username, language, isNaN(freeReadings) ? 0 : freeReadings, tgId);

  if (dailyActive) {
    subscribeDailyCard(tgId);
  } else {
    unsubscribeDailyCard(tgId);
  }

  res.redirect(`${ADMIN_PATH}/user/${tgId}?msg=ok`);
});

// ── User delete (POST) ──────────────────────────────────────────────────────
router.post("/user/:id/delete", (req, res) => {
  const tgId = parseInt(req.params.id, 10);
  const db = getDb();
  db.prepare("DELETE FROM daily_cards WHERE user_tg_id = ?").run(tgId);
  db.prepare("DELETE FROM daily_subscriptions WHERE user_tg_id = ?").run(tgId);
  db.prepare("DELETE FROM payments WHERE user_tg_id = ?").run(tgId);
  db.prepare("DELETE FROM readings WHERE user_tg_id = ?").run(tgId);
  db.prepare("DELETE FROM users WHERE tg_id = ?").run(tgId);
  res.redirect(`${ADMIN_PATH}/users?msg=deleted`);
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Readings ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/readings", (req, res) => {
  const db = getDb();
  const search = (req.query.q as string || "").trim();
  const pg = Math.max(1, parseInt(req.query.p as string || "1", 10));
  const offset = (pg - 1) * PER_PAGE;

  let where = "";
  let params: any[] = [];
  if (search) {
    where = "WHERE CAST(r.user_tg_id AS TEXT) LIKE ? OR r.question LIKE ? OR r.spread_id LIKE ?";
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM readings r ${where}`).get(...params) as any).c;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  const readings = db.prepare(`
    SELECT r.*, u.username, u.first_name
    FROM readings r LEFT JOIN users u ON r.user_tg_id = u.tg_id
    ${where}
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, PER_PAGE, offset) as any[];

  const rows = readings.map((r: any) =>
    `<tr>
      <td><a href="${ADMIN_PATH}/reading/${r.id}">#${r.id}</a></td>
      <td><a href="${ADMIN_PATH}/user/${r.user_tg_id}">${esc(r.first_name || r.username || String(r.user_tg_id))}</a></td>
      <td>${esc(r.spread_id)}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.question || "—")}</td>
      <td class="text-sm">${timeAgo(r.created_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/reading/${r.id}/delete`, "Удалить")}</td>
    </tr>`
  ).join("");

  const baseUrl = `${ADMIN_PATH}/readings?q=${encodeURIComponent(search)}`;

  res.send(page("Расклады", `
    ${msgBox(req)}
    <div class="search-bar">
      <form method="get">
        <input name="q" value="${esc(search)}" placeholder="Поиск по user ID, вопросу, типу расклада...">
        <button type="submit">Поиск</button>
      </form>
    </div>
    <div class="text-sm text-muted" style="margin-bottom:8px">Всего: <b>${total}</b></div>
    <div class="card">
      <table>
        <tr><th>ID</th><th>Пользователь</th><th>Расклад</th><th>Вопрос</th><th>Когда</th><th></th></tr>
        ${rows || '<tr><td colspan="6" class="text-muted">Нет раскладов</td></tr>'}
      </table>
      ${paginate(baseUrl, pg, totalPages)}
    </div>
  `, "/readings"));
});

// ── Reading detail ──────────────────────────────────────────────────────────
router.get("/reading/:id", (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const reading = db.prepare("SELECT r.*, u.username, u.first_name FROM readings r LEFT JOIN users u ON r.user_tg_id = u.tg_id WHERE r.id = ?").get(id) as any;
  if (!reading) { res.send(page("Не найден", '<div class="msg msg-err">Расклад не найден</div>', "/readings")); return; }

  let cardsHtml = "";
  try {
    const cards = JSON.parse(reading.cards_json);
    cardsHtml = `<pre>${esc(JSON.stringify(cards, null, 2))}</pre>`;
  } catch { cardsHtml = `<pre>${esc(reading.cards_json || "—")}</pre>`; }

  res.send(page(`Расклад #${id}`, `
    ${msgBox(req)}
    <div class="card">
      <dl class="detail-grid">
        <dt>ID</dt><dd>${reading.id}</dd>
        <dt>Пользователь</dt><dd><a href="${ADMIN_PATH}/user/${reading.user_tg_id}">${esc(reading.first_name || reading.username || String(reading.user_tg_id))}</a></dd>
        <dt>Расклад</dt><dd>${esc(reading.spread_id)}</dd>
        <dt>Дата</dt><dd>${reading.created_at}</dd>
      </dl>
    </div>
    <h2>Вопрос</h2>
    <div class="card"><p>${esc(reading.question || "—")}</p></div>
    <h2>Карты</h2>
    <div class="card">${cardsHtml}</div>
    <h2>Интерпретация</h2>
    <div class="card">
      <form method="post" action="${ADMIN_PATH}/reading/${id}/update">
        <textarea name="interpretation" rows="10" style="width:100%">${esc(reading.interpretation || "")}</textarea>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button type="submit">Сохранить</button>
          ${confirmBtn(`${ADMIN_PATH}/reading/${id}/delete`, "Удалить расклад")}
        </div>
      </form>
    </div>
  `, "/readings"));
});

// ── Reading update (POST) ───────────────────────────────────────────────────
router.post("/reading/:id/update", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const interpretation = req.body.interpretation || "";
  getDb().prepare("UPDATE readings SET interpretation = ? WHERE id = ?").run(interpretation, id);
  res.redirect(`${ADMIN_PATH}/reading/${id}?msg=ok`);
});

// ── Reading delete (POST) ───────────────────────────────────────────────────
router.post("/reading/:id/delete", (req, res) => {
  const id = parseInt(req.params.id, 10);
  getDb().prepare("DELETE FROM readings WHERE id = ?").run(id);
  const ret = req.query.ret as string;
  const uid = req.query.uid as string;
  if (ret === "user" && uid) {
    res.redirect(`${ADMIN_PATH}/user/${uid}?msg=deleted`);
  } else {
    res.redirect(`${ADMIN_PATH}/readings?msg=deleted`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Payments ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/payments", (req, res) => {
  const db = getDb();
  const search = (req.query.q as string || "").trim();
  const pg = Math.max(1, parseInt(req.query.p as string || "1", 10));
  const offset = (pg - 1) * PER_PAGE;

  let where = "";
  let params: any[] = [];
  if (search) {
    where = "WHERE CAST(p.user_tg_id AS TEXT) LIKE ? OR p.payload LIKE ? OR p.tg_payment_id LIKE ?";
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM payments p ${where}`).get(...params) as any).c;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const totalStars = (db.prepare(`SELECT COALESCE(SUM(amount_stars),0) as c FROM payments p ${where}`).get(...params) as any).c;

  const payments = db.prepare(`
    SELECT p.*, u.username, u.first_name
    FROM payments p LEFT JOIN users u ON p.user_tg_id = u.tg_id
    ${where}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, PER_PAGE, offset) as any[];

  const rows = payments.map((p: any) =>
    `<tr>
      <td>#${p.id}</td>
      <td><a href="${ADMIN_PATH}/user/${p.user_tg_id}">${esc(p.first_name || p.username || String(p.user_tg_id))}</a></td>
      <td><b>${p.amount_stars}</b></td>
      <td>${esc(p.payload || "—")}</td>
      <td class="text-sm">${esc(p.tg_payment_id || "—")}</td>
      <td class="text-sm">${timeAgo(p.created_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/payment/${p.id}/delete`, "Удалить")}</td>
    </tr>`
  ).join("");

  const baseUrl = `${ADMIN_PATH}/payments?q=${encodeURIComponent(search)}`;

  res.send(page("Платежи", `
    ${msgBox(req)}
    <div class="search-bar">
      <form method="get">
        <input name="q" value="${esc(search)}" placeholder="Поиск по user ID, payload, payment ID...">
        <button type="submit">Поиск</button>
      </form>
    </div>
    <div class="text-sm text-muted" style="margin-bottom:8px">
      Всего: <b>${total}</b> &nbsp; | &nbsp; Stars: <b>${totalStars}</b>
    </div>

    <div class="card">
      <h2>Добавить платёж вручную</h2>
      <form method="post" action="${ADMIN_PATH}/payments/add" class="form-row">
        <label>TG ID: <input name="user_tg_id" type="number" required style="width:160px" placeholder="123456789"></label>
        <label>Stars: <input name="amount_stars" type="number" required min="1" style="width:80px" value="1"></label>
        <label>Payload: <input name="payload" type="text" style="width:160px" placeholder="manual" value="admin_manual"></label>
        <button type="submit">Добавить</button>
      </form>
    </div>

    <div class="card" style="margin-top:12px">
      <table>
        <tr><th>ID</th><th>Пользователь</th><th>Stars</th><th>Payload</th><th>TG Payment</th><th>Когда</th><th></th></tr>
        ${rows || '<tr><td colspan="7" class="text-muted">Нет платежей</td></tr>'}
      </table>
      ${paginate(baseUrl, pg, totalPages)}
    </div>
  `, "/payments"));
});

// ── Add payment (POST) ──────────────────────────────────────────────────────
router.post("/payments/add", (req, res) => {
  const userTgId = parseInt(req.body.user_tg_id, 10);
  const amount = parseInt(req.body.amount_stars, 10);
  const payload = (req.body.payload || "admin_manual").trim();
  if (isNaN(userTgId) || isNaN(amount)) { res.redirect(`${ADMIN_PATH}/payments?msg=err`); return; }

  const userExists = getDb().prepare("SELECT tg_id FROM users WHERE tg_id = ?").get(userTgId);
  if (!userExists) { res.redirect(`${ADMIN_PATH}/payments?msg=err`); return; }

  getDb().prepare(
    "INSERT INTO payments (user_tg_id, amount_stars, payload) VALUES (?, ?, ?)"
  ).run(userTgId, amount, payload);
  res.redirect(`${ADMIN_PATH}/payments?msg=added`);
});

// ── Payment delete (POST) ───────────────────────────────────────────────────
router.post("/payment/:id/delete", (req, res) => {
  const id = parseInt(req.params.id, 10);
  getDb().prepare("DELETE FROM payments WHERE id = ?").run(id);
  const ret = req.query.ret as string;
  const uid = req.query.uid as string;
  if (ret === "user" && uid) {
    res.redirect(`${ADMIN_PATH}/user/${uid}?msg=deleted`);
  } else {
    res.redirect(`${ADMIN_PATH}/payments?msg=deleted`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Daily subscriptions & cards ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/daily", (req, res) => {
  const db = getDb();
  const tab = (req.query.tab as string) || "subs";
  const pg = Math.max(1, parseInt(req.query.p as string || "1", 10));
  const offset = (pg - 1) * PER_PAGE;

  let content = "";

  if (tab === "cards") {
    const total = (db.prepare("SELECT COUNT(*) as c FROM daily_cards").get() as any).c;
    const totalPages = Math.ceil(total / PER_PAGE) || 1;
    const cards = db.prepare(`
      SELECT dc.*, u.username, u.first_name
      FROM daily_cards dc LEFT JOIN users u ON dc.user_tg_id = u.tg_id
      ORDER BY dc.date DESC, dc.id DESC LIMIT ? OFFSET ?
    `).all(PER_PAGE, offset) as any[];

    const rows = cards.map((d: any) =>
      `<tr>
        <td>${d.id}</td>
        <td><a href="${ADMIN_PATH}/user/${d.user_tg_id}">${esc(d.first_name || d.username || String(d.user_tg_id))}</a></td>
        <td>${d.date}</td>
        <td>Карта #${d.card_id}</td>
        <td>${d.reversed ? '<span class="badge badge-blue">Перевёрн.</span>' : "Прямая"}</td>
        <td>${d.revealed ? '<span class="badge badge-green">Да</span>' : '<span class="badge badge-red">Нет</span>'}</td>
        <td>${confirmBtn(`${ADMIN_PATH}/daily/card/${d.id}/delete`, "Удалить")}</td>
      </tr>`
    ).join("");

    content = `
      <div class="text-sm text-muted" style="margin-bottom:8px">Всего: <b>${total}</b></div>
      <div class="card">
        <table>
          <tr><th>ID</th><th>Пользователь</th><th>Дата</th><th>Карта</th><th>Позиция</th><th>Раскрыта</th><th></th></tr>
          ${rows || '<tr><td colspan="7" class="text-muted">Нет карт дня</td></tr>'}
        </table>
        ${paginate(`${ADMIN_PATH}/daily?tab=cards`, pg, totalPages)}
      </div>
    `;
  } else {
    const total = (db.prepare("SELECT COUNT(*) as c FROM daily_subscriptions").get() as any).c;
    const active = (db.prepare("SELECT COUNT(*) as c FROM daily_subscriptions WHERE active = 1").get() as any).c;
    const totalPages = Math.ceil(total / PER_PAGE) || 1;
    const subs = db.prepare(`
      SELECT ds.*, u.username, u.first_name
      FROM daily_subscriptions ds LEFT JOIN users u ON ds.user_tg_id = u.tg_id
      ORDER BY ds.created_at DESC LIMIT ? OFFSET ?
    `).all(PER_PAGE, offset) as any[];

    const rows = subs.map((s: any) =>
      `<tr>
        <td><a href="${ADMIN_PATH}/user/${s.user_tg_id}">${esc(s.first_name || s.username || String(s.user_tg_id))}</a></td>
        <td>${s.active ? '<span class="badge badge-green">Активна</span>' : '<span class="badge badge-red">Неактивна</span>'}</td>
        <td class="text-sm">${timeAgo(s.created_at)}</td>
        <td>
          ${s.active
            ? confirmBtn(`${ADMIN_PATH}/daily/unsub/${s.user_tg_id}`, "Отписать", "btn-danger btn-sm")
            : confirmBtn(`${ADMIN_PATH}/daily/sub/${s.user_tg_id}`, "Подписать", "btn-green btn-sm")
          }
        </td>
        <td>${confirmBtn(`${ADMIN_PATH}/daily/sub/${s.user_tg_id}/delete`, "Удалить", "btn-danger btn-sm")}</td>
      </tr>`
    ).join("");

    content = `
      <div class="text-sm text-muted" style="margin-bottom:8px">
        Всего: <b>${total}</b> &nbsp; | &nbsp; Активных: <b>${active}</b>
      </div>
      <div class="card">
        <table>
          <tr><th>Пользователь</th><th>Статус</th><th>Подписан</th><th></th><th></th></tr>
          ${rows || '<tr><td colspan="5" class="text-muted">Нет подписок</td></tr>'}
        </table>
        ${paginate(`${ADMIN_PATH}/daily?tab=subs`, pg, totalPages)}
      </div>
    `;
  }

  const tabLink = (key: string, label: string) =>
    `<a href="${ADMIN_PATH}/daily?tab=${key}" class="btn btn-sm ${tab === key ? '' : 'btn-danger'}" style="${tab === key ? '' : 'background:#252545;color:#bbb'}">${label}</a>`;

  res.send(page("Карта дня", `
    ${msgBox(req)}
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${tabLink("subs", "Подписки")}
      ${tabLink("cards", "Карты дня")}
    </div>
    ${content}
  `, "/daily"));
});

// ── Daily actions ───────────────────────────────────────────────────────────
router.post("/daily/sub/:id", (req, res) => {
  subscribeDailyCard(parseInt(req.params.id, 10));
  res.redirect(`${ADMIN_PATH}/daily?msg=ok`);
});
router.post("/daily/unsub/:id", (req, res) => {
  unsubscribeDailyCard(parseInt(req.params.id, 10));
  res.redirect(`${ADMIN_PATH}/daily?msg=ok`);
});
router.post("/daily/sub/:id/delete", (req, res) => {
  getDb().prepare("DELETE FROM daily_subscriptions WHERE user_tg_id = ?").run(parseInt(req.params.id, 10));
  res.redirect(`${ADMIN_PATH}/daily?msg=deleted`);
});
router.post("/daily/card/:id/delete", (req, res) => {
  getDb().prepare("DELETE FROM daily_cards WHERE id = ?").run(parseInt(req.params.id, 10));
  res.redirect(`${ADMIN_PATH}/daily?tab=cards&msg=deleted`);
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Card cache ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
router.get("/cards", (req, res) => {
  const db = getDb();
  const pg = Math.max(1, parseInt(req.query.p as string || "1", 10));
  const offset = (pg - 1) * PER_PAGE;

  const total = (db.prepare("SELECT COUNT(*) as c FROM card_cache").get() as any).c;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  const cards = db.prepare(`
    SELECT * FROM card_cache ORDER BY card_id ASC LIMIT ? OFFSET ?
  `).all(PER_PAGE, offset) as any[];

  const rows = cards.map((c: any) =>
    `<tr>
      <td>${c.card_id}</td>
      <td class="text-sm" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.tg_file_id)}</td>
      <td class="text-sm">${esc(c.tg_file_unique_id)}</td>
      <td class="text-sm">${timeAgo(c.updated_at)}</td>
      <td>${confirmBtn(`${ADMIN_PATH}/cards/${c.card_id}/delete`, "Удалить")}</td>
    </tr>`
  ).join("");

  const baseUrl = `${ADMIN_PATH}/cards?_=1`;

  res.send(page("Карты (кэш file_id)", `
    ${msgBox(req)}
    <div class="text-sm text-muted" style="margin-bottom:8px">
      Закэшировано: <b>${total}</b> &nbsp; | &nbsp;
      ${confirmBtn(`${ADMIN_PATH}/cards/clear`, "Очистить весь кэш")}
    </div>
    <div class="card">
      <table>
        <tr><th>Card ID</th><th>TG File ID</th><th>Unique ID</th><th>Обновлено</th><th></th></tr>
        ${rows || '<tr><td colspan="5" class="text-muted">Кэш пуст</td></tr>'}
      </table>
      ${paginate(baseUrl, pg, totalPages)}
    </div>
  `, "/cards"));
});

router.post("/cards/:id/delete", (req, res) => {
  getDb().prepare("DELETE FROM card_cache WHERE card_id = ?").run(parseInt(req.params.id, 10));
  res.redirect(`${ADMIN_PATH}/cards?msg=deleted`);
});

router.post("/cards/clear", (_req, res) => {
  getDb().prepare("DELETE FROM card_cache").run();
  res.redirect(`${ADMIN_PATH}/cards?msg=deleted`);
});

// ── Mount & Start ───────────────────────────────────────────────────────────
app.use(ADMIN_PATH, router);

// Return 404 on all unknown paths (don't leak ADMIN_PATH)
app.use((_req, res) => { res.status(404).end(); });

export function startAdmin(): void {
  if (ADMIN_KEY === "changeme") {
    console.warn("⚠️  ADMIN_KEY is default 'changeme' — set a strong key in .env before deploying!");
  }
  app.listen(ADMIN_PORT, "0.0.0.0", () => {
    console.log(`🛡 Admin panel: http://localhost:${ADMIN_PORT}${ADMIN_PATH}`);
  });
}
