const APP_NAME = "Не забывай";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 45;
const OTP_DAILY_LIMIT = 10;

const TABLES = {
  Profiles: ["email", "displayName", "goal", "notificationsEnabled", "onboardingCompleted", "createdAt", "updatedAt", "avatarId"],
  Reminders: ["id", "ownerEmail", "type", "title", "timesJson", "enabled", "createdAt", "updatedAt"],
  Checkins: ["id", "ownerEmail", "type", "completedAt"],
  Sessions: ["tokenHash", "email", "expiresAt", "createdAt"],
  Otps: ["email", "codeHash", "attempts", "expiresAt", "resendAfter", "sentDate", "sentCount", "createdAt"],
};

const DEFAULT_REMINDERS = [
  { type: "water", title: "Вода", times: ["09:00", "12:00", "15:00", "18:00", "21:00"] },
  { type: "food", title: "Еда", times: ["09:00", "14:00", "19:00"] },
  { type: "rest", title: "Отдых", times: ["13:00", "17:00"] },
];

function setup() {
  const db = getDatabase_();
  return "База готова: " + db.getUrl();
}

function doGet() {
  return json_({ ok: true, app: APP_NAME, status: "ready" });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    if (action === "startOtp") return json_(startOtp_(body));
    if (action === "verifyOtp") return json_(verifyOtp_(body));
    if (action === "me") return json_(me_(body));
    if (action === "logout") return json_(logout_(body));

    const email = requireUser_(body.token);
    if (action === "getData") return json_(getData_(email));
    if (action === "toggle") return json_(toggleReminder_(email, body));
    if (action === "times") return json_(updateTimes_(email, body));
    if (action === "checkin") return json_(addCheckin_(email, body));
    if (action === "deleteCheckin") return json_(deleteCheckin_(email, body));
    if (action === "deleteCheckins") return json_(deleteCheckins_(email, body));
    if (action === "profile") return json_(updateProfile_(email, body));
    return json_({ ok: false, error: "Неизвестная команда" });
  } catch (error) {
    const message = error && error.message ? error.message : "Не удалось выполнить запрос";
    return json_({ ok: false, error: message });
  }
}

function startOtp_(body) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Проверь адрес почты");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = Date.now();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyy-MM-dd");
    const previous = findBy_("Otps", "email", email);
    if (previous && Number(previous.resendAfter) > now) throw new Error("Новый код можно запросить чуть позже");
    const sentCount = previous && previous.sentDate === today ? Number(previous.sentCount || 0) + 1 : 1;
    if (sentCount > OTP_DAILY_LIMIT) throw new Error("На эту почту сегодня отправлено слишком много кодов");

    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    upsert_("Otps", "email", email, {
      email: email,
      codeHash: hash_(email + ":" + code),
      attempts: 0,
      expiresAt: now + OTP_MINUTES * 60 * 1000,
      resendAfter: now + OTP_RESEND_SECONDS * 1000,
      sentDate: today,
      sentCount: sentCount,
      createdAt: new Date().toISOString(),
    });

    MailApp.sendEmail({
      to: email,
      subject: code + " — код для «Не забывай»",
      name: APP_NAME,
      body: "Твой код для приложения «Не забывай»: " + code + ". Код действует 10 минут.",
      htmlBody: '<div style="font-family:Arial,sans-serif;background:#fffaf5;color:#241a14;padding:32px;border-radius:24px">' +
        '<h1 style="margin:0 0 16px">Почти готово!</h1><p>Твой код подтверждения:</p>' +
        '<div style="font-size:48px;font-weight:700;letter-spacing:14px;color:#f56600;margin:24px 0">' + code + '</div>' +
        '<p style="color:#83766c">Код действует 10 минут. Никому его не сообщай.</p></div>',
    });
    return { ok: true, resendAfter: OTP_RESEND_SECONDS };
  } finally {
    lock.releaseLock();
  }
}

function verifyOtp_(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "");
  if (!/^\d{4}$/.test(code)) throw new Error("Введи четыре цифры");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const row = findBy_("Otps", "email", email);
    if (!row || Number(row.expiresAt) < Date.now() || Number(row.attempts) >= 5) throw new Error("Код устарел. Запроси новый");
    if (row.codeHash !== hash_(email + ":" + code)) {
      updateBy_("Otps", "email", email, { attempts: Number(row.attempts || 0) + 1 });
      throw new Error("Код не подошёл. Проверь цифры");
    }

    const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    append_("Sessions", {
      tokenHash: hash_(token),
      email: email,
      expiresAt: Date.now() + SESSION_DAYS * 86400000,
      createdAt: new Date().toISOString(),
    });
    deleteBy_("Otps", "email", email);
    const profile = ensureUser_(email);
    cleanupSessions_();
    return { ok: true, token: token, user: userFromProfile_(profile) };
  } finally {
    lock.releaseLock();
  }
}

