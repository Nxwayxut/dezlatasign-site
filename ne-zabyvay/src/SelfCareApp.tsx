import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BarChart3, Bell, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, Delete, Download, Eye, EyeOff,
  Home, LayoutGrid, LoaderCircle, LogOut, Moon,
  MoreVertical, Pencil, Plus, Save, Share2,
  ShieldCheck, Smartphone, SquarePlus, Sun,
  Trash2, Undo2, UserRound, X,
} from "lucide-react";

type User = { displayName: string; email: string; fullName: string | null; hasPassword: boolean };
type BasicReminderType = "water" | "food" | "rest";
type HygieneReminderType = "teeth" | "shower" | "hands" | "face" | "floss" | "clothes" | "towel" | "linen" | "nails";
type WeightReminderType = "walk" | "sleep" | "exercise";
type ReminderType = BasicReminderType | HygieneReminderType | WeightReminderType;
type ReminderCategory = "basic" | "hygiene" | "weight";
type Reminder = { id: string; type: ReminderType; category: ReminderCategory; title: string; description: string; times: string[]; days: number[]; enabled: boolean };
type Checkin = { id: string; type: ReminderType; completedAt: string };
type Profile = { email: string; displayName: string; goal: string; notificationsEnabled: boolean; onboardingCompleted: boolean; avatarId: AvatarId };
type AppData = { profile: Profile; reminders: Reminder[]; checkins: Checkin[] };
type Tab = "today" | "care" | "history" | "stats" | "profile";
type Theme = "light" | "dark";
type AuthMode = "signup" | "login";
type InstallOS = "ios" | "android";
type InstallBrowser = "safari" | "chrome" | "yandex" | "mi";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const AVATARS = [
  { id: "classic", label: "Классический", color: "#241A14" },
  { id: "dusty-red", label: "Пыльная роза", color: "#F4607B" },
  { id: "dreamcicle", label: "Персиковый", color: "#F99E85" },
  { id: "dandelion", label: "Одуванчик", color: "#F6D781" },
  { id: "spring-green", label: "Весенний", color: "#78C681" },
  { id: "blue-lagoon", label: "Лагуна", color: "#5A9AD6" },
  { id: "plum-purple", label: "Сливовый", color: "#594EAD" },
  { id: "raspberry", label: "Малиновый", color: "#FF3197" },
  { id: "candy-floss", label: "Сладкая вата", color: "#FF99DF" },
  { id: "blue-hawaii", label: "Голубой", color: "#6CEBEF" },
] as const;
type AvatarId = typeof AVATARS[number]["id"];

function avatarById(value?: string) {
  return AVATARS.find((avatar) => avatar.id === value) || AVATARS[0];
}

const META: Record<BasicReminderType, { title: string; text: string; color: string }> = {
  water: { title: "Вода", text: "Напомню не забыть про воду", color: "blue" },
  food: { title: "Еда", text: "Напомню хорошо покушать", color: "orange" },
  rest: { title: "Отдых", text: "Напомню немного выдохнуть", color: "yellow" },
} as const;

const REMINDER_COPY: Record<ReminderType, { title: string; text: string; category: ReminderCategory }> = {
  water: { title: "Вода", text: "Не забыть сделать пару глотков", category: "basic" },
  food: { title: "Еда", text: "Спокойно и регулярно покушать", category: "basic" },
  rest: { title: "Отдых", text: "Ненадолго остановиться и выдохнуть", category: "basic" },
  teeth: { title: "Почистить зубы", text: "Утром и перед сном", category: "hygiene" },
  shower: { title: "Сходить в душ", text: "В удобное для тебя время", category: "hygiene" },
  hands: { title: "Помыть руки", text: "После улицы и перед едой", category: "hygiene" },
  face: { title: "Умыться", text: "Мягкий уход утром и вечером", category: "hygiene" },
  floss: { title: "Зубная нить", text: "Небольшой вечерний ритуал", category: "hygiene" },
  clothes: { title: "Сменить нижнее бельё", text: "Чистая одежда на каждый день", category: "hygiene" },
  towel: { title: "Сменить полотенце", text: "Еженедельное напоминание", category: "hygiene" },
  linen: { title: "Сменить постельное бельё", text: "Выбери удобный день недели", category: "hygiene" },
  nails: { title: "Уход за ногтями", text: "Без строгого расписания", category: "hygiene" },
  walk: { title: "Немного пройтись", text: "Помогу не забыть немного прогуляться", category: "weight" },
  sleep: { title: "Подготовиться ко сну", text: "Напомню спокойно завершить день", category: "weight" },
  exercise: { title: "Сделать упражнение", text: "Выбери упражнение, которое подходит тебе", category: "weight" },
};

const ACTIVE_REMINDER_TYPES = new Set<ReminderType>([
  "water", "food", "rest", "teeth", "shower", "hands", "face", "floss", "clothes", "towel", "linen", "nails", "walk", "sleep", "exercise",
]);

const WEEKDAYS = [
  { id: 1, short: "Пн" }, { id: 2, short: "Вт" }, { id: 3, short: "Ср" },
  { id: 4, short: "Чт" }, { id: 5, short: "Пт" }, { id: 6, short: "Сб" }, { id: 0, short: "Вс" },
];

const isBasicType = (type: ReminderType): type is BasicReminderType => type === "water" || type === "food" || type === "rest";
const reminderInfo = (reminder: Reminder) => {
  if (reminder.type === "exercise") {
    const exercise = reminder.description.trim();
    return {
      title: exercise ? `Упражнение: ${exercise}` : REMINDER_COPY.exercise.title,
      text: exercise ? `Напоминаю выполнить упражнение: ${exercise}` : REMINDER_COPY.exercise.text,
      category: "weight" as const,
    };
  }
  return REMINDER_COPY[reminder.type] || { title: reminder.title, text: reminder.description, category: reminder.category };
};

const API_URL = import.meta.env.VITE_API_URL || "https://script.google.com/macros/s/AKfycbxy_PDrNcLIGU05xQJMLB-XEXbtL6vY4NVj8ANHV79sLlwb98TKjOVsSU5U_NYcY1Y/exec";
const TOKEN_KEY = "ne-zabyvay-session";
const THEME_KEY = "ne-zabyvay-theme";
const INSTALL_GUIDE_KEY = "ne-zabyvay-install-guide-seen";
const USER_CACHE_KEY = "ne-zabyvay-user-cache";
const DATA_CACHE_KEY = "ne-zabyvay-data-cache";
const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

