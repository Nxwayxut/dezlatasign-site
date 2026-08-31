import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BarChart3, Bell, Check, CheckCircle2, ChevronRight, Clock3, Delete,
  Download, Home, LoaderCircle, LogOut, Moon, MoreVertical, Pencil, Plus, Save,
  Share2, ShieldCheck, Smartphone, SquarePlus, Sun, Trash2, Undo2, UserRound, X,
} from "lucide-react";

type User = { displayName: string; email: string; fullName: string | null };
type ReminderType = "water" | "food" | "rest";
type Reminder = { id: string; type: ReminderType; title: string; times: string[]; enabled: boolean };
type Checkin = { id: string; type: ReminderType; completedAt: string };
type Profile = { email: string; displayName: string; goal: string; notificationsEnabled: boolean; onboardingCompleted: boolean };
type AppData = { profile: Profile; reminders: Reminder[]; checkins: Checkin[] };
type Tab = "today" | "history" | "stats" | "profile";
type Theme = "light" | "dark";
type AuthMode = "signup" | "login";
type InstallOS = "ios" | "android";
type InstallBrowser = "safari" | "chrome" | "yandex" | "mi";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const META = {
  water: { title: "Вода", text: "Напомню не забыть про воду", color: "blue" },
  food: { title: "Еда", text: "Напомню хорошо покушать", color: "orange" },
  rest: { title: "Отдых", text: "Напомню немного выдохнуть", color: "yellow" },
} as const;

const HEALTHY_TIMES: Record<ReminderType, string[]> = {
  water: ["09:00", "12:00", "15:00", "18:00", "21:00"],
  food: ["09:00", "14:00", "19:00"],
  rest: ["13:00", "17:00"],
};

const API_URL = import.meta.env.VITE_API_URL || "https://script.google.com/macros/s/AKfycbxy_PDrNcLIGU05xQJMLB-XEXbtL6vY4NVj8ANHV79sLlwb98TKjOVsSU5U_NYcY1Y/exec";
const TOKEN_KEY = "ne-zabyvay-session";
const THEME_KEY = "ne-zabyvay-theme";
const INSTALL_GUIDE_KEY = "ne-zabyvay-install-guide-seen";
const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

class ApiError extends Error {}

async function backend(body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new ApiError("Сервис кодов пока не отвечает. Попробуй ещё раз через минуту");
    }
    if (!response.ok || payload.ok === false) throw new ApiError(String(payload.error || "Не удалось связаться с базой"));
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function CareIcon({ type, className = "" }: { type: ReminderType | "heart"; className?: string }) {
  const source = type === "heart" ? asset("design-about.png") : asset("design-main.png");
  return <span className={`design-care-icon ${type} ${className}`} aria-hidden="true"><img src={source} alt="" /></span>;
}

function DesignPenguin({ variant }: { variant: "main" | "account" | "email" }) {
  const source = variant === "account" ? asset("design-register.png") : variant === "email" ? asset("design-email.png") : asset("design-main.png");
  return <div className={`design-penguin design-penguin-${variant}`} aria-hidden="true">
    {variant !== "main" && <img className="penguin-original" src={source} alt="" />}
    <img className="penguin-transparent" src={asset("penguin-transparent.png")} alt="" />
  </div>;
}

async function api(body?: Record<string, unknown>) {
  const token = localStorage.getItem(TOKEN_KEY);
  return backend({ action: body?.action || "getData", token, ...body });
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" className={`toggle-switch ${checked ? "checked" : ""}`} aria-pressed={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

export function SelfCareApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setAuthReady(true); return; }
    backend({ action: "me", token })
      .then((payload) => { if (active) setUser((payload.user as User | undefined) || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => active && setAuthReady(true));
    return () => { active = false; };
  }, []);

  if (!authReady) return <main className="app-stage"><section className="phone-shell loading"><LoaderCircle className="spin" /><p>Подключаю аккаунт…</p></section></main>;
  if (!user) return <Welcome onSignedIn={setUser} />;
  return <SignedInApp user={user} theme={theme} setTheme={setTheme} onSignOut={async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    if (token) backend({ action: "logout", token }).catch(() => undefined);
  }} />;
}