function me_(body) {
  const email = requireUser_(body.token);
  return { ok: true, user: userFromProfile_(ensureUser_(email)) };
}

function logout_(body) {
  const token = String(body.token || "");
  if (token) deleteBy_("Sessions", "tokenHash", hash_(token));
  return { ok: true };
}

function getData_(email) {
  const profile = ensureUser_(email);
  const reminders = rows_("Reminders").filter(function (row) { return row.ownerEmail === email; }).map(function (row) {
    return { id: row.id, type: row.type, title: row.title, times: safeJson_(row.timesJson, []), enabled: asBool_(row.enabled) };
  });
  const weekAgo = Date.now() - 7 * 86400000;
  const checkins = rows_("Checkins").filter(function (row) {
    return row.ownerEmail === email && new Date(row.completedAt).getTime() >= weekAgo;
  }).sort(function (a, b) { return String(b.completedAt).localeCompare(String(a.completedAt)); }).slice(0, 100);
  return {
    ok: true,
    profile: normalizeProfile_(profile),
    reminders: reminders,
    checkins: checkins.map(function (row) { return { id: row.id, type: row.type, completedAt: row.completedAt }; }),
  };
}

function toggleReminder_(email, body) {
  const row = ownedReminder_(email, body.id);
  updateBy_("Reminders", "id", row.id, { enabled: body.enabled === true, updatedAt: new Date().toISOString() });
  return { ok: true };
}

function updateTimes_(email, body) {
  const row = ownedReminder_(email, body.id);
  const times = Array.isArray(body.times) ? body.times.map(String).filter(function (value, index, values) {
    return /^\d{2}:\d{2}$/.test(value) && values.indexOf(value) === index;
  }).sort().slice(0, 10) : [];
  if (!times.length) throw new Error("Добавь хотя бы одно время");
  updateBy_("Reminders", "id", row.id, { timesJson: JSON.stringify(times), updatedAt: new Date().toISOString() });
  return { ok: true };
}

function addCheckin_(email, body) {
  const type = String(body.type || "");
  if (["water", "food", "rest"].indexOf(type) === -1) throw new Error("Неизвестный тип");
  const requestedId = String(body.id || "");
  const id = /^[a-zA-Z0-9-]{8,80}$/.test(requestedId) ? requestedId : Utilities.getUuid();
  if (!findBy_("Checkins", "id", id)) {
    append_("Checkins", { id: id, ownerEmail: email, type: type, completedAt: new Date().toISOString() });
  }
  return { ok: true, id: id };
}

function deleteCheckin_(email, body) {
  const row = findBy_("Checkins", "id", String(body.id || ""));
  if (!row || row.ownerEmail !== email) throw new Error("Отметка не найдена");
  sheet_("Checkins").deleteRow(row._row);
  return { ok: true };
}

function deleteCheckins_(email, body) {
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
  const allowed = new Set(ids);
  const matches = rows_("Checkins").filter(function (row) {
    return row.ownerEmail === email && allowed.has(String(row.id));
  }).sort(function (a, b) { return b._row - a._row; });
  const sheet = sheet_("Checkins");
  matches.forEach(function (row) { sheet.deleteRow(row._row); });
  return { ok: true, deleted: matches.length };
}

function updateProfile_(email, body) {
  const displayName = String(body.displayName || "").trim().slice(0, 40);
  const goal = ["water", "food", "rest", "all"].indexOf(String(body.goal || "all")) >= 0 ? String(body.goal || "all") : "all";
  const current = findBy_("Profiles", "email", email);
  const requestedAvatar = String(body.avatarId || (current && current.avatarId) || "classic");
  const avatarId = ["classic", "dusty-red", "dreamcicle", "dandelion", "spring-green", "blue-lagoon", "plum-purple", "raspberry", "candy-floss", "blue-hawaii"].indexOf(requestedAvatar) >= 0 ? requestedAvatar : "classic";
  if (!displayName) throw new Error("Введи имя");
  const update = { displayName: displayName, goal: goal, avatarId: avatarId, updatedAt: new Date().toISOString() };
  if (body.onboardingCompleted === true) update.onboardingCompleted = true;
  if (body.notificationsEnabled === true) update.notificationsEnabled = true;
  updateBy_("Profiles", "email", email, update);
  return { ok: true };
}

