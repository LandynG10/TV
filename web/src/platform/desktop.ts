import type { Platform } from "./types";
import { browserListen, browserSpeak, browserStopSpeaking, browserVoiceAvailable } from "./browserSpeech";

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
};

/** `npm run dev` on a computer: LAN calls go through the Vite dev server (devserver/plugin.ts). */
export function createDesktopPlatform(): Platform {
  return {
    kind: "desktop",
    label: "Desktop preview (dev server)",
    real: { apps: false, network: true },
    listApps: async () => [],
    launchApp: async (t) => {
      console.info("[GrantOS] SIMULATED launch", t);
      return { ok: Boolean(t.packageName), simulated: true, error: t.packageName ? undefined : "No package configured" };
    },
    http: async (req) => {
      try {
        const r = await post<{ status?: number; body?: string; error?: string }>("/api/http", req);
        return { status: r.status ?? 0, body: r.body ?? "", error: r.error };
      } catch (e) {
        return { status: 0, body: "", error: String(e) };
      }
    },
    udp: async (req) => {
      try {
        const r = await post<{ reply?: string | null; error?: string }>("/api/udp", req);
        return { reply: r.reply ?? null, error: r.error };
      } catch (e) {
        return { reply: null, error: String(e) };
      }
    },
    deviceInfo: async () => null,
    speak: browserSpeak,
    stopSpeaking: browserStopSpeaking,
    voiceAvailable: browserVoiceAvailable,
    listen: browserListen,
    openSystemSettings: async () => false,
    openStockHome: async () => false,
  };
}
