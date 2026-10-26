import type { ClockFormat, DateStyle } from "./time";

export type ThemeId = "midnight" | "graphite" | "aurora" | "oled";
export type GradientId = "midnight" | "dusk" | "deep-sea" | "ember";
export type BackgroundKind = "gradient" | "aurora" | "image";

export interface AppTarget {
  /** Android package name, e.g. found with `adb shell pm list packages` or Settings → Apps → Detect. */
  packageName: string;
  /** Optional launchable activity. Empty = the app's own TV/launcher entry point. */
  activity: string;
}

export interface Settings {
  version: 1;
  theme: ThemeId;
  background: { kind: BackgroundKind; gradient: GradientId; imageUrl: string; dim: number };
  display: { scale: number };
  greeting: { enabled: boolean; name: string };
  clock: { format: ClockFormat; seconds: boolean; dateStyle: DateStyle };
  goodbye: { message: string; subtitle: string; durationMs: number; tvStandby: boolean };
  apps: { viu: AppTarget; youtube: AppTarget };
  roku: { ip: string; fireStickInput: number };
  ps5: { hdmiInput: number; ip: string; credential: string; wake: boolean; switchInput: boolean };
  ai: {
    provider: "demo" | "openai";
    baseUrl: string;
    model: string;
    apiKey: string;
    speakReplies: boolean;
  };
  startup: { animate: boolean; startScreen: "home" | "assistant" };
  hardwareMode: "auto" | "simulated";
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "midnight",
  background: { kind: "aurora", gradient: "midnight", imageUrl: "", dim: 35 },
  display: { scale: 1 },
  greeting: { enabled: true, name: "" },
  clock: { format: "12h", seconds: false, dateStyle: "long" },
  goodbye: { message: "Goodbye.", subtitle: "See you later.", durationMs: 4200, tvStandby: true },
  apps: {
    // VIU's package name is deliberately empty: it must be read from the Fire Stick
    // (Settings → Applications → Detect installed apps), not guessed.
    viu: { packageName: "", activity: "" },
    // The Fire TV YouTube app. Detection on the device confirms or replaces this.
    youtube: { packageName: "com.amazon.firetv.youtube", activity: "" },
  },
  roku: { ip: "", fireStickInput: 1 },
  ps5: { hdmiInput: 2, ip: "", credential: "", wake: true, switchInput: true },
  ai: { provider: "demo", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: "", speakReplies: false },
  startup: { animate: true, startScreen: "home" },
  hardwareMode: "auto",
};

export const STORAGE_KEY = "grantos.settings.v1";

const THEMES: ThemeId[] = ["midnight", "graphite", "aurora", "oled"];
const GRADIENTS: GradientId[] = ["midnight", "dusk", "deep-sea", "ember"];
const BACKGROUNDS: BackgroundKind[] = ["gradient", "aurora", "image"];

const str = (v: unknown, d: string, max = 500) => (typeof v === "string" ? v.slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const oneOf = <T extends string>(v: unknown, options: readonly T[], d: T): T =>
  options.includes(v as T) ? (v as T) : d;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function app(v: unknown, d: AppTarget): AppTarget {
  const o = obj(v);
  return { packageName: str(o.packageName, d.packageName, 200).trim(), activity: str(o.activity, d.activity, 300).trim() };
}

/** Accepts anything (old versions, hand-edited JSON) and returns a complete, valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = obj(raw);
  const bg = obj(r.background), disp = obj(r.display), gr = obj(r.greeting), ck = obj(r.clock), gb = obj(r.goodbye);
  const apps = obj(r.apps), roku = obj(r.roku), ps5 = obj(r.ps5), ai = obj(r.ai), st = obj(r.startup);
  return {
    version: 1,
    theme: oneOf(r.theme, THEMES, d.theme),
    background: {
      kind: oneOf(bg.kind, BACKGROUNDS, d.background.kind),
      gradient: oneOf(bg.gradient, GRADIENTS, d.background.gradient),
      imageUrl: str(bg.imageUrl, d.background.imageUrl, 2000).trim(),
      dim: num(bg.dim, d.background.dim, 0, 80),
    },
    display: { scale: num(disp.scale, d.display.scale, 0.8, 1.2) },
    greeting: { enabled: bool(gr.enabled, d.greeting.enabled), name: str(gr.name, d.greeting.name, 40) },
    clock: {
      format: oneOf(ck.format, ["12h", "24h"] as const, d.clock.format),
      seconds: bool(ck.seconds, d.clock.seconds),
      dateStyle: oneOf(ck.dateStyle, ["long", "short", "off"] as const, d.clock.dateStyle),
    },
    goodbye: {
      message: str(gb.message, d.goodbye.message, 60) || d.goodbye.message,
      subtitle: str(gb.subtitle, d.goodbye.subtitle, 80),
      durationMs: num(gb.durationMs, d.goodbye.durationMs, 2000, 10000),
      tvStandby: bool(gb.tvStandby, d.goodbye.tvStandby),
    },
    apps: { viu: app(apps.viu, d.apps.viu), youtube: app(apps.youtube, d.apps.youtube) },
    roku: { ip: str(roku.ip, d.roku.ip, 64).trim(), fireStickInput: Math.round(num(roku.fireStickInput, d.roku.fireStickInput, 1, 4)) },
    ps5: {
      hdmiInput: Math.round(num(ps5.hdmiInput, d.ps5.hdmiInput, 1, 4)),
      ip: str(ps5.ip, d.ps5.ip, 64).trim(),
      credential: str(ps5.credential, d.ps5.credential, 200).trim(),
      wake: bool(ps5.wake, d.ps5.wake),
      switchInput: bool(ps5.switchInput, d.ps5.switchInput),
    },
    ai: {
      provider: oneOf(ai.provider, ["demo", "openai"] as const, d.ai.provider),
      baseUrl: str(ai.baseUrl, d.ai.baseUrl, 300).trim() || d.ai.baseUrl,
      model: str(ai.model, d.ai.model, 100).trim() || d.ai.model,
      apiKey: str(ai.apiKey, d.ai.apiKey, 300).trim(),
      speakReplies: bool(ai.speakReplies, d.ai.speakReplies),
    },
    startup: {
      animate: bool(st.animate, d.startup.animate),
      startScreen: oneOf(st.startScreen, ["home", "assistant"] as const, d.startup.startScreen),
    },
    hardwareMode: oneOf(r.hardwareMode, ["auto", "simulated"] as const, d.hardwareMode),
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeSettings({});
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    return Boolean(storage);
  } catch {
    return false;
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Valid IPv4 address (the Roku and PS5 should have DHCP reservations on the router). */
export const isIPv4 = (s: string) =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split(".").every((p) => Number(p) <= 255);