function Welcome({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [step, setStep] = useState<"welcome" | "account" | "email" | "confirm">("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!seconds) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const sendCode = async () => {
    setBusy(true); setMessage("");
    try {
      const payload = await backend({ action: "startOtp", email, mode: authMode });
      setOtp(""); setSeconds(Number(payload.resendAfter) || 45); setStep("confirm");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не получилось отправить код. Попробуй ещё раз");
    } finally { setBusy(false); }
  };

  const verifyCode = async (code = otp) => {
    if (code.length !== 4 || busy) return;
    setBusy(true); setMessage("");
    try {
      const payload = await backend({ action: "verifyOtp", email, code, mode: authMode });
      if (!payload.user || !payload.token) throw new ApiError("Не получилось проверить код");
      localStorage.setItem(TOKEN_KEY, String(payload.token));
      onSignedIn(payload.user as User);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Код не подошёл. Проверь цифры");
      setOtp("");
    } finally { setBusy(false); }
  };

  const pressKey = (key: string) => {
    if (busy) return;
    setMessage("");
    if (key === "delete") { setOtp((value) => value.slice(0, -1)); return; }
    setOtp((value) => {
      if (value.length >= 4) return value;
      const next = `${value}${key}`;
      if (next.length === 4) window.setTimeout(() => verifyCode(next), 120);
      return next;
    });
  };

  return (
    <main className="app-stage">
      <section className="phone-shell welcome-shell">
        {step === "welcome" && <>
          <header className="welcome-header">
            <h1>Не забывай <span>о себе</span></h1>
            <p>Дела всегда найдутся. А я напомню попить воды, поесть и немного отдохнуть.</p>
          </header>
          <div className="promise-list">
            {(["water", "food", "rest"] as ReminderType[]).map((type) => {
              const item = META[type];
              return <div className="promise-card" key={type}>
                <CareIcon type={type} />
                <div><strong>{item.title}</strong><span>{item.text}</span></div>
              </div>;
            })}
          </div>
          <DesignPenguin variant="main" />
          <button className="primary-button welcome-start" onClick={() => { setAuthMode("signup"); setStep("account"); }}>Начать</button>
          <button className="text-button" onClick={() => { setAuthMode("login"); setStep("email"); }}>У меня уже есть аккаунт</button>
        </>}

        {step === "account" && <>
          <DesignPenguin variant="account" />
          <header className="account-copy">
            <h1>Создаём твой <span>аккаунт</span></h1>
            <p>Чтобы я запомнил тебя</p>
          </header>
          <button className="primary-button auth-button" onClick={() => setStep("email")}>Продолжить с почтой</button>
          <div className="legal-note">Продолжая, ты принимаешь <a href={asset("terms.html")}>условия использования</a> и <a href={asset("privacy.html")}>политику конфиденциальности</a></div>
          {message && <p className="auth-note">{message}</p>}
        </>}

        {step === "email" && <div className="auth-screen email-screen">
          <header className="auth-screen-copy">
            {authMode === "signup" ? <>
              <h1>Введи свою <span>почту</span></h1>
              <p>На неё я отправлю код для подтверждения</p>
            </> : <>
              <h1>Войди в <span>аккаунт</span></h1>
              <p>Введи почту — я отправлю код для входа</p>
            </>}
          </header>
          <label className="email-field">
            <span className="sr-only">Электронная почта</span>
            <input type="email" inputMode="email" enterKeyHint="next" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@mail.ru" />
          </label>
          <button className="primary-button" disabled={!/^\S+@\S+\.\S+$/.test(email) || busy} onClick={sendCode}>{busy ? "Отправляю…" : "Продолжить"}</button>
          {message && <p className="auth-note">{message}</p>}
          <DesignPenguin variant="email" />
        </div>}

        {step === "confirm" && <div className="auth-screen confirm-screen">
          <header className="auth-screen-copy">
            <h1><span>Почти</span> готово!</h1>
            <p>Я отправил <strong>код</strong><br />на {email}</p>
          </header>
          <div className="otp-preview" aria-label="Четырёхзначный код">
            {[0, 1, 2, 3].map((index) => <span className={otp[index] ? "filled" : ""} key={index}>{otp[index] || ""}</span>)}
          </div>
          <div className="resend-row">Отправить код повторно <button disabled={seconds > 0 || busy} onClick={sendCode}>{seconds > 0 ? `00:${String(seconds).padStart(2, "0")}` : "сейчас"}</button></div>
          {message && <p className="auth-note">{message}</p>}
          <div className="number-keypad" aria-label="Цифровая клавиатура">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((number) => <button key={number} onClick={() => pressKey(number)}>{number}</button>)}
            <i aria-hidden="true" />
            <button onClick={() => pressKey("0")}>0</button>
            <button className="delete-key" onClick={() => pressKey("delete")} aria-label="Удалить цифру"><Delete /></button>
          </div>
          {busy && <div className="code-busy"><LoaderCircle className="spin" /> Проверяю код…</div>}
        </div>}
      </section>
    </main>
  );
}