function readCache<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || "null") as T | null; }
  catch { return null; }
}

function normalizeGoal(value?: string) {
  if (value === "basic" || value === "hygiene" || value === "weight" || value === "all") return value;
  if (value === "water" || value === "food" || value === "rest") return "basic";
  return "all";
}

function localDateKey(value: Date | string | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

class ApiError extends Error {}

async function backend(body: Record<string, unknown>, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("База отвечает слишком долго. Подожди немного и попробуй ещё раз");
    }
    if (error instanceof TypeError) {
      throw new ApiError("Не удалось связаться с базой. Проверь интернет и попробуй ещё раз");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function HabitGlyph({ type }: { type: Exclude<ReminderType, BasicReminderType> }) {
  if (type === "teeth" || type === "floss") return <svg viewBox="0 0 64 64"><path d="M18 9c7-3 11 2 14 2s7-5 14-2c8 4 7 15 4 23-3 9-5 23-11 23-5 0-3-14-7-14s-2 14-7 14c-6 0-8-14-11-23-3-8-4-19 4-23Z" /></svg>;
  if (type === "shower") return <svg viewBox="0 0 64 64"><path d="M13 29h31c0-9-7-16-16-16S13 20 13 29Zm9 6c3 0 3 5 0 9-3-4-3-9 0-9Zm11 0c3 0 3 5 0 9-3-4-3-9 0-9Zm11 0c3 0 3 5 0 9-3-4-3-9 0-9ZM25 8h7v8h-7z" /></svg>;
  if (type === "hands") return <svg viewBox="0 0 64 64"><path d="M17 31V13a4 4 0 0 1 8 0v11h1V9a4 4 0 0 1 8 0v15h1V12a4 4 0 0 1 8 0v14h1v-8a4 4 0 0 1 8 0v17c0 13-8 21-20 21-11 0-20-7-23-18-2-7 6-10 10-4l5 6V31h-7Z" /></svg>;
  if (type === "face" || type === "nails") return <svg viewBox="0 0 64 64"><path d="m32 5 5 16 16 5-16 5-5 16-5-16-16-5 16-5 5-16Zm19 32 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" /></svg>;
  if (type === "clothes") return <svg viewBox="0 0 64 64"><path d="m22 8 10 6 10-6 14 9-8 13-6-4v30H22V26l-6 4-8-13 14-9Z" /></svg>;
  if (type === "towel") return <svg viewBox="0 0 64 64"><rect x="13" y="10" width="38" height="44" rx="7" /><path className="glyph-cut" d="M19 22h26v4H19zm0 19h26v4H19z" /></svg>;
  if (type === "linen") return <svg viewBox="0 0 64 64"><path d="M9 18h8v17h38v18h-7v-6H16v6H9V18Zm12 4h16a8 8 0 0 1 8 8v2H21V22Z" /></svg>;
  if (type === "walk") return <svg viewBox="0 0 64 64"><ellipse cx="22" cy="36" rx="9" ry="15" transform="rotate(-18 22 36)" /><circle cx="12" cy="17" r="4" /><circle cx="20" cy="13" r="4" /><circle cx="29" cy="15" r="4" /><ellipse cx="44" cy="40" rx="9" ry="15" transform="rotate(18 44 40)" /><circle cx="35" cy="20" r="4" /><circle cx="44" cy="17" r="4" /><circle cx="53" cy="21" r="4" /></svg>;
  if (type === "sleep") return <svg viewBox="0 0 64 64"><path d="M49 42A23 23 0 0 1 23 12a23 23 0 1 0 26 30Z" /></svg>;
  return <svg viewBox="0 0 64 64"><path d="M8 24h8v-7h8v30h-8v-7H8V24Zm48 0v16h-8v7h-8V17h8v7h8ZM24 27h16v10H24V27Z" /></svg>;
}

function SectionGlyph({ category }: { category: ReminderCategory }) {
  if (category === "basic") return <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 55C16 44 7 35 7 23 7 13 14 7 23 7c5 0 8 2 9 6 2-4 5-6 10-6 9 0 15 6 15 16 0 12-9 21-25 32Z" />
    <path className="glyph-cut" d="M14 30h10l4-10 7 21 5-11h11v5H44l-10 17-7-21-1 4H14Z" />
  </svg>;
  if (category === "hygiene") return <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="m30 5 5 15 15 5-15 5-5 15-5-15-15-5 15-5 5-15Zm20 30 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9ZM12 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
  </svg>;
  return <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M29 8h6v8h15v6h-4l10 22H37c0-8 5-14 12-14l-4-8H35v27h10v7H19v-7h10V22H19l-4 8c7 0 12 6 12 14H8l10-22h-4v-6h15V8Z" />
  </svg>;
}

function BasicGlyph({ type }: { type: BasicReminderType | "heart" }) {
  if (type === "water") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5C25 17 15 29 15 41a17 17 0 0 0 34 0C49 29 39 17 32 5Z" /></svg>;
  if (type === "food") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 32c8-14 26-19 39-8l9-8v32l-9-8C34 51 16 46 8 32Z" /><circle className="glyph-cut" cx="24" cy="29" r="3.5" /></svg>;
  if (type === "rest") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 48a12 12 0 0 1 5-23 17 17 0 0 1 32 5 10 10 0 0 1-1 20H13v-2Z" /></svg>;
  return <SectionGlyph category="basic" />;
}

function CareIcon({ type, className = "" }: { type: ReminderType | "heart"; className?: string }) {
  if (type === "heart" || isBasicType(type)) {
    return <span className={`design-care-icon ${type} ${className}`} aria-hidden="true"><BasicGlyph type={type} /></span>;
  }
  return <span className={`habit-care-icon ${type} ${className}`} aria-hidden="true"><HabitGlyph type={type} /></span>;
}

function DesignPenguin({ variant }: { variant: "main" | "account" | "email" }) {
  const source = variant === "account" ? asset("design-register.png") : variant === "email" ? asset("design-email.png") : asset("design-main.png");
  return <div className={`design-penguin design-penguin-${variant}`} aria-hidden="true">
    {variant !== "main" && <img className="penguin-original" src={source} alt="" />}
    <img className="penguin-transparent" src={asset("penguin-transparent.png")} alt="" />
  </div>;
}

function PenguinAvatar({ avatarId, className = "", alt = "Пингвин" }: { avatarId?: string; className?: string; alt?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatar = avatarById(avatarId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      context.clearRect(0, 0, size, size);
      const cropSize = image.width * .52;
      context.drawImage(image, image.width * .24, image.height * .1, cropSize, cropSize, 0, 0, size, size);
      if (avatar.id === "classic") return;

      const pixels = context.getImageData(0, 0, size, size);
      const target = avatar.color.match(/[a-f\d]{2}/gi)?.map((part) => Number.parseInt(part, 16)) || [36, 26, 20];
      for (let index = 0; index < pixels.data.length; index += 4) {
        const pixel = index / 4;
        const x = (pixel % size) / size;
        const y = Math.floor(pixel / size) / size;
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        const alpha = pixels.data[index + 3];
        const leftEye = ((x - .267) / .145) ** 2 + ((y - .435) / .145) ** 2 < 1;
        const rightEye = ((x - .733) / .145) ** 2 + ((y - .435) / .145) ** 2 < 1;
        const bodyPixel = alpha > 10 && red < 80 && green < 68 && blue < 62 && Math.max(red, green, blue) - Math.min(red, green, blue) < 38;
        if (!bodyPixel || leftEye || rightEye) continue;
        const shade = Math.max(.72, Math.min(1.14, (red + green + blue) / 86));
        pixels.data[index] = Math.min(255, target[0] * shade);
        pixels.data[index + 1] = Math.min(255, target[1] * shade);
        pixels.data[index + 2] = Math.min(255, target[2] * shade);
      }
      context.putImageData(pixels, 0, 0);
    };
    image.src = asset("penguin-transparent.png");
    return () => { image.onload = null; };
  }, [avatar.color, avatar.id]);

  return <canvas ref={canvasRef} className={`penguin-avatar-canvas ${className}`} role="img" aria-label={alt} />;
}

async function api(body?: Record<string, unknown>) {
  const token = localStorage.getItem(TOKEN_KEY);
  return backend({ action: body?.action || "getData", token, ...body });
}

function normalizeData(payload: AppData): AppData {
  return {
    ...payload,
    reminders: (payload.reminders || []).filter((item) => ACTIVE_REMINDER_TYPES.has(item.type)).map((item) => ({
      ...item,
      category: REMINDER_COPY[item.type]?.category || (["basic", "hygiene", "weight"].includes(item.category) ? item.category : "basic"),
      title: REMINDER_COPY[item.type]?.title || item.title,
      description: item.type === "exercise" ? (item.description || "") : (REMINDER_COPY[item.type]?.text || item.description || ""),
      times: Array.isArray(item.times) && item.times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ? item.times : ["09:00"],
      days: item.days?.length ? item.days : [0, 1, 2, 3, 4, 5, 6],
    })),
    checkins: payload.checkins || [],
  };
}

function ToggleSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" disabled={disabled} className={`toggle-switch ${checked ? "checked" : ""}`} aria-pressed={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

export function SelfCareApp() {
  const [user, setUser] = useState<User | null>(() => localStorage.getItem(TOKEN_KEY) ? readCache<User>(USER_CACHE_KEY) : null);
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem(TOKEN_KEY) || Boolean(readCache<User>(USER_CACHE_KEY)));
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
    backend({ action: "me", token }, 8000)
      .then((payload) => {
        const nextUser = (payload.user as User | undefined) || null;
        if (nextUser) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
        if (active) setUser(nextUser);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "";
        const sessionEnded = message.includes("Сессия закончилась") || message.includes("Нужно войти");
        if (sessionEnded) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_CACHE_KEY);
          localStorage.removeItem(DATA_CACHE_KEY);
          if (active) setUser(null);
        }
      })
      .finally(() => active && setAuthReady(true));
    return () => { active = false; };
  }, []);

  const rememberUser = (nextUser: User) => {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  if (!authReady) return <main className="app-stage"><section className="phone-shell loading"><LoaderCircle className="spin" /><p>Подключаю аккаунт…</p></section></main>;
  if (!user) return <Welcome onSignedIn={rememberUser} />;
  return <SignedInApp user={user} theme={theme} setTheme={setTheme} onSignOut={async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem(DATA_CACHE_KEY);
    setUser(null);
    if (token) backend({ action: "logout", token }).catch(() => undefined);
  }} />;
}

