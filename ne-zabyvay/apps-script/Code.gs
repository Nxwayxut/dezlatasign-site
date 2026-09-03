const APP_NAME = "Не забывай";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 45;
const OTP_DAILY_LIMIT = 10;
const PASSWORD_ROUNDS = 2500;
const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCK_MINUTES = 15;
const DB_SCHEMA_VERSION = "2026-09-care-reminders-v4";

let DB_CACHE_ = null;
const SHEET_CACHE_ = {};
let ROW_CACHE_ = {};

const TABLES = {
  Profiles: ["email", "displayName", "goal", "notificationsEnabled", "onboardingCompleted", "createdAt", "updatedAt", "avatarId", "passwordHash", "passwordSalt", "passwordFailedAttempts", "passwordLockedUntil", "passwordUpdatedAt"],
  Reminders: ["id", "ownerEmail", "type", "category", "title", "description", "timesJson", "daysJson", "enabled", "createdAt", "updatedAt"],
  Checkins: ["id", "ownerEmail", "type", "completedAt"],
  Sessions: ["tokenHash", "email", "expiresAt", "createdAt"],
  Otps: ["email", "codeHash", "attempts", "expiresAt", "resendAfter", "sentDate", "sentCount", "createdAt", "mode"],
};

const DEFAULT_REMINDERS = [
  { type: "water", category: "basic", title: "Вода", description: "Не забыть сделать пару глотков", times: ["09:00", "12:00", "15:00", "18:00", "21:00"], days: [0, 1, 2, 3, 4, 5, 6], enabled: true },
  { type: "food", category: "basic", title: "Еда", description: "Спокойно и регулярно покушать", times: ["09:00", "14:00", "19:00"], days: [0, 1, 2, 3, 4, 5, 6], enabled: true },
  { type: "rest", category: "basic", title: "Отдых", description: "Ненадолго остановиться и выдохнуть", times: ["13:00", "17:00"], days: [0, 1, 2, 3, 4, 5, 6], enabled: true },
  { type: "teeth", category: "hygiene", title: "Почистить зубы", description: "Утром и перед сном", times: ["08:00", "22:00"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "shower", category: "hygiene", title: "Сходить в душ", description: "В удобное для тебя время", times: ["20:30"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "hands", category: "hygiene", title: "Помыть руки", description: "После улицы и перед едой", times: ["13:00", "19:00"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "face", category: "hygiene", title: "Умыться", description: "Мягкий уход утром и вечером", times: ["08:10", "22:10"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "floss", category: "hygiene", title: "Зубная нить", description: "Небольшой вечерний ритуал", times: ["21:50"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "clothes", category: "hygiene", title: "Сменить нижнее бельё", description: "Чистая одежда на каждый день", times: ["08:20"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "towel", category: "hygiene", title: "Сменить полотенце", description: "Еженедельное напоминание", times: ["11:00"], days: [6], enabled: false },
  { type: "linen", category: "hygiene", title: "Сменить постельное бельё", description: "Выбери удобный день недели", times: ["11:30"], days: [0], enabled: false },
  { type: "nails", category: "hygiene", title: "Уход за ногтями", description: "Без строгого расписания", times: ["18:00"], days: [0], enabled: false },
  { type: "walk", category: "weight", title: "Немного пройтись", description: "Помогу не забыть немного прогуляться", times: ["18:30"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "sleep", category: "weight", title: "Подготовиться ко сну", description: "Напомню спокойно завершить день", times: ["22:30"], days: [0, 1, 2, 3, 4, 5, 6], enabled: false },
  { type: "exercise", category: "weight", title: "Сделать упражнение", description: "", times: ["18:00"], days: [1, 3, 5], enabled: false },
];

const ACTIVE_REMINDER_TYPES = DEFAULT_REMINDERS.map(function (item) { return item.type; });

function setup() {
  const db = getDatabase_();
  return "База готова: " + db.getUrl();
}

function doGet() {
  return json_({ ok: true, app: APP_NAME, status: "ready" });
}

function doPost(e) {
  try {
    ROW_CACHE_ = {};
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    if (action === "startOtp") return json_(startOtp_(body));
    if (action === "verifyOtp") return json_(verifyOtp_(body));
    if (action === "loginPassword") return json_(loginPassword_(body));
    if (action === "me") return json_(me_(body));
    if (action === "logout") return json_(logout_(body));

    const email = requireUser_(body.token);
    if (action === "setPassword") return json_(setPassword_(email, body));
    if (action === "getData") return json_(getData_(email));
    if (action === "toggle") return json_(toggleReminder_(email, body));
    if (action === "times") return json_(updateTimes_(email, body));
    if (action === "reminder") return json_(updateReminder_(email, body));
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
  const mode = body.mode === "signup" ? "signup" : "login";
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Проверь адрес почты");

  const existingProfile = findBy_("Profiles", "email", email);
  if (mode === "signup" && existingProfile) throw new Error("Аккаунт с этой почтой уже есть. Нажми «У меня уже есть аккаунт»");
  if (mode === "login" && !existingProfile) throw new Error("Аккаунт с такой почтой не найден");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = Date.now();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyy-MM-dd");
    const previous = findBy_("Otps", "email", email);
    if (previous && Number(previous.resendAfter) > now) throw new Error("Новый код можно запросить чуть позже");
    const sentCount = previous && previous.sentDate === today ? Number(previous.sentCount || 0) + 1 : 1;
    if (sentCount > OTP_DAILY_LIMIT) throw new Error("На эту почту сегодня отправлено слишком много кодов");
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Лимит писем Google на сегодня закончился. Попробуй завтра");

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
      mode: mode,
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
    const mode = row.mode === "signup" ? "signup" : "login";
    let profile = findBy_("Profiles", "email", email);
    if (mode === "login" && !profile) throw new Error("Аккаунт с такой почтой не найден");
    if (!profile) profile = ensureUser_(email);
    const token = createSession_(email);
    deleteBy_("Otps", "email", email);
    cleanupSessions_();
    return { ok: true, token: token, user: userFromProfile_(profile) };
  } finally {
    lock.releaseLock();
  }
}

function loginPassword_(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !password) throw new Error("Проверь почту и пароль");
  const profile = findBy_("Profiles", "email", email);
  if (!profile || !profile.passwordHash || !profile.passwordSalt) throw new Error("Для этого аккаунта пароль ещё не создан. Войди по коду из письма");
  if (Number(profile.passwordLockedUntil || 0) > Date.now()) throw new Error("Слишком много попыток. Попробуй через 15 минут или войди по коду");

  const matches = secureEqual_(String(profile.passwordHash), passwordHash_(email, password, String(profile.passwordSalt)));
  if (!matches) {
    const attempts = Number(profile.passwordFailedAttempts || 0) + 1;
    updateBy_("Profiles", "email", email, {
      passwordFailedAttempts: attempts >= PASSWORD_MAX_ATTEMPTS ? 0 : attempts,
      passwordLockedUntil: attempts >= PASSWORD_MAX_ATTEMPTS ? Date.now() + PASSWORD_LOCK_MINUTES * 60000 : "",
      updatedAt: new Date().toISOString(),
    });
    if (attempts >= PASSWORD_MAX_ATTEMPTS) throw new Error("Слишком много попыток. Вход по паролю заблокирован на 15 минут");
    throw new Error("Неверная почта или пароль");
  }

  updateBy_("Profiles", "email", email, { passwordFailedAttempts: 0, passwordLockedUntil: "", updatedAt: new Date().toISOString() });
  const token = createSession_(email);
  cleanupSessions_();
  return { ok: true, token: token, user: userFromProfile_(profile) };
}

function setPassword_(email, body) {
  const password = String(body.password || "");
  if (password.length < 8 || password.length > 64) throw new Error("Пароль должен содержать от 8 до 64 символов");
  const salt = Utilities.getUuid().replace(/-/g, "");
  updateBy_("Profiles", "email", email, {
    passwordHash: passwordHash_(email, password, salt),
    passwordSalt: salt,
    passwordFailedAttempts: 0,
    passwordLockedUntil: "",
    passwordUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

function createSession_(email) {
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const tokenHash = hash_(token);
  append_("Sessions", {
    tokenHash: tokenHash,
    email: email,
    expiresAt: Date.now() + SESSION_DAYS * 86400000,
    createdAt: new Date().toISOString(),
  });
  CacheService.getScriptCache().put("session-" + tokenHash, email, 21600);
  return token;
}

function me_(body) {
  const email = requireUser_(body.token);
  return { ok: true, user: userFromProfile_(ensureUser_(email)) };
}

function logout_(body) {
  const token = String(body.token || "");
  if (token) {
    const tokenHash = hash_(token);
    CacheService.getScriptCache().remove("session-" + tokenHash);
    deleteBy_("Sessions", "tokenHash", tokenHash);
  }
  return { ok: true };
}

function getData_(email) {
  const profile = ensureUser_(email);
  const reminders = rows_("Reminders").filter(function (row) {
    return row.ownerEmail === email && ACTIVE_REMINDER_TYPES.indexOf(String(row.type)) >= 0;
  }).map(function (row) {
    const template = reminderTemplate_(row.type);
    return {
      id: row.id, type: row.type, category: row.category || template.category || "basic", title: row.title,
      description: row.description || template.description || "", times: safeJson_(row.timesJson, []),
      days: safeJson_(row.daysJson, [0, 1, 2, 3, 4, 5, 6]), enabled: asBool_(row.enabled),
    };
  });
  const weekAgo = Date.now() - 8 * 86400000;
  const checkins = rows_("Checkins").filter(function (row) {
    return row.ownerEmail === email && new Date(row.completedAt).getTime() >= weekAgo;
  }).sort(function (a, b) { return String(b.completedAt).localeCompare(String(a.completedAt)); }).slice(0, 500);
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

function updateReminder_(email, body) {
  const row = ownedReminder_(email, body.id);
  const times = Array.isArray(body.times) ? body.times.map(String).filter(function (value, index, values) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && values.indexOf(value) === index;
  }).sort().slice(0, 10) : safeJson_(row.timesJson, ["09:00"]);
  const days = Array.isArray(body.days) ? body.days.map(Number).filter(function (value, index, values) {
    return value >= 0 && value <= 6 && values.indexOf(value) === index;
  }).sort() : safeJson_(row.daysJson, [0, 1, 2, 3, 4, 5, 6]);
  if (!times.length) throw new Error("Добавь хотя бы одно время");
  if (!days.length) throw new Error("Выбери хотя бы один день");
  const updates = { enabled: body.enabled === true, timesJson: JSON.stringify(times), daysJson: JSON.stringify(days), updatedAt: new Date().toISOString() };
  if (String(row.type) === "exercise") {
    const exercise = String(body.description || "").trim().slice(0, 60);
    updates.description = exercise;
  }
  updateBy_("Reminders", "id", row.id, updates);
  return { ok: true };
}

function addCheckin_(email, body) {
  const type = String(body.type || "");
  if (!rows_("Reminders").some(function (row) { return row.ownerEmail === email && row.type === type; })) throw new Error("Неизвестный тип");
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
  delete ROW_CACHE_.Checkins;
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
  delete ROW_CACHE_.Checkins;
  return { ok: true, deleted: matches.length };
}

function updateProfile_(email, body) {
  const displayName = String(body.displayName || "").trim().slice(0, 40);
  const requestedGoal = String(body.goal || "all");
  const goal = ["basic", "hygiene", "weight", "all"].indexOf(requestedGoal) >= 0 ? requestedGoal : "all";
  const current = findBy_("Profiles", "email", email);
  const requestedAvatar = String(body.avatarId || (current && current.avatarId) || "classic");
  const avatarId = ["classic", "dusty-red", "dreamcicle", "dandelion", "spring-green", "blue-lagoon", "plum-purple", "raspberry", "candy-floss", "blue-hawaii"].indexOf(requestedAvatar) >= 0 ? requestedAvatar : "classic";
  if (!displayName) throw new Error("Введи имя");
  const update = { displayName: displayName, goal: goal, avatarId: avatarId, updatedAt: new Date().toISOString() };
  if (body.onboardingCompleted === true) update.onboardingCompleted = true;
  if (body.notificationsEnabled === true) update.notificationsEnabled = true;
  updateBy_("Profiles", "email", email, update);
  if (body.onboardingCompleted === true) applyOnboardingGoal_(email, goal);
  return { ok: true };
}

function applyOnboardingGoal_(email, goal) {
  const starterTypes = {
    basic: ["water", "food", "rest"],
    hygiene: ["teeth", "shower", "face"],
    weight: ["walk", "sleep"],
    all: ["water", "food", "rest", "teeth", "shower", "face", "walk", "sleep"],
  };
  const enabledTypes = starterTypes[goal] || starterTypes.all;
  const enabledColumn = TABLES.Reminders.indexOf("enabled") + 1;
  const updatedColumn = TABLES.Reminders.indexOf("updatedAt") + 1;
  const now = new Date().toISOString();
  const reminderSheet = sheet_("Reminders");
  const userRows = rows_("Reminders").filter(function (row) { return row.ownerEmail === email; });
  const enabledCells = userRows.filter(function (row) { return enabledTypes.indexOf(String(row.type)) >= 0; })
    .map(function (row) { return reminderSheet.getRange(row._row, enabledColumn).getA1Notation(); });
  const disabledCells = userRows.filter(function (row) { return enabledTypes.indexOf(String(row.type)) < 0; })
    .map(function (row) { return reminderSheet.getRange(row._row, enabledColumn).getA1Notation(); });
  const updatedCells = userRows.map(function (row) { return reminderSheet.getRange(row._row, updatedColumn).getA1Notation(); });
  if (enabledCells.length) reminderSheet.getRangeList(enabledCells).setValue(true);
  if (disabledCells.length) reminderSheet.getRangeList(disabledCells).setValue(false);
  if (updatedCells.length) reminderSheet.getRangeList(updatedCells).setValue(now);
  delete ROW_CACHE_.Reminders;
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
      passwordHash: "",
      passwordSalt: "",
      passwordFailedAttempts: 0,
      passwordLockedUntil: "",
      passwordUpdatedAt: "",
    };
    append_("Profiles", profile);
  }
  const existingTypes = rows_("Reminders").filter(function (row) { return row.ownerEmail === email; }).map(function (row) { return String(row.type); });
  DEFAULT_REMINDERS.forEach(function (item) {
    if (existingTypes.indexOf(item.type) === -1) {
      append_("Reminders", {
        id: Utilities.getUuid(), ownerEmail: email, type: item.type, category: item.category, title: item.title, description: item.description,
        timesJson: JSON.stringify(item.times), daysJson: JSON.stringify(item.days), enabled: item.enabled,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
  });
  return profile;
}

function reminderTemplate_(type) {
  return DEFAULT_REMINDERS.find(function (item) { return item.type === String(type || ""); }) || {};
}

function requireUser_(token) {
  const value = String(token || "");
  if (!value) throw new Error("Нужно войти");
  const tokenHash = hash_(value);
  const cache = CacheService.getScriptCache();
  const cachedEmail = cache.get("session-" + tokenHash);
  if (cachedEmail) return cachedEmail;
  const session = findBy_("Sessions", "tokenHash", tokenHash);
  if (!session || Number(session.expiresAt) < Date.now()) throw new Error("Сессия закончилась. Войди снова");
  const cacheSeconds = Math.max(1, Math.min(21600, Math.floor((Number(session.expiresAt) - Date.now()) / 1000)));
  cache.put("session-" + tokenHash, String(session.email), cacheSeconds);
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
  return { email: profile.email, displayName: profile.displayName, fullName: null, hasPassword: Boolean(profile.passwordHash) };
}

function getDatabase_() {
  if (DB_CACHE_) return DB_CACHE_;
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("DB_SPREADSHEET_ID");
  let db;
  if (!id) {
    db = SpreadsheetApp.create(APP_NAME + " — база");
    props.setProperty("DB_SPREADSHEET_ID", db.getId());
  } else {
    db = SpreadsheetApp.openById(id);
  }
  const needsMigration = props.getProperty("DB_SCHEMA_VERSION") !== DB_SCHEMA_VERSION;
  Object.keys(TABLES).forEach(function (name) {
    let sheet = db.getSheetByName(name);
    if (!sheet) sheet = db.insertSheet(name);
    ensureSheetSchema_(sheet, name, needsMigration);
  });
  props.setProperty("DB_SCHEMA_VERSION", DB_SCHEMA_VERSION);
  const first = db.getSheetByName("Sheet1") || db.getSheetByName("Лист1");
  if (first && Object.keys(TABLES).indexOf(first.getName()) === -1 && db.getSheets().length > Object.keys(TABLES).length) db.deleteSheet(first);
  DB_CACHE_ = db;
  return DB_CACHE_;
}

function ensureSheetSchema_(sheet, name, forceNormalize) {
  const desiredHeaders = TABLES[name];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) { return String(value).trim(); });
  const sameOrder = currentHeaders.length === desiredHeaders.length && desiredHeaders.every(function (header, index) {
    return currentHeaders[index] === header;
  });
  if (sameOrder && !forceNormalize) return;

  const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues() : [];
  const objects = values.filter(function (row) {
    return row.some(function (cell) { return cell !== ""; });
  }).map(function (row) {
    const object = {};
    currentHeaders.forEach(function (header, index) {
      if (header) object[header] = row[index];
    });
    return name === "Reminders" ? repairReminderRow_(object) : object;
  });

  const normalizedRows = objects.map(function (object) {
    return desiredHeaders.map(function (header) { return object[header] === undefined ? "" : object[header]; });
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
  if (normalizedRows.length) sheet.getRange(2, 1, normalizedRows.length, desiredHeaders.length).setValues(normalizedRows);
}

function repairReminderRow_(row) {
  const template = reminderTemplate_(row.type);
  const categories = ["basic", "hygiene", "weight"];
  const corruptNewRow = categories.indexOf(String(row.title || "")) >= 0 &&
    template.title && String(row.timesJson || "") === template.title &&
    isJsonArray_(row.createdAt) && isJsonArray_(row.updatedAt);

  if (corruptNewRow) {
    row = {
      id: row.id,
      ownerEmail: row.ownerEmail,
      type: row.type,
      category: row.title,
      title: row.timesJson,
      description: row.enabled,
      timesJson: row.createdAt,
      daysJson: row.updatedAt,
      enabled: asBool_(row.category),
      createdAt: row.description,
      updatedAt: row.daysJson,
    };
  }

  if (template.type) {
    row.category = template.category;
    row.title = template.title;
    if (template.type !== "exercise") row.description = template.description;
    if (!isJsonArray_(row.timesJson)) row.timesJson = JSON.stringify(template.times);
    if (!isJsonArray_(row.daysJson)) row.daysJson = JSON.stringify(template.days);
    row.enabled = asBool_(row.enabled);
  }
  return row;
}

function isJsonArray_(value) {
  try { return Array.isArray(JSON.parse(String(value))); } catch (error) { return false; }
}

function sheet_(name) {
  if (SHEET_CACHE_[name]) return SHEET_CACHE_[name];
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error("Не найдена таблица " + name);
  SHEET_CACHE_[name] = sheet;
  return SHEET_CACHE_[name];
}

function rows_(name) {
  if (ROW_CACHE_[name]) return ROW_CACHE_[name];
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    ROW_CACHE_[name] = [];
    return ROW_CACHE_[name];
  }
  const headers = values[0];
  ROW_CACHE_[name] = values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row, index) {
    const object = { _row: index + 2 };
    headers.forEach(function (header, cell) { object[header] = row[cell]; });
    return object;
  });
  return ROW_CACHE_[name];
}

function findBy_(name, key, value) {
  return rows_(name).find(function (row) { return String(row[key]) === String(value); }) || null;
}

function append_(name, object) {
  const headers = TABLES[name];
  sheet_(name).appendRow(headers.map(function (key) { return object[key] === undefined ? "" : object[key]; }));
  delete ROW_CACHE_[name];
}

function upsert_(name, key, value, object) {
  const existing = findBy_(name, key, value);
  if (existing) updateBy_(name, key, value, object); else append_(name, object);
}

function updateBy_(name, key, value, updates) {
  const row = findBy_(name, key, value);
  if (!row) throw new Error("Запись не найдена");
  const headers = TABLES[name];
  const range = sheet_(name).getRange(row._row, 1, 1, headers.length);
  const values = range.getValues()[0];
  headers.forEach(function (header, index) { if (updates[header] !== undefined) values[index] = updates[header]; });
  range.setValues([values]);
  delete ROW_CACHE_[name];
}

function deleteBy_(name, key, value) {
  const sheet = sheet_(name);
  const matches = rows_(name).filter(function (row) { return String(row[key]) === String(value); }).sort(function (a, b) { return b._row - a._row; });
  matches.forEach(function (row) { sheet.deleteRow(row._row); });
  delete ROW_CACHE_[name];
}

function cleanupSessions_() {
  const sheet = sheet_("Sessions");
  rows_("Sessions").filter(function (row) { return Number(row.expiresAt) < Date.now(); }).sort(function (a, b) { return b._row - a._row; }).forEach(function (row) { sheet.deleteRow(row._row); });
  delete ROW_CACHE_.Sessions;
}

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function (byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function passwordHash_(email, password, salt) {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty("PASSWORD_PEPPER");
  if (!pepper) {
    pepper = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("PASSWORD_PEPPER", pepper);
  }
  let value = String(email) + ":" + String(salt) + ":" + String(password) + ":" + pepper;
  for (let index = 0; index < PASSWORD_ROUNDS; index += 1) value = hash_(value + ":" + salt + ":" + index);
  return value;
}

function secureEqual_(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
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