function ensureUser_(email) {
  let profile = findBy_("Profiles", "email", email);
  if (!profile) {
    profile = {
      email: email,
      displayName: email.split("@")[0],
      goal: "all",
      notificationsEnabled: false,
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      avatarId: "classic",
    };
    append_("Profiles", profile);
  }
  const hasReminders = rows_("Reminders").some(function (row) { return row.ownerEmail === email; });
  if (!hasReminders) {
    DEFAULT_REMINDERS.forEach(function (item) {
      append_("Reminders", {
        id: Utilities.getUuid(), ownerEmail: email, type: item.type, title: item.title,
        timesJson: JSON.stringify(item.times), enabled: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
  }
  return profile;
}

function requireUser_(token) {
  const value = String(token || "");
  if (!value) throw new Error("Нужно войти");
  const session = findBy_("Sessions", "tokenHash", hash_(value));
  if (!session || Number(session.expiresAt) < Date.now()) throw new Error("Сессия закончилась. Войди снова");
  return session.email;
}

function ownedReminder_(email, id) {
  const row = findBy_("Reminders", "id", String(id || ""));
  if (!row || row.ownerEmail !== email) throw new Error("Напоминание не найдено");
  return row;
}

function normalizeProfile_(profile) {
  return {
    email: profile.email,
    displayName: profile.displayName,
    goal: profile.goal || "all",
    notificationsEnabled: asBool_(profile.notificationsEnabled),
    onboardingCompleted: asBool_(profile.onboardingCompleted),
    avatarId: profile.avatarId || "classic",
  };
}

function userFromProfile_(profile) {
  return { email: profile.email, displayName: profile.displayName, fullName: null };
}

function getDatabase_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("DB_SPREADSHEET_ID");
  let db;
  if (!id) {
    db = SpreadsheetApp.create(APP_NAME + " — база");
    props.setProperty("DB_SPREADSHEET_ID", db.getId());
  } else {
    db = SpreadsheetApp.openById(id);
  }
  Object.keys(TABLES).forEach(function (name) {
    let sheet = db.getSheetByName(name);
    if (!sheet) sheet = db.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(TABLES[name]);
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
      TABLES[name].forEach(function (header) {
        if (currentHeaders.indexOf(header) === -1) {
          sheet.getRange(1, currentHeaders.length + 1).setValue(header);
          currentHeaders.push(header);
        }
      });
    }
  });
  const first = db.getSheetByName("Sheet1") || db.getSheetByName("Лист1");
  if (first && Object.keys(TABLES).indexOf(first.getName()) === -1 && db.getSheets().length > Object.keys(TABLES).length) db.deleteSheet(first);
  return db;
}

function sheet_(name) {
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error("Не найдена таблица " + name);
  return sheet;
}

function rows_(name) {
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row, index) {
    const object = { _row: index + 2 };
    headers.forEach(function (header, cell) { object[header] = row[cell]; });
    return object;
  });
}

function findBy_(name, key, value) {
  return rows_(name).find(function (row) { return String(row[key]) === String(value); }) || null;
}

function append_(name, object) {
  const headers = TABLES[name];
  sheet_(name).appendRow(headers.map(function (key) { return object[key] === undefined ? "" : object[key]; }));
}

function upsert_(name, key, value, object) {
  const existing = findBy_(name, key, value);
  if (existing) updateBy_(name, key, value, object); else append_(name, object);
}

function updateBy_(name, key, value, updates) {
  const row = findBy_(name, key, value);
  if (!row) throw new Error("Запись не найдена");
  const headers = TABLES[name];
  headers.forEach(function (header, index) {
    if (updates[header] !== undefined) sheet_(name).getRange(row._row, index + 1).setValue(updates[header]);
  });
}

function deleteBy_(name, key, value) {
  const sheet = sheet_(name);
  const matches = rows_(name).filter(function (row) { return String(row[key]) === String(value); }).sort(function (a, b) { return b._row - a._row; });
  matches.forEach(function (row) { sheet.deleteRow(row._row); });
}

function cleanupSessions_() {
  const sheet = sheet_("Sessions");
  rows_("Sessions").filter(function (row) { return Number(row.expiresAt) < Date.now(); }).sort(function (a, b) { return b._row - a._row; }).forEach(function (row) { sheet.deleteRow(row._row); });
}

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function (byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function safeJson_(value, fallback) {
  try { return JSON.parse(String(value)); } catch (error) { return fallback; }
}

function asBool_(value) {
  return value === true || String(value).toLowerCase() === "true" || Number(value) === 1;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