function SignedInApp({ user, theme, setTheme, onSignOut }: { user: User; theme: Theme; setTheme: (theme: Theme) => void; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<AppData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(() => localStorage.getItem(INSTALL_GUIDE_KEY) !== "yes");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const load = useCallback(async () => {
    try { setData(await api() as unknown as AppData); setLoadError(false); }
    catch { setLoadError(true); setMessage("Не удалось загрузить данные. Попробуй ещё раз."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    navigator.serviceWorker?.register(asset("sw.js")).catch(() => undefined);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    return () => window.removeEventListener("beforeinstallprompt", rememberPrompt);
  }, []);

  useEffect(() => {
    if (!data || typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      data.reminders.filter((item) => item.enabled && item.times.includes(time)).forEach((item) => {
        const key = `${item.id}-${now.toDateString()}-${time}`;
        if (localStorage.getItem("last-care-notification") === key) return;
        navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({
          type: "SHOW_REMINDER", title: META[item.type].title, body: META[item.type].text, tag: key,
        }));
        localStorage.setItem("last-care-notification", key);
      });
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [data]);

  const post = async (body: Record<string, unknown>, success?: string, refresh = true) => {
    setSaving(true); setMessage("");
    try { await api(body); if (refresh) await load(); if (success) setMessage(success); }
    catch { setMessage("Что-то не сохранилось. Попробуй ещё раз."); }
    finally { setSaving(false); }
  };

  if (!data && loadError) return <main className="app-stage"><section className="phone-shell loading error-loading"><img src={asset("penguin-transparent.png")} alt="Пингвин" width={180} height={180} /><h1>Не получилось загрузить</h1><p>Связь с базой прервалась. Нажми кнопку — я попробую ещё раз.</p><button className="primary-button" onClick={load}>Повторить</button></section></main>;
  if (!data) return <main className="app-stage"><section className="phone-shell loading"><LoaderCircle className="spin" /><p>Пингвин вспоминает расписание…</p></section></main>;

  if (!data.profile.onboardingCompleted) {
    return <RegistrationFinish
      data={data}
      saving={saving}
      post={post}
    />;
  }

  if (showInstallGuide) {
    return <main className="app-stage"><section className="phone-shell app-shell">
      <InstallGuide
        installPrompt={installPrompt}
        onClose={() => {
          localStorage.setItem(INSTALL_GUIDE_KEY, "yes");
          setShowInstallGuide(false);
        }}
      />
    </section></main>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayCheckins = data.checkins.filter((item) => item.completedAt.startsWith(today));

  return <main className="app-stage">
    <section className="phone-shell app-shell">
      <div className="app-scroll">
        {message && <div className="toast-message">{message}</div>}
        {tab === "today" && <TodayView data={data} setData={setData} todayCheckins={todayCheckins} />}
        {tab === "history" && <HistoryView checkins={data.checkins} setData={setData} />}
        {tab === "stats" && <StatsView checkins={data.checkins} />}
        {tab === "profile" && <ProfileView data={data} setData={setData} user={user} saving={saving} post={post} theme={theme} setTheme={setTheme} onOpenInstall={() => setShowInstallGuide(true)} onSignOut={onSignOut} />}
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </section>
  </main>;
}

const INSTALL_STEPS: Record<InstallOS, Partial<Record<InstallBrowser, Array<{ title: string; text: string; icon: "share" | "menu" | "add" | "done" }>>>> = {
  ios: {
    safari: [
      { title: "Нажми «Поделиться»", text: "Квадрат со стрелкой находится внизу Safari.", icon: "share" },
      { title: "Выбери «На экран Домой»", text: "Если пункта не видно — немного пролистай меню вниз.", icon: "add" },
      { title: "Нажми «Добавить»", text: "Иконка «Не забывай» появится рядом с приложениями.", icon: "done" },
    ],
    chrome: [
      { title: "Нажми «Поделиться»", text: "Значок находится справа в адресной строке или в меню.", icon: "share" },
      { title: "Выбери «На экран Домой»", text: "На некоторых версиях iOS сначала нужно открыть ссылку в Safari.", icon: "add" },
      { title: "Подтверди добавление", text: "После этого приложение откроется без вкладок браузера.", icon: "done" },
    ],
    yandex: [
      { title: "Открой меню браузера", text: "Нажми кнопку меню рядом с адресной строкой.", icon: "menu" },
      { title: "Нажми «Поделиться»", text: "Затем выбери «На экран Домой». Если пункта нет — открой сайт в Safari.", icon: "share" },
      { title: "Нажми «Добавить»", text: "Готовая иконка появится на домашнем экране.", icon: "done" },
    ],
  },
  android: {
    chrome: [
      { title: "Открой меню ⋮", text: "Три точки находятся справа сверху в Chrome.", icon: "menu" },
      { title: "Выбери установку", text: "Нажми «Установить приложение» или «Добавить на главный экран».", icon: "add" },
      { title: "Нажми «Установить»", text: "«Не забывай» появится среди остальных приложений.", icon: "done" },
    ],
    yandex: [
      { title: "Открой меню", text: "Нажми кнопку меню справа от адресной строки.", icon: "menu" },
      { title: "Выбери «Добавить ярлык»", text: "Затем нажми «На главный экран».", icon: "add" },
      { title: "Подтверди", text: "Иконка приложения появится на домашнем экране.", icon: "done" },
    ],
    mi: [
      { title: "Открой меню", text: "Нажми значок меню в нижней части Mi Browser.", icon: "menu" },
      { title: "Выбери «Добавить на экран»", text: "Название пункта может быть «Add to Home screen».", icon: "add" },
      { title: "Нажми «Добавить»", text: "Ярлык появится на свободном месте домашнего экрана.", icon: "done" },
    ],
  },
};

function InstallStepIcon({ name }: { name: "share" | "menu" | "add" | "done" }) {
  if (name === "share") return <Share2 />;
  if (name === "menu") return <MoreVertical />;
  if (name === "add") return <SquarePlus />;
  return <CheckCircle2 />;
}

function InstallGuide({ installPrompt, onClose }: { installPrompt: InstallPromptEvent | null; onClose: () => void }) {
  const detectedOS: InstallOS = /android/i.test(navigator.userAgent) ? "android" : "ios";
  const detectedBrowser: InstallBrowser = /miuibrowser/i.test(navigator.userAgent)
    ? "mi"
    : /yabrowser/i.test(navigator.userAgent)
      ? "yandex"
      : /crios|chrome/i.test(navigator.userAgent)
        ? "chrome"
        : "safari";
  const [os, setOS] = useState<InstallOS>(detectedOS);
  const availableBrowsers = os === "ios"
    ? [{ id: "safari" as const, label: "Safari" }, { id: "chrome" as const, label: "Chrome" }, { id: "yandex" as const, label: "Яндекс" }]
    : [{ id: "chrome" as const, label: "Chrome" }, { id: "yandex" as const, label: "Яндекс" }, { id: "mi" as const, label: "Mi Browser" }];
  const initialBrowser = availableBrowsers.some((item) => item.id === detectedBrowser) ? detectedBrowser : availableBrowsers[0].id;
  const [browser, setBrowser] = useState<InstallBrowser>(initialBrowser);
  const steps = INSTALL_STEPS[os][browser] || INSTALL_STEPS[os][availableBrowsers[0].id] || [];

  const chooseOS = (nextOS: InstallOS) => {
    setOS(nextOS);
    setBrowser(nextOS === "ios" ? "safari" : "chrome");
  };

  const startInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") onClose();
  };

  return <div className="install-guide">
    <header className="install-header">
      <button type="button" className="install-back" onClick={onClose} aria-label="Закрыть инструкцию"><ArrowLeft /></button>
      <div className="install-penguin"><img src={asset("penguin-transparent.png")} alt="Пингвин" /></div>
      <p>Всегда под рукой</p>
      <h1><span>Добавь</span> на экран</h1>
      <small>Так «Не забывай» будет открываться как обычное приложение.</small>
    </header>

    {installPrompt && <button type="button" className="primary-button quick-install" onClick={startInstall}><Download /> Установить автоматически</button>}

    <div className="install-tabs" aria-label="Выбор устройства">
      <button className={os === "ios" ? "active" : ""} onClick={() => chooseOS("ios")}>iPhone</button>
      <button className={os === "android" ? "active" : ""} onClick={() => chooseOS("android")}>Android</button>
    </div>
    <div className="browser-tabs" aria-label="Выбор браузера">
      {availableBrowsers.map((item) => <button key={item.id} className={browser === item.id ? "active" : ""} onClick={() => setBrowser(item.id)}>{item.label}</button>)}
    </div>

    <div className="install-steps">
      {steps.map((step, index) => <article key={`${browser}-${step.title}`}>
        <div className="install-step-picture"><span>{index + 1}</span><InstallStepIcon name={step.icon} /></div>
        <div><h2>{step.title}</h2><p>{step.text}</p></div>
      </article>)}
    </div>
    <button type="button" className="primary-button install-finish" onClick={onClose}>Понятно</button>
  </div>;
}

function RegistrationFinish({ data, saving, post }: {
  data: AppData;
  saving: boolean;
  post: (body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  const [name, setName] = useState(data.profile.displayName);
  const [goal, setGoal] = useState(data.profile.goal || "all");

  const choices: Array<{ id: ReminderType | "all"; label: string }> = [
    { id: "water", label: "Пить больше воды" },
    { id: "food", label: "Регулярно кушать" },
    { id: "rest", label: "Больше отдыхать" },
    { id: "all", label: "Всё и сразу" },
  ];

  return <main className="app-stage"><section className="phone-shell welcome-shell about-shell">
    <header className="about-copy"><h1><span>Расскажи</span> о себе!</h1></header>
    <label className="about-name">Как к тебе обращаться?<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Твоё имя" maxLength={40} /></label>
    <h2>Твоя цель</h2>
    <div className="goal-list">{choices.map((choice) => <button key={choice.id} className={goal === choice.id ? "selected" : ""} onClick={() => setGoal(choice.id)}>
      <CareIcon type={choice.id === "all" ? "heart" : choice.id} /><span>{choice.label}</span>{goal === choice.id && <Check />}
    </button>)}</div>
    <button className="primary-button about-continue" disabled={!name.trim() || saving} onClick={() => post({ action: "profile", displayName: name, goal, onboardingCompleted: true }, "Профиль готов")}>{saving ? "Сохраняю…" : "Продолжить"}</button>
  </section></main>;
}

function TodayView({ data, setData, todayCheckins }: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData | null>>;
  todayCheckins: Checkin[];
}) {
  const [savingTimes, setSavingTimes] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [draftReminders, setDraftReminders] = useState<Reminder[]>(data.reminders);
  const [checkinMessage, setCheckinMessage] = useState("");
  const visibleReminders = isEditing ? draftReminders : data.reminders;
  const total = data.reminders.filter((item) => item.enabled).reduce((sum, item) => sum + item.times.length, 0);
  const progress = total ? Math.min(100, Math.round(todayCheckins.length / total * 100)) : 0;
  const updateReminder = (id: string, update: Partial<Reminder>) => setDraftReminders((current) =>
    current.map((reminder) => reminder.id === id ? { ...reminder, ...update } : reminder));
  const saveTimes = (item: Reminder, times: string[]) => {
    updateReminder(item.id, { times: times.slice(0, 10) });
    setEditMessage("");
  };
  const reminderWord = (count: number) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    if (mod100 >= 11 && mod100 <= 14) return "напоминаний";
    if (mod10 === 1) return "напоминание";
    if (mod10 >= 2 && mod10 <= 4) return "напоминания";
    return "напоминаний";
  };
  const nextTime = (times: string[]) => {
    const occupied = new Set(times);
    const last = times[times.length - 1] || "07:00";
    const match = /^(\d{2}):(\d{2})$/.exec(last);
    let minutes = match ? Number(match[1]) * 60 + Number(match[2]) + 120 : 540;
    for (let index = 0; index < 48; index += 1) {
      minutes %= 1440;
      const candidate = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      if (!occupied.has(candidate)) return candidate;
      minutes += 30;
    }
    return "09:00";
  };
  const beginEditing = () => {
    setDraftReminders(data.reminders.map((item) => ({ ...item, times: [...item.times] })));
    setEditMessage("");
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setDraftReminders(data.reminders.map((item) => ({ ...item, times: [...item.times] })));
    setEditMessage("");
    setIsEditing(false);
  };
  const persistChanges = async () => {
    setSavingTimes(true);
    setEditMessage("");
    try {
      const requests: Array<Promise<Record<string, unknown>>> = [];
      const cleaned = draftReminders.map((item) => {
        const clean = [...new Set(item.times.filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort().slice(0, 10);
        return { ...item, times: clean.length ? clean : ["09:00"] };
      });
      cleaned.forEach((item) => {
        const original = data.reminders.find((value) => value.id === item.id);
        if (!original) return;
        if (original.enabled !== item.enabled) requests.push(api({ action: "toggle", id: item.id, enabled: item.enabled }));
        if (JSON.stringify(original.times) !== JSON.stringify(item.times)) requests.push(api({ action: "times", id: item.id, times: item.times }));
      });
      await Promise.all(requests);
      setData((current) => current ? { ...current, reminders: cleaned } : current);
      setDraftReminders(cleaned);
      setIsEditing(false);
      setEditMessage(requests.length ? "Изменения сохранены" : "Изменений не было");
    } catch {
      setEditMessage("Не получилось сохранить. Попробуй ещё раз");
    } finally {
      setSavingTimes(false);
    }
  };
  const markNow = (item: Reminder) => {
    const checkin = { id: crypto.randomUUID(), type: item.type, completedAt: new Date().toISOString() };
    setData((current) => current ? { ...current, checkins: [checkin, ...current.checkins] } : current);
    setCheckinMessage("");
    void api({ action: "checkin", type: item.type, id: checkin.id }).catch(() => {
      setData((current) => current ? { ...current, checkins: current.checkins.filter((value) => value.id !== checkin.id) } : current);
      setCheckinMessage("Отметка не сохранилась. Попробуй ещё раз");
    });
  };
  const undoLastCheckin = (type: ReminderType) => {
    const checkin = todayCheckins.find((item) => item.type === type);
    if (!checkin) return;
    setData((current) => current ? { ...current, checkins: current.checkins.filter((item) => item.id !== checkin.id) } : current);
    setCheckinMessage("");
    void api({ action: "deleteCheckin", id: checkin.id }).catch(() => {
      setData((current) => current ? { ...current, checkins: [checkin, ...current.checkins].sort((a, b) => b.completedAt.localeCompare(a.completedAt)) } : current);
      setCheckinMessage("Не получилось отменить отметку");
    });
  };
  return <div className="screen">
    <header className="screen-header greeting">
      <div><p>Сегодня</p><h1>Привет, {data.profile.displayName}!</h1></div>
      <div className="mini-penguin"><img src={asset("penguin-transparent.png")} alt="" /></div>
    </header>
    <section className="progress-card">
      <div><strong>{todayCheckins.length} из {total}</strong><span>маленьких забот выполнено</span></div>
      <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div>
    </section>
    <div className="reminder-heading"><h2 className="section-title">Напоминания</h2>
      {!isEditing && <button type="button" className="edit-reminders" onClick={beginEditing}><Pencil /> <span>Редактировать</span></button>}
    </div>
    {editMessage && <p className={`edit-status ${editMessage.startsWith("Не получилось") ? "error" : ""}`}>{editMessage}</p>}
    {checkinMessage && <p className="edit-status error">{checkinMessage}</p>}
    <div className="reminder-stack">
      {visibleReminders.map((item) => {
        const done = todayCheckins.filter((checkin) => checkin.type === item.type).length;
        return <article className={`reminder-card ${!item.enabled ? "disabled" : ""}`} key={item.id}>
          <CareIcon type={item.type} />
          <div className="reminder-body">
            <div className="reminder-top"><div><h3>{item.title}</h3><p>{item.times.length} {reminderWord(item.times.length)} в день</p></div>
              {isEditing
                ? <ToggleSwitch checked={item.enabled} label={`Включить ${item.title}`} onChange={(enabled) => updateReminder(item.id, { enabled })} />
                : <span className={`reminder-state ${item.enabled ? "on" : ""}`}>{item.enabled ? "Включено" : "Выключено"}</span>}
            </div>
            {isEditing ? <>
              <div className="time-row editable-times">{item.times.map((time, index) => <span className="time-control" key={`${item.id}-${index}`}>
                <input type="time" aria-label={`Время напоминания ${index + 1}`} value={time} onChange={(event) => saveTimes(item, item.times.map((value, position) => position === index ? event.target.value : value))} />
                <button type="button" disabled={item.times.length <= 1} aria-label={`Удалить время ${time}`} onClick={() => saveTimes(item, item.times.filter((_, position) => position !== index))}><X /></button>
              </span>)}</div>
              {item.times.length < 10 && <button className="add-time" type="button" onClick={() => saveTimes(item, [...item.times, nextTime(item.times)])}><Plus /> Добавить время <small>{item.times.length}/10</small></button>}
              <button className="healthy-schedule" onClick={() => saveTimes(item, HEALTHY_TIMES[item.type])}>Предложить здоровый график</button>
            </> : <div className="time-row saved-times">{item.times.map((time) => <span key={`${item.id}-${time}`}>{time}</span>)}</div>}
            {!isEditing && <div className="check-actions">
              <button className="check-button" disabled={!item.enabled} onClick={() => markNow(item)}><Check /> Отметить сейчас {done > 0 && <b>{done}</b>}</button>
              {done > 0 && <button className="undo-check-button" type="button" aria-label={`Отменить последнюю отметку: ${item.title}`} onClick={() => undoLastCheckin(item.type)}><Undo2 /></button>}
            </div>}
          </div>
        </article>;
      })}
    </div>
    {isEditing && <div className="edit-actions">
      <button type="button" className="cancel-edit" disabled={savingTimes} onClick={cancelEditing}>Отмена</button>
      <button className="primary-button reminder-save" disabled={savingTimes} onClick={persistChanges}>{savingTimes ? "Сохраняю…" : "Сохранить"}</button>
    </div>}
  </div>;
}

function HistoryView({ checkins, setData }: { checkins: Checkin[]; setData: React.Dispatch<React.SetStateAction<AppData | null>> }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const todayIds = checkins.filter((item) => item.completedAt.startsWith(today)).map((item) => item.id);
  const groups = useMemo(() => {
    const map = new Map<string, Checkin[]>();
    checkins.forEach((item) => {
      const key = new Date(item.completedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      map.set(key, [...(map.get(key) || []), item]);
    });
    return [...map.entries()];
  }, [checkins]);
  const removeCheckins = async (ids: string[]) => {
    if (!ids.length) return;
    const removed = checkins.filter((item) => ids.includes(item.id));
    setData((current) => current ? { ...current, checkins: current.checkins.filter((item) => !ids.includes(item.id)) } : current);
    setHistoryMessage("");
    setConfirmClear(false);
    try {
      await api({ action: "deleteCheckins", ids });
    } catch {
      setData((current) => current ? {
        ...current,
        checkins: [...current.checkins, ...removed.filter((item) => !current.checkins.some((value) => value.id === item.id))].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
      } : current);
      setHistoryMessage("Не получилось удалить отметки");
    }
  };
  return <div className="screen"><header className="screen-header history-header"><div><p>Твои маленькие победы</p><h1>История</h1></div>
    {!!todayIds.length && <button type="button" onClick={() => setConfirmClear(true)}>Очистить сегодня</button>}
  </header>
    {historyMessage && <p className="edit-status error">{historyMessage}</p>}
    {confirmClear && <div className="clear-confirm"><p>Удалить все отметки за сегодня?</p><div><button type="button" onClick={() => setConfirmClear(false)}>Оставить</button><button type="button" onClick={() => void removeCheckins(todayIds)}>Удалить</button></div></div>}
    {!groups.length ? <EmptyState text="Здесь появятся отметки о воде, еде и отдыхе." /> : groups.map(([date, items]) => <section className="history-day" key={date}>
      <h2>{date}</h2>{items.map((item) => { const meta = META[item.type]; return <div className="history-item" key={item.id}><CareIcon type={item.type} className="tiny-icon" /><div><strong>{meta.title}</strong><span>{new Date(item.completedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div><button type="button" className="history-delete" aria-label={`Удалить отметку: ${meta.title}`} onClick={() => void removeCheckins([item.id])}><Trash2 /></button></div>; })}
    </section>)}
  </div>;
}

function StatsView({ checkins }: { checkins: Checkin[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { label: date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", ""), count: checkins.filter((item) => item.completedAt.startsWith(key)).length };
  });
  const max = Math.max(1, ...days.map((day) => day.count));
  const careWord = (count: number) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    if (mod100 >= 11 && mod100 <= 14) return "забот";
    if (mod10 === 1) return "забота";
    if (mod10 >= 2 && mod10 <= 4) return "заботы";
    return "забот";
  };
  return <div className="screen"><header className="screen-header"><p>Без гонки за идеалом</p><h1>Статистика</h1></header>
    <section className="stat-hero"><CareIcon type="heart" /><strong>{checkins.length}</strong><span>{careWord(checkins.length)} о себе за 7 дней</span></section>
    <section className="chart-card"><h2>Неделя</h2><div className="bars">{days.map((day) => <div className="bar-column" key={day.label}><div className="bar-track"><div className="bar" style={{ height: `${Math.max(8, day.count / max * 100)}%` }}><span>{day.count || ""}</span></div></div><b>{day.label}</b></div>)}</div></section>
    <div className="stat-grid">{(["water", "food", "rest"] as ReminderType[]).map((type) => { const meta = META[type]; const count = checkins.filter((item) => item.type === type).length; return <article key={type}><CareIcon type={type} className="tiny-icon" /><strong>{count}</strong><span>{meta.title}</span></article>; })}</div>
  </div>;
}

function ProfileView({ data, setData, user, saving, post, theme, setTheme, onOpenInstall, onSignOut }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData | null>>; user: User; saving: boolean; post: (body: Record<string, unknown>, success?: string, refresh?: boolean) => Promise<void>; theme: Theme; setTheme: (theme: Theme) => void; onOpenInstall: () => void; onSignOut: () => void }) {
  const [name, setName] = useState(data.profile.displayName);
  const [goal, setGoal] = useState(data.profile.goal);
  const notificationStatus = typeof window !== "undefined" && "Notification" in window
    ? Notification.permission === "granted" ? "Разрешены" : "Нажми, чтобы включить"
    : "Сначала добавь приложение на экран";
  const enableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "SHOW_REMINDER", title: "Ура, всё работает!", body: "Теперь я смогу мягко напоминать о заботе", tag: "welcome-notification" });
    await post({ action: "profile", displayName: name, goal }, "Уведомления включены", false);
  };
  const saveProfile = () => {
    setData((current) => current ? { ...current, profile: { ...current.profile, displayName: name, goal } } : current);
    void post({ action: "profile", displayName: name, goal }, "Профиль сохранён", false);
  };
  return <div className="screen"><header className="screen-header profile-head"><div className="profile-avatar"><UserRound /></div><div><p>{user.email}</p><h1>{name}</h1></div></header>
    <section className="settings-card"><label>Как к тебе обращаться?<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></label>
      <label>Главная цель<select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="all">Всё и сразу</option><option value="water">Пить больше воды</option><option value="food">Регулярно кушать</option><option value="rest">Больше отдыхать</option></select></label>
      <button className="primary-button save-button" disabled={saving} onClick={saveProfile}><Save /> Сохранить</button>
    </section>
    <section className="settings-list">
      <div className="settings-row">{theme === "dark" ? <Moon /> : <Sun />}<span><strong>Тёмная тема</strong><small>{theme === "dark" ? "Включена" : "Выключена"}</small></span><ToggleSwitch checked={theme === "dark"} label="Переключить тему" onChange={(dark) => setTheme(dark ? "dark" : "light")} /></div>
      <button onClick={onOpenInstall}><Smartphone /><span><strong>Добавить на экран</strong><small>Инструкция для iPhone и Android</small></span><ChevronRight /></button>
      <button onClick={enableNotifications}><Bell /><span><strong>Уведомления</strong><small>{notificationStatus}</small></span><ChevronRight /></button>
      <a href={asset("privacy.html")}><ShieldCheck /><span><strong>Конфиденциальность</strong><small>Как хранятся данные</small></span><ChevronRight /></a>
      <button onClick={onSignOut}><LogOut /><span><strong>Выйти</strong><small>Данные останутся сохранены</small></span><ChevronRight /></button>
    </section>
  </div>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-penguin"><img src={asset("penguin-transparent.png")} alt="" width={190} height={190} /></div><h2>Пока тихо</h2><p>{text}</p></div>; }

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items = [
    { id: "today" as const, label: "Сегодня", Icon: Home }, { id: "history" as const, label: "История", Icon: Clock3 },
    { id: "stats" as const, label: "Статистика", Icon: BarChart3 }, { id: "profile" as const, label: "Профиль", Icon: UserRound },
  ];
  return <nav className="bottom-nav" aria-label="Основная навигация">{items.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><item.Icon /><span>{item.label}</span></button>)}</nav>;
}
