import crypto from "crypto";
import express from "express";
import { getDb, subscribeDailyCard, unsubscribeDailyCard, isDailySubscribed } from "./db";

const ADMIN_KEY = process.env["ADMIN_KEY"] || "changeme";
const ADMIN_PORT = parseInt(process.env["ADMIN_PORT"] || "3737", 10);

const app = express();
app.use(express.urlencoded({ extended: false }));

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

// ── Login page ──────────────────────────────────────────────────────────────
app.get("/login", (_req, res) => {
  res.send(loginPage());
});

app.post("/login", (req, res) => {
  if (req.body.key === ADMIN_KEY) {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.redirect("/");
  } else {
    res.send(loginPage("Неверный ключ"));
  }
});

app.get("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
  res.redirect("/login");
});

// ── Auth middleware ──────────────────────────────────────────────────────────
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME] === SESSION_TOKEN) { next(); return; }
  // Also allow ?key= for first login convenience
  if (req.query.key === ADMIN_KEY) {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.redirect(req.path);
    return;
  }
  res.redirect("/login");
});

// ── Layout ──────────────────────────────────────────────────────────────────
function loginPage(error?: string): string {
  const errHtml = error ? `<div style="color:#cf6f6f;margin-bottom:12px">${error}</div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>🔒 Вход — Таро Админ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .login { background: #1a1a2e; border-radius: 12px; padding: 32px; text-align: center; }
  .login h1 { color: #c9a0ff; margin-bottom: 20px; font-size: 20px; }
  input { background: #252545; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 10px 14px; font-size: 16px; width: 240px; margin-bottom: 12px; display: block; }
  button { background: #7b5ea7; color: white; border: none; border-radius: 6px; padding: 10px 24px; cursor: pointer; font-size: 16px; width: 100%; }
  button:hover { background: #9b7ec7; }
</style>
</head><body>
<div class="login">
  <h1>🔮 Таро Админ</h1>
  ${errHtml}
  <form method="post" action="/login">
    <input name="key" type="password" placeholder="Ключ доступа" autofocus>
    <button type="submit">Войти</button>
  </form>
</div>
</body></html>`;
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Таро Админ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { color: #c9a0ff; margin-bottom: 16px; font-size: 22px; }
  h2 { color: #a0cfff; margin: 20px 0 10px; font-size: 18px; }
  a { color: #c9a0ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .nav { display: flex; gap: 16px; margin-bottom: 20px; padding: 12px; background: #1a1a2e; border-radius: 8px; align-items: center; }
  .nav-right { margin-left: auto; }
  .nav-right a { color: #888; font-size: 13px; }
  .card { background: #1a1a2e; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .stat { display: inline-block; background: #252545; border-radius: 8px; padding: 14px 20px; margin: 4px; text-align: center; min-width: 120px; }
  .stat .num { font-size: 28px; font-weight: bold; color: #c9a0ff; display: block; }
  .stat .label { font-size: 12px; color: #888; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #252545; }
  th { color: #888; font-size: 12px; text-transform: uppercase; }
  tr:hover { background: #252545; }
  input, select { background: #252545; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 6px 10px; font-size: 14px; }
  button, .btn { background: #7b5ea7; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 14px; display: inline-block; }
  button:hover, .btn:hover { background: #9b7ec7; }
  .msg { padding: 10px 16px; border-radius: 6px; margin-bottom: 12px; }
  .msg-ok { background: #1a3a2a; color: #6fcf97; }
  .search-bar { margin-bottom: 16px; }
  .search-bar input { width: 300px; }
</style>
</head><body>
<div class="nav">
  <a href="/">📊 Статистика</a>
  <a href="/users">👥 Пользователи</a>
  <span class="nav-right"><a href="/logout">🚪 Выйти</a></span>
</div>
<h1>${title}</h1>
${body}
</body></html>`;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  const db = getDb();

  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const totalReadings = (db.prepare("SELECT COUNT(*) as c FROM readings").get() as any).c;
  const todayReadings = (db.prepare("SELECT COUNT(*) as c FROM readings WHERE date(created_at) = date('now')").get() as any).c;
  const totalPayments = (db.prepare("SELECT COUNT(*) as c FROM payments").get() as any).c;
  const totalStars = (db.prepare("SELECT COALESCE(SUM(amount_stars),0) as c FROM payments").get() as any).c;
  const dailySubs = (db.prepare("SELECT COUNT(*) as c FROM daily_subscriptions WHERE active = 1").get() as any).c;
  const todayRevealed = (db.prepare("SELECT COUNT(*) as c FROM daily_cards WHERE date = date('now') AND revealed = 1").get() as any).c;

  res.send(page("📊 Панель управления", `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px">
      <div class="stat"><span class="num">${totalUsers}</span><span class="label">Пользователей</span></div>
      <div class="stat"><span class="num">${dailySubs}</span><span class="label">Подписок на карту дня</span></div>
      <div class="stat"><span class="num">${totalReadings}</span><span class="label">Всего раскладов</span></div>
      <div class="stat"><span class="num">${todayReadings}</span><span class="label">Раскладов сегодня</span></div>
      <div class="stat"><span class="num">${totalStars}</span><span class="label">⭐ Stars всего</span></div>
      <div class="stat"><span class="num">${todayRevealed}</span><span class="label">Карт дня раскрыто</span></div>
    </div>
  `));
});

// ── Users list ──────────────────────────────────────────────────────────────
app.get("/users", (req, res) => {
  const db = getDb();
  const search = (req.query.q as string || "").trim();

  let users: any[];
  if (search) {
    users = db.prepare(`
      SELECT u.*, ds.active as daily_active,
        (SELECT COUNT(*) FROM readings WHERE user_tg_id = u.tg_id) as readings_count
      FROM users u LEFT JOIN daily_subscriptions ds ON u.tg_id = ds.user_tg_id
      WHERE CAST(u.tg_id AS TEXT) LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?
      ORDER BY u.last_active_at DESC LIMIT 50
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    users = db.prepare(`
      SELECT u.*, ds.active as daily_active,
        (SELECT COUNT(*) FROM readings WHERE user_tg_id = u.tg_id) as readings_count
      FROM users u LEFT JOIN daily_subscriptions ds ON u.tg_id = ds.user_tg_id
      ORDER BY u.last_active_at DESC LIMIT 50
    `).all();
  }

  const rows = users.map((u: any) =>
    `<tr>
      <td><a href="/user/${u.tg_id}">${u.tg_id}</a></td>
      <td>${esc(u.first_name || "—")}</td>
      <td>${esc(u.username || "—")}</td>
      <td>${u.free_readings_left}</td>
      <td>${u.daily_active ? "✅" : "❌"}</td>
      <td>${u.readings_count}</td>
      <td>${timeAgo(u.last_active_at)}</td>
    </tr>`
  ).join("");

  const addMsg = req.query.add as string || "";
  const addMsgHtml = addMsg === "ok" ? '<div class="msg msg-ok">✅ Пользователь добавлен</div>'
    : addMsg === "exists" ? '<div class="msg msg-ok">ℹ️ Пользователь уже существует</div>' : "";

  res.send(page("👥 Пользователи", `
    ${addMsgHtml}
    <div class="card">
      <h2>➕ Добавить пользователя</h2>
      <form method="post" action="/users/add" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <label>TG ID: <input name="tg_id" type="number" required style="width:140px" placeholder="123456789"></label>
        <label>Free: <input name="free" type="number" value="3" min="0" style="width:60px"></label>
        <label>Daily:
          <select name="daily">
            <option value="1" selected>✅ Да</option>
            <option value="0">❌ Нет</option>
          </select>
        </label>
        <button type="submit">➕ Добавить</button>
      </form>
    </div>
    <div class="search-bar" style="margin-top:16px">
      <form method="get">
        <input name="q" value="${esc(search)}" placeholder="Поиск по ID, имени, username..." autofocus>
        <button type="submit">🔍</button>
      </form>
    </div>
    <div class="card">
      <table>
        <tr><th>TG ID</th><th>Имя</th><th>Username</th><th>Free</th><th>Daily</th><th>Расклады</th><th>Активность</th></tr>
        ${rows || '<tr><td colspan="7" style="color:#666">Никого нет</td></tr>'}
      </table>
    </div>
  `));
});

// ── Add user (POST) ─────────────────────────────────────────────────────────
app.post("/users/add", (req, res) => {
  const tgId = parseInt(req.body.tg_id, 10);
  const freeReadings = parseInt(req.body.free, 10) || 3;
  const dailyActive = req.body.daily === "1";

  if (isNaN(tgId)) { res.redirect("/users?add=err"); return; }

  const existing = getDb().prepare("SELECT tg_id FROM users WHERE tg_id = ?").get(tgId);
  if (existing) {
    res.redirect(`/user/${tgId}?msg=ok`);
    return;
  }

  getDb().prepare(
    "INSERT INTO users (tg_id, free_readings_left) VALUES (?, ?)"
  ).run(tgId, freeReadings);

  if (dailyActive) subscribeDailyCard(tgId);

  res.redirect("/users?add=ok");
});

// ── User detail ─────────────────────────────────────────────────────────────
app.get("/user/:id", (req, res) => {
  const db = getDb();
  const tgId = parseInt(req.params.id, 10);
  const msg = req.query.msg as string || "";

  const user = db.prepare("SELECT * FROM users WHERE tg_id = ?").get(tgId) as any;
  if (!user) { res.send(page("❌ Не найден", `Пользователь ${tgId} не найден.`)); return; }

  const dailySub = isDailySubscribed(tgId);
  const readings = db.prepare(
    "SELECT id, spread_id, question, created_at FROM readings WHERE user_tg_id = ? ORDER BY created_at DESC LIMIT 15"
  ).all(tgId) as any[];
  const payments = db.prepare(
    "SELECT amount_stars, payload, created_at FROM payments WHERE user_tg_id = ? ORDER BY created_at DESC LIMIT 15"
  ).all(tgId) as any[];

  const msgHtml = msg === "ok" ? '<div class="msg msg-ok">✅ Сохранено</div>' : "";

  const readingsCount = readings.length;

  const paymentsRows = payments.map((p: any) =>
    `<tr><td>⭐ ${p.amount_stars}</td><td>${p.payload}</td><td>${timeAgo(p.created_at)}</td></tr>`
  ).join("");

  res.send(page(`👤 ${esc(user.first_name || user.username || String(tgId))}`, `
    ${msgHtml}
    <div class="card">
      <p><b>TG ID:</b> ${user.tg_id} &nbsp; <b>Username:</b> ${esc(user.username || "—")} &nbsp; <b>Язык:</b> ${user.language}</p>
      <p><b>Зарегистрирован:</b> ${user.created_at} &nbsp; <b>Последняя активность:</b> ${timeAgo(user.last_active_at)}</p>
    </div>

    <div class="card">
      <h2>⚙️ Управление</h2>
      <form method="post" action="/user/${tgId}/update" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <label>Бесплатных раскладов:
          <input name="free" type="number" value="${user.free_readings_left}" min="0" style="width:70px">
        </label>
        <label>Карта дня:
          <select name="daily">
            <option value="1" ${dailySub ? "selected" : ""}>✅ Подписан</option>
            <option value="0" ${!dailySub ? "selected" : ""}>❌ Отписан</option>
          </select>
        </label>
        <button type="submit">💾 Сохранить</button>
      </form>
    </div>

    <div class="card" style="margin-top:16px">
      <p>🃏 <b>Раскладов:</b> ${readingsCount}</p>
    </div>

    <h2>⭐ Платежи (${payments.length})</h2>
    <div class="card">
      <table>
        <tr><th>Stars</th><th>Payload</th><th>Когда</th></tr>
        ${paymentsRows || '<tr><td colspan="3" style="color:#666">Нет платежей</td></tr>'}
      </table>
    </div>
  `));
});

// ── User update (POST) ─────────────────────────────────────────────────────
app.post("/user/:id/update", (req, res) => {
  const tgId = parseInt(req.params.id, 10);
  const freeReadings = parseInt(req.body.free, 10);
  const dailyActive = req.body.daily === "1";

  if (!isNaN(freeReadings)) {
    getDb().prepare("UPDATE users SET free_readings_left = ? WHERE tg_id = ?").run(freeReadings, tgId);
  }

  if (dailyActive) {
    subscribeDailyCard(tgId);
  } else {
    unsubscribeDailyCard(tgId);
  }

  res.redirect(`/user/${tgId}?msg=ok`);
});

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

// ── Start ───────────────────────────────────────────────────────────────────
export function startAdmin(): void {
  app.listen(ADMIN_PORT, "127.0.0.1", () => {
    console.log(`🛡 Admin panel: http://localhost:${ADMIN_PORT}`);
  });
}