function Welcome({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [step, setStep] = useState<"welcome" | "account" | "email" | "confirm" | "password">("welcome");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!seconds) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const goBack = () => {
    setMessage("");
    setOtp("");
    if (step === "account") { setStep("welcome"); return; }
    if (step === "confirm") { setStep("email"); return; }
    if (step === "password") {
      const token = localStorage.getItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      setPendingUser(null);
      setStep("email");
      if (token) void backend({ action: "logout", token }).catch(() => undefined);
      return;
    }
    setStep(authMode === "signup" ? "account" : "welcome");
  };

  const sendCode = async () => {
    setBusy(true); setMessage("");
    try {
      const payload = await backend({ action: "startOtp", email, mode: authMode });
      setOtp(""); setSeconds(Number(payload.resendAfter) || 45); setStep("confirm");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не получилось отправить код. Попробуй ещё раз");
    } finally { setBusy(false); }
  };

  const signInWithPassword = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || busy) return;
    setBusy(true); setMessage("");
    try {
      const payload = await backend({ action: "loginPassword", email, password });
      if (!payload.user || !payload.token) throw new ApiError("Не получилось войти");
      localStorage.setItem(TOKEN_KEY, String(payload.token));
      onSignedIn(payload.user as User);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не получилось войти");
    } finally { setBusy(false); }
  };

  const verifyCode = async (code = otp) => {
    if (code.length !== 4 || busy) return;
    setBusy(true); setMessage("");
    try {
      const payload = await backend({ action: "verifyOtp", email, code, mode: authMode });
      if (!payload.user || !payload.token) throw new ApiError("Не получилось проверить код");
      localStorage.setItem(TOKEN_KEY, String(payload.token));
      const verifiedUser = payload.user as User;
      if (authMode === "signup" || !verifiedUser.hasPassword) {
        setPendingUser(verifiedUser);
        setPassword("");
        setPasswordRepeat("");
        setStep("password");
      } else {
        onSignedIn(verifiedUser);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Код не подошёл. Проверь цифры");
      setOtp("");
    } finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (password.length < 8) { setMessage("Пароль должен быть не короче 8 символов"); return; }
    if (password !== passwordRepeat) { setMessage("Пароли не совпадают"); return; }
    if (!pendingUser || busy) return;
    setBusy(true); setMessage("");
    try {
      await backend({ action: "setPassword", token: localStorage.getItem(TOKEN_KEY), password });
      onSignedIn({ ...pendingUser, hasPassword: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не получилось сохранить пароль");
    } finally { setBusy(false); }
  };

  const pressKey = (key: string) => {
    if (busy) return;
    setMessage("");
    if (key === "delete") { setOtp((value) => value.slice(0, -1)); return; }
    setOtp((value) => {
      if (value.length >= 4) return value;
      const next = `${value}${key}`;
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
            {(["water", "food", "rest"] as BasicReminderType[]).map((type) => {
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
          <button type="button" className="icon-back auth-back" onClick={goBack} aria-label="Назад"><ArrowLeft /></button>
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
          <button type="button" className="icon-back auth-back" onClick={goBack} aria-label="Назад"><ArrowLeft /></button>
          <header className="auth-screen-copy">
            {authMode === "signup" ? <>
              <h1>Введи свою <span>почту</span></h1>
              <p>На неё я отправлю код для подтверждения</p>
            </> : <>
              <h1>Войди в <span>аккаунт</span></h1>
              <p>Используй пароль или код из письма</p>
            </>}
          </header>
          <label className="email-field">
            <span className="sr-only">Электронная почта</span>
            <input type="email" inputMode="email" enterKeyHint="next" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@mail.ru" />
          </label>
          {authMode === "login" && <label className="email-field password-field">
            <span className="sr-only">Пароль</span>
            <span className="password-input-wrap"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль" onKeyDown={(event) => { if (event.key === "Enter") void signInWithPassword(); }} /><button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span>
          </label>}
          {authMode === "signup"
            ? <button className="primary-button" disabled={!/^\S+@\S+\.\S+$/.test(email) || busy} onClick={sendCode}>{busy ? "Отправляю…" : "Продолжить"}</button>
            : <>
              <button className="primary-button" disabled={!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || busy} onClick={signInWithPassword}>{busy ? "Вхожу…" : "Войти по паролю"}</button>
              <div className="auth-divider"><span>или</span></div>
              <button className="secondary-button auth-code-button" disabled={!/^\S+@\S+\.\S+$/.test(email) || busy} onClick={sendCode}>Получить код на почту</button>
            </>}
          {message && <p className="auth-note">{message}</p>}
          <DesignPenguin variant="email" />
        </div>}

        {step === "confirm" && <div className="auth-screen confirm-screen">
          <button type="button" className="icon-back auth-back" onClick={goBack} aria-label="Назад"><ArrowLeft /></button>
          <header className="auth-screen-copy">
            <h1><span>Почти</span> готово!</h1>
            <p>Я отправил <strong>код</strong><br />на {email}</p>
          </header>
          <div className="otp-preview" aria-label="Четырёхзначный код">
            {[0, 1, 2, 3].map((index) => <span className={otp[index] ? "filled" : ""} key={index}>{otp[index] || ""}</span>)}
          </div>
          <button type="button" className="primary-button confirm-code-button" disabled={otp.length !== 4 || busy} onClick={() => void verifyCode()}>{busy ? "Проверяю…" : "Подтвердить"}</button>
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

        {step === "password" && <div className="auth-screen password-screen">
          <button type="button" className="icon-back auth-back" onClick={goBack} aria-label="Назад"><ArrowLeft /></button>
          <header className="auth-screen-copy">
            <h1>Придумай <span>пароль</span></h1>
            <p>Не меньше 8 символов. Он понадобится для быстрого входа.</p>
          </header>
          <label className="email-field"><span className="sr-only">Новый пароль</span><span className="password-input-wrap"><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Новый пароль" /><button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
          <label className="email-field password-repeat"><span className="sr-only">Повтори пароль</span><span className="password-input-wrap"><input type={showPasswordRepeat ? "text" : "password"} autoComplete="new-password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} placeholder="Повтори пароль" onKeyDown={(event) => { if (event.key === "Enter") void savePassword(); }} /><button type="button" aria-label={showPasswordRepeat ? "Скрыть повтор пароля" : "Показать повтор пароля"} aria-pressed={showPasswordRepeat} onClick={() => setShowPasswordRepeat((value) => !value)}>{showPasswordRepeat ? <EyeOff /> : <Eye />}</button></span></label>
          {passwordRepeat.length >= 8 && password !== passwordRepeat && <p className="password-match-error">Пароли не совпадают</p>}
          <button className="primary-button" disabled={password.length < 8 || passwordRepeat.length < 8 || password !== passwordRepeat || busy} onClick={savePassword}>{busy ? "Сохраняю…" : "Сохранить пароль"}</button>
          {message && <p className="auth-note">{message}</p>}
          <p className="password-hint">Если забудешь пароль, всегда можно войти по коду из письма.</p>
        </div>}
      </section>
    </main>
  );
}

function SignedInApp({ user, theme, setTheme, onSignOut }: { user: User; theme: Theme; setTheme: (theme: Theme) => void; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<AppData | null>(() => {
    const cached = readCache<AppData>(DATA_CACHE_KEY);
    return cached?.profile?.email === user.email ? normalizeData(cached) : null;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(() => localStorage.getItem(INSTALL_GUIDE_KEY) !== "yes");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const load = useCallback(async () => {
    try { setData(normalizeData(await api() as unknown as AppData)); setLoadError(false); }
    catch { setLoadError(true); setMessage("Не удалось загрузить данные. Попробуй ещё раз."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    navigator.serviceWorker?.register(asset("sw.js")).catch(() => undefined);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (data) localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));
  }, [data]);

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
      data.reminders.filter((item) => item.enabled && item.days.includes(now.getDay()) && item.times.includes(time)).forEach((item) => {
        const key = `${item.id}-${now.toDateString()}-${time}`;
        const storageKey = `care-notification-${key}`;
        if (localStorage.getItem(storageKey) === "sent") return;
        navigator.serviceWorker.ready.then((registration) => registration.showNotification(reminderInfo(item).title, {
          body: reminderInfo(item).text,
          tag: key,
          icon: asset("app-icon-192.png"),
          badge: asset("app-icon-192.png"),
        })).catch(() => undefined);
        localStorage.setItem(storageKey, "sent");
      });
    };
    check();
    const timer = window.setInterval(check, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [data]);

  const post = async (body: Record<string, unknown>, success?: string, refresh = true) => {
    setSaving(true); setMessage("");
    try {
      await api(body);
      if (refresh) await load();
      if (success) setMessage(success);
      return true;
    } catch {
      setMessage("Что-то не сохранилось. Попробуй ещё раз.");
      return false;
    } finally { setSaving(false); }
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

  const today = localDateKey();
  const todayCheckins = data.checkins.filter((item) => localDateKey(item.completedAt) === today);

  return <main className="app-stage">
    <section className="phone-shell app-shell">
      <div className="app-scroll">
        {message && <div className="toast-message">{message}</div>}
        {tab === "today" && <TodayView data={data} setData={setData} todayCheckins={todayCheckins} onOpenCare={() => setTab("care")} />}
        {tab === "care" && <CareSectionsView data={data} setData={setData} />}
        {tab === "history" && <HistoryView checkins={data.checkins} setData={setData} />}
        {tab === "stats" && <StatsView data={data} />}
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
  post: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(data.profile.displayName);
  const [goal, setGoal] = useState(normalizeGoal(data.profile.goal));

  const choices: Array<{ id: ReminderCategory | "all"; label: string }> = [
    { id: "basic", label: "Базовая забота" },
    { id: "hygiene", label: "Гигиена" },
    { id: "weight", label: "Активность и сон" },
    { id: "all", label: "Всё и сразу" },
  ];

  return <main className="app-stage"><section className="phone-shell welcome-shell about-shell">
    <header className="about-copy"><h1><span>Расскажи</span> о себе!</h1></header>
    <label className="about-name">Как к тебе обращаться?<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Твоё имя" maxLength={40} /></label>
    <h2>Твоя цель</h2>
    <div className="goal-list">{choices.map((choice) => <button key={choice.id} className={goal === choice.id ? "selected" : ""} onClick={() => setGoal(choice.id)}>
      {choice.id === "all" ? <CareIcon type="heart" /> : <span className={`goal-section-symbol ${choice.id}`}><SectionGlyph category={choice.id} /></span>}<span className="goal-label">{choice.label}</span>{goal === choice.id && <Check />}
    </button>)}</div>
    <button className="primary-button about-continue" disabled={!name.trim() || saving} onClick={() => post({ action: "profile", displayName: name, goal, onboardingCompleted: true }, "Профиль готов")}>{saving ? "Сохраняю…" : "Продолжить"}</button>
  </section></main>;
}

function CareSectionsView({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData | null>> }) {
  const [section, setSection] = useState<ReminderCategory | null>(null);
  const [message, setMessage] = useState("");
  const sections: Array<{ id: ReminderCategory; title: string; text: string }> = [
    { id: "basic", title: "Базовая забота", text: "Вода, еда и отдых" },
    { id: "hygiene", title: "Гигиена", text: "Ежедневные и еженедельные дела" },
    { id: "weight", title: "Активность и сон", text: "Прогулка, сон и упражнения" },
  ];

  if (section) {
    const selected = sections.find((item) => item.id === section)!;
    return <div className="screen care-screen">
      <header className="care-detail-header">
        <button type="button" onClick={() => { setSection(null); setMessage(""); }} aria-label="Назад к разделам"><ChevronLeft /></button>
        <div><p>Настрой только нужное</p><h1>{selected.title}</h1></div>
      </header>
      {message && <p className={`edit-status ${message.startsWith("Не получилось") ? "error" : ""}`}>{message}</p>}
      <ReminderCatalog category={section} data={data} setData={setData} setMessage={setMessage} />
    </div>;
  }

  return <div className="screen care-screen">
    <header className="screen-header"><p>Всё разложено по полочкам</p><h1>Разделы</h1></header>
    <p className="care-intro">Выбери, в чём тебе нужна поддержка. Остальное приложение трогать не будет. Удивительно деликатная технология.</p>
    <div className="care-section-list">{sections.map((item) => {
      const reminders = data.reminders.filter((reminder) => reminder.category === item.id);
      const enabled = reminders.filter((reminder) => reminder.enabled).length;
      return <button key={item.id} type="button" onClick={() => setSection(item.id)}>
        <span className={`section-symbol ${item.id}`}><SectionGlyph category={item.id} /></span>
        <span><strong>{item.title}</strong><small>{item.text}</small><em>{enabled ? `${enabled} включено` : "Пока выключено"}</em></span>
        <ChevronRight />
      </button>;
    })}</div>
    <div className="care-penguin-note"><img src={asset("penguin-transparent.png")} alt="" /><p>Начни с одного пункта. Пингвин переживёт, если не включить всё сразу.</p></div>
  </div>;
}

function ReminderCatalog({ category, data, setData, setMessage }: {
  category: ReminderCategory;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData | null>>;
  setMessage: (message: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const saveQueues = useRef(new Map<string, Promise<Record<string, unknown>>>());
  const saveVersions = useRef(new Map<string, number>());
  const reminders = data.reminders.filter((item) => item.category === category);
  const updateLocal = (next: Reminder) => setData((current) => current ? { ...current, reminders: current.reminders.map((item) => item.id === next.id ? next : item) } : current);
  const save = async (next: Reminder, previous: Reminder, success = "Настройка сохранена") => {
    const version = (saveVersions.current.get(next.id) || 0) + 1;
    saveVersions.current.set(next.id, version);
    setSavingIds((current) => new Set(current).add(next.id));
    updateLocal(next);
    setMessage("");
    const request = (saveQueues.current.get(next.id) || Promise.resolve({})).catch(() => ({})).then(() =>
      api({ action: "reminder", id: next.id, enabled: next.enabled, times: next.times, days: next.days, description: next.type === "exercise" ? next.description : undefined }));
    saveQueues.current.set(next.id, request);
    try {
      await request;
      if (saveVersions.current.get(next.id) === version) setMessage(success);
      return true;
    } catch {
      if (saveVersions.current.get(next.id) === version) {
        updateLocal(previous);
        setMessage("Не получилось сохранить настройку");
      }
      return false;
    } finally {
      if (saveVersions.current.get(next.id) === version) {
        saveQueues.current.delete(next.id);
        setSavingIds((current) => { const nextSet = new Set(current); nextSet.delete(next.id); return nextSet; });
      }
    }
  };
  const heading = category === "basic" ? "Твои основные напоминания" : category === "hygiene" ? "Что напоминать" : "Полезные привычки";
  return <section className="catalog-section"><div className="catalog-heading"><h2>{heading}</h2><span>до 10 времён на пункт</span></div>
    <div className="habit-list">{reminders.map((item) => <ReminderSetupCard
      key={item.id}
      reminder={item}
      expanded={expandedId === item.id}
      saving={savingIds.has(item.id)}
      onExpand={() => setExpandedId((current) => current === item.id ? null : item.id)}
      onSave={(next, previous, success) => save(next, previous, success)}
    />)}</div>
  </section>;
}

function ReminderSetupCard({ reminder, expanded, saving, onExpand, onSave }: {
  reminder: Reminder;
  expanded: boolean;
  saving: boolean;
  onExpand: () => void;
  onSave: (next: Reminder, previous: Reminder, success?: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(reminder);
  useEffect(() => setDraft(reminder), [reminder]);
  const addTime = () => {
    const used = new Set(draft.times);
    const last = draft.times[draft.times.length - 1] || "07:00";
    const [hours, minutes] = last.split(":").map(Number);
    let value = (hours * 60 + minutes + 120) % 1440;
    while (used.has(`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`)) value = (value + 30) % 1440;
    setDraft((current) => ({ ...current, times: [...current.times, `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`] }));
  };
  const daySummary = draft.days.length === 7 ? "каждый день" : WEEKDAYS.filter((day) => draft.days.includes(day.id)).map((day) => day.short).join(", ");
  return <article className={`habit-setup-card ${reminder.enabled ? "enabled" : ""}`}>
    <div className="habit-setup-top"><CareIcon type={reminder.type} /><div><h3>{reminderInfo(reminder).title}</h3><p>{reminderInfo(reminder).text}</p></div><ToggleSwitch checked={reminder.enabled} disabled={saving} label={`Включить ${reminderInfo(reminder).title}`} onChange={(enabled) => { void onSave({ ...reminder, enabled }, reminder, enabled ? "Напоминание включено" : "Напоминание выключено"); }} /></div>
    {reminder.enabled && <button type="button" className="schedule-summary" onClick={onExpand}><Clock3 /><span>{reminder.times.join(" · ")}<small>{daySummary}</small></span><ChevronRight className={expanded ? "rotated" : ""} /></button>}
    {reminder.enabled && expanded && <div className="schedule-editor">
      {reminder.type === "exercise" && <label className="exercise-name">Какое упражнение?
        <input value={draft.description} maxLength={60} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Например, приседания" />
        <small>В уведомлении появится именно это название.</small>
      </label>}
      <strong>Время</strong>
      <div className="time-row editable-times">{draft.times.map((time, index) => <span className="time-control" key={`${reminder.id}-${index}`}><input type="time" value={time} aria-label={`Время ${index + 1}`} onChange={(event) => setDraft((current) => ({ ...current, times: current.times.map((value, position) => position === index ? event.target.value : value) }))} /><button type="button" disabled={draft.times.length <= 1} aria-label={`Удалить время ${time}`} onClick={() => setDraft((current) => ({ ...current, times: current.times.filter((_, position) => position !== index) }))}><X /></button></span>)}</div>
      {draft.times.length < 10 && <button type="button" className="add-time wide" onClick={addTime}><Plus /> Добавить время <small>{draft.times.length}/10</small></button>}
      <strong>Дни</strong>
      <div className="weekday-picker">{WEEKDAYS.map((day) => <button key={day.id} type="button" disabled={draft.days.length === 1 && draft.days.includes(day.id)} aria-label={draft.days.length === 1 && draft.days.includes(day.id) ? `${day.short}: нужен хотя бы один день` : day.short} className={draft.days.includes(day.id) ? "active" : ""} onClick={() => setDraft((current) => {
        const selected = current.days.includes(day.id) ? current.days.filter((value) => value !== day.id) : [...current.days, day.id];
        return { ...current, days: selected.length ? selected : current.days };
      })}>{day.short}</button>)}</div>
      {draft.days.length === 1 && <small className="schedule-note">Оставь хотя бы один день</small>}
      <button type="button" className="save-schedule" disabled={saving} onClick={async () => { const saved = await onSave({ ...draft, description: draft.description.trim(), times: [...new Set(draft.times)].sort().slice(0, 10), days: [...draft.days].sort() }, reminder); if (saved) onExpand(); }}><Save /> {saving ? "Сохраняю…" : "Сохранить расписание"}</button>
    </div>}
  </article>;
}

function TodayView({ data, setData, todayCheckins, onOpenCare }: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData | null>>;
  todayCheckins: Checkin[];
  onOpenCare: () => void;
}) {
  const [checkinMessage, setCheckinMessage] = useState("");
  const [pendingTypes, setPendingTypes] = useState<Set<ReminderType>>(new Set());
  const scheduledToday = data.reminders.filter((item) => item.enabled && item.days.includes(new Date().getDay()));
  const total = scheduledToday.reduce((sum, item) => sum + item.times.length, 0);
  const progress = total ? Math.min(100, Math.round(todayCheckins.length / total * 100)) : 0;
  const reminderWord = (count: number) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    if (mod100 >= 11 && mod100 <= 14) return "напоминаний";
    if (mod10 === 1) return "напоминание";
    if (mod10 >= 2 && mod10 <= 4) return "напоминания";
    return "напоминаний";
  };
  const markNow = async (item: Reminder) => {
    if (pendingTypes.has(item.type)) return;
    const checkin = { id: crypto.randomUUID(), type: item.type, completedAt: new Date().toISOString() };
    setPendingTypes((current) => new Set(current).add(item.type));
    setData((current) => current ? { ...current, checkins: [checkin, ...current.checkins] } : current);
    setCheckinMessage("");
    try {
      await api({ action: "checkin", type: item.type, id: checkin.id });
    } catch {
      setData((current) => current ? { ...current, checkins: current.checkins.filter((value) => value.id !== checkin.id) } : current);
      setCheckinMessage("Отметка не сохранилась. Попробуй ещё раз");
    } finally {
      setPendingTypes((current) => { const next = new Set(current); next.delete(item.type); return next; });
    }
  };
  const undoLastCheckin = async (type: ReminderType) => {
    if (pendingTypes.has(type)) return;
    const checkin = todayCheckins.find((item) => item.type === type);
    if (!checkin) return;
    setPendingTypes((current) => new Set(current).add(type));
    setData((current) => current ? { ...current, checkins: current.checkins.filter((item) => item.id !== checkin.id) } : current);
    setCheckinMessage("");
    try {
      await api({ action: "deleteCheckin", id: checkin.id });
    } catch {
      setData((current) => current ? { ...current, checkins: [checkin, ...current.checkins].sort((a, b) => b.completedAt.localeCompare(a.completedAt)) } : current);
      setCheckinMessage("Не получилось отменить отметку");
    } finally {
      setPendingTypes((current) => { const next = new Set(current); next.delete(type); return next; });
    }
  };
  return <div className="screen">
    <header className="screen-header greeting">
      <div><p>Сегодня</p><h1>Привет, {data.profile.displayName}!</h1></div>
      <div className="mini-penguin"><PenguinAvatar avatarId={data.profile.avatarId} alt="" /></div>
    </header>
    <section className="progress-card">
      <div><strong>{todayCheckins.length} из {total}</strong><span>маленьких забот выполнено</span></div>
      <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div>
    </section>
    <div className="reminder-heading"><h2 className="section-title">Сегодня для тебя</h2>
      <button type="button" className="edit-reminders" onClick={onOpenCare}><LayoutGrid /> <span>Настроить</span></button>
    </div>
    {checkinMessage && <p className="edit-status error">{checkinMessage}</p>}
    {!scheduledToday.length && <div className="today-empty"><CareIcon type="heart" /><div><h3>Сегодня свободно</h3><p>Можно добавить нужные напоминания в разделе настроек.</p></div></div>}
    <div className="reminder-stack">
      {scheduledToday.map((item) => {
        const done = todayCheckins.filter((checkin) => checkin.type === item.type).length;
        return <article className={`reminder-card ${!item.enabled ? "disabled" : ""}`} key={item.id}>
          <CareIcon type={item.type} />
          <div className="reminder-body">
            <div className="reminder-top"><div><h3>{item.title}</h3><p>{item.times.length} {reminderWord(item.times.length)} в день</p></div>
              <span className="reminder-state on">Включено</span>
            </div>
            <div className="time-row saved-times">{item.times.map((time) => <span key={`${item.id}-${time}`}>{time}</span>)}</div>
            <div className="check-actions">
              <button className="check-button" disabled={!item.enabled || pendingTypes.has(item.type)} onClick={() => void markNow(item)}><Check /> {pendingTypes.has(item.type) ? "Сохраняю…" : "Отметить сейчас"} {done > 0 && <b>{done}</b>}</button>
              {done > 0 && <button className="undo-check-button" type="button" disabled={pendingTypes.has(item.type)} aria-label={`Отменить последнюю отметку: ${item.title}`} onClick={() => void undoLastCheckin(item.type)}><Undo2 /></button>}
            </div>
          </div>
        </article>;
      })}
    </div>
  </div>;
}

function HistoryView({ checkins, setData }: { checkins: Checkin[]; setData: React.Dispatch<React.SetStateAction<AppData | null>> }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const today = localDateKey();
  const visibleCheckins = useMemo(() => {
    const keys = new Set(Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return localDateKey(date);
    }));
    return checkins.filter((item) => keys.has(localDateKey(item.completedAt)));
  }, [checkins]);
  const todayIds = visibleCheckins.filter((item) => localDateKey(item.completedAt) === today).map((item) => item.id);
  const groups = useMemo(() => {
    const map = new Map<string, Checkin[]>();
    visibleCheckins.forEach((item) => {
      const key = new Date(item.completedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      map.set(key, [...(map.get(key) || []), item]);
    });
    return [...map.entries()];
  }, [visibleCheckins]);
  const removeCheckins = async (ids: string[]) => {
    if (!ids.length || ids.some((id) => deletingIds.has(id))) return;
    const removed = checkins.filter((item) => ids.includes(item.id));
    setDeletingIds((current) => new Set([...current, ...ids]));
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
    } finally {
      setDeletingIds((current) => { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next; });
    }
  };
  return <div className="screen"><header className="screen-header history-header"><div><p>Твои маленькие победы</p><h1>Последние 7 дней</h1></div>
    {!!todayIds.length && <button type="button" disabled={todayIds.some((id) => deletingIds.has(id))} onClick={() => setConfirmClear(true)}>Очистить сегодня</button>}
  </header>
    {historyMessage && <p className="edit-status error">{historyMessage}</p>}
    {confirmClear && <div className="clear-confirm"><p>Удалить все отметки за сегодня?</p><div><button type="button" onClick={() => setConfirmClear(false)}>Оставить</button><button type="button" onClick={() => void removeCheckins(todayIds)}>Удалить</button></div></div>}
    {!groups.length ? <EmptyState text="Здесь появятся отметки о выбранных заботах." /> : groups.map(([date, items]) => <section className="history-day" key={date}>
      <h2>{date}</h2>{items.map((item) => { const meta = REMINDER_COPY[item.type]; return <div className="history-item" key={item.id}><CareIcon type={item.type} className="tiny-icon" /><div><strong>{meta?.title || "Забота о себе"}</strong><span>{new Date(item.completedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div><button type="button" className="history-delete" disabled={deletingIds.has(item.id)} aria-label={`Удалить отметку: ${meta?.title || "забота"}`} onClick={() => void removeCheckins([item.id])}>{deletingIds.has(item.id) ? <LoaderCircle className="spin" /> : <Trash2 />}</button></div>; })}
    </section>)}
  </div>;
}

function StatsView({ data }: { data: AppData }) {
  const visibleKeys = new Set(Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return localDateKey(date);
  }));
  const checkins = data.checkins.filter((item) => visibleKeys.has(localDateKey(item.completedAt)));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return { label: date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", ""), count: checkins.filter((item) => localDateKey(item.completedAt) === key).length };
  });
  const max = Math.max(1, ...days.map((day) => day.count));
  const categoryCount = (category: ReminderCategory) => checkins.filter((checkin) => data.reminders.find((reminder) => reminder.type === checkin.type)?.category === category).length;
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
    <div className="stat-grid">{(["water", "food", "rest"] as BasicReminderType[]).map((type) => { const meta = META[type]; const count = checkins.filter((item) => item.type === type).length; return <article key={type}><CareIcon type={type} className="tiny-icon" /><strong>{count}</strong><span>{meta.title}</span></article>; })}</div>
    <h2 className="stat-section-title">По разделам</h2><div className="category-stats"><article><span className="category-stat-icon basic"><SectionGlyph category="basic" /></span><span><strong>{categoryCount("basic")}</strong><small>Базовая забота</small></span></article><article><span className="category-stat-icon hygiene"><SectionGlyph category="hygiene" /></span><span><strong>{categoryCount("hygiene")}</strong><small>Гигиена</small></span></article><article><span className="category-stat-icon weight"><SectionGlyph category="weight" /></span><span><strong>{categoryCount("weight")}</strong><small>Активность и сон</small></span></article></div>
  </div>;
}

function ProfileView({ data, setData, user, saving, post, theme, setTheme, onOpenInstall, onSignOut }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData | null>>; user: User; saving: boolean; post: (body: Record<string, unknown>, success?: string, refresh?: boolean) => Promise<boolean>; theme: Theme; setTheme: (theme: Theme) => void; onOpenInstall: () => void; onSignOut: () => void }) {
  const [name, setName] = useState(data.profile.displayName);
  const [goal, setGoal] = useState(normalizeGoal(data.profile.goal));
  const [avatarId, setAvatarId] = useState<AvatarId>(avatarById(data.profile.avatarId).id);
  const [isEditing, setIsEditing] = useState(false);
  const [notificationNote, setNotificationNote] = useState("");
  const goalLabel = goal === "basic" ? "Базовая забота" : goal === "hygiene" ? "Гигиена" : goal === "weight" ? "Активность и сон" : "Всё и сразу";
  const notificationStatus = typeof window !== "undefined" && "Notification" in window
    ? Notification.permission === "granted" ? "Включены · проверка при открытом приложении" : "Нажми, чтобы включить"
    : "Сначала добавь приложение на экран";
  const enableNotifications = async () => {
    setNotificationNote("");
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { setNotificationNote("Этот браузер не поддерживает уведомления"); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotificationNote("Разрешение не выдано в настройках браузера"); return; }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Уведомления работают", { body: "Это проверочное сообщение от «Не забывай»", tag: "notification-test", icon: asset("app-icon-192.png"), badge: asset("app-icon-192.png") });
      const saved = await post({ action: "profile", displayName: name, goal, avatarId, notificationsEnabled: true }, "Проверочное уведомление отправлено", false);
      if (!saved) return;
      setData((current) => current ? { ...current, profile: { ...current.profile, notificationsEnabled: true } } : current);
      setNotificationNote("Проверочное уведомление отправлено");
    } catch { setNotificationNote("Не получилось показать уведомление в этом браузере"); }
  };
  const chooseAvatar = (nextAvatar: AvatarId) => {
    setAvatarId(nextAvatar);
  };
  const saveProfile = async () => {
    const saved = await post({ action: "profile", displayName: name, goal, avatarId }, "Профиль сохранён", false);
    if (!saved) return;
    setData((current) => current ? { ...current, profile: { ...current.profile, displayName: name, goal, avatarId } } : current);
    setIsEditing(false);
  };
  const cancelEditing = () => {
    setName(data.profile.displayName);
    setGoal(normalizeGoal(data.profile.goal));
    setAvatarId(avatarById(data.profile.avatarId).id);
    setIsEditing(false);
  };
  return <div className="screen"><header className="screen-header profile-head"><div className="profile-avatar"><PenguinAvatar avatarId={avatarId} /></div><div className="profile-title"><p>{user.email}</p><h1>{name}</h1><span>{goalLabel}</span></div>
    {!isEditing && <button type="button" className="profile-edit-button" aria-label="Редактировать профиль" onClick={() => setIsEditing(true)}><Pencil /></button>}
  </header>
    {isEditing && <>
      <section className="avatar-card"><div className="avatar-card-title"><strong>Твой пингвин</strong><span>Выбери цвет</span></div>
        <div className="avatar-grid">{AVATARS.map((avatar) => <button type="button" key={avatar.id} className={avatarId === avatar.id ? "selected" : ""} aria-label={avatar.label} aria-pressed={avatarId === avatar.id} onClick={() => chooseAvatar(avatar.id)}><PenguinAvatar avatarId={avatar.id} alt="" />{avatarId === avatar.id && <Check />}</button>)}</div>
      </section>
      <section className="settings-card"><label>Как к тебе обращаться?<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></label>
        <label>Главная цель<select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="all">Всё и сразу</option><option value="basic">Базовая забота</option><option value="hygiene">Гигиена</option><option value="weight">Активность и сон</option></select></label>
        <div className="profile-form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={cancelEditing}>Отмена</button><button className="primary-button save-button" disabled={saving || !name.trim()} onClick={() => void saveProfile()}><Save /> Сохранить</button></div>
      </section>
    </>}
    <section className="settings-list">
      <div className="settings-row">{theme === "dark" ? <Moon /> : <Sun />}<span><strong>Тёмная тема</strong><small>{theme === "dark" ? "Включена" : "Выключена"}</small></span><ToggleSwitch checked={theme === "dark"} label="Переключить тему" onChange={(dark) => setTheme(dark ? "dark" : "light")} /></div>
      <button onClick={onOpenInstall}><Smartphone /><span><strong>Добавить на экран</strong><small>Инструкция для iPhone и Android</small></span><ChevronRight /></button>
      <button onClick={enableNotifications}><Bell /><span><strong>Уведомления</strong><small>{notificationStatus}</small></span><ChevronRight /></button>
      {notificationNote && <p className="notification-note">{notificationNote}</p>}
      <a href={asset("privacy.html")}><ShieldCheck /><span><strong>Конфиденциальность</strong><small>Как хранятся данные</small></span><ChevronRight /></a>
      <button onClick={onSignOut}><LogOut /><span><strong>Выйти</strong><small>Данные останутся сохранены</small></span><ChevronRight /></button>
    </section>
  </div>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-penguin"><img src={asset("penguin-transparent.png")} alt="" width={190} height={190} /></div><h2>Пока тихо</h2><p>{text}</p></div>; }

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items = [
    { id: "today" as const, label: "Сегодня", Icon: Home }, { id: "care" as const, label: "Разделы", Icon: LayoutGrid },
    { id: "history" as const, label: "История", Icon: Clock3 }, { id: "stats" as const, label: "Статистика", Icon: BarChart3 },
    { id: "profile" as const, label: "Профиль", Icon: UserRound },
  ];
  return <nav className="bottom-nav" aria-label="Основная навигация">{items.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><item.Icon /><span>{item.label}</span></button>)}</nav>;
}
