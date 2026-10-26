import type { AppTarget } from "../lib/settings";
import type { DeviceInfo, HttpRequest, HttpResponse, InstalledApp, LaunchResult, Platform, UdpRequest, UdpResponse } from "./types";

/**
 * The Java side is android/src/com/grantos/tv/NativeBridge.java, exposed as window.GrantOSNative.
 * Every call is asynchronous: call(id, method, json) returns at once, and Java answers later
 * with window.__grantosNativeResult(id, json) from a background thread.
 */
interface NativeBridge {
  call(id: string, method: string, argsJson: string): void;
}

declare global {
  interface Window {
    GrantOSNative?: NativeBridge;
    __grantosNativeResult?: (id: string, json: string) => void;
  }
}

const pending = new Map<string, (value: any) => void>();
let counter = 0;

export const hasNativeBridge = () => typeof window !== "undefined" && Boolean(window.GrantOSNative);

function call<T>(method: string, args: object = {}, timeoutMs = 20000): Promise<T> {
  const bridge = window.GrantOSNative;
  if (!bridge) return Promise.reject(new Error("GrantOS native bridge not present"));
  if (!window.__grantosNativeResult) {
    window.__grantosNativeResult = (id, json) => {
      const resolve = pending.get(id);
      if (!resolve) return;
      pending.delete(id);
      try {
        resolve(JSON.parse(json));
      } catch {
        resolve({ error: "bad native response" });
      }
    };
  }
  const id = `n${++counter}`;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) resolve({ error: `${method} timed out` } as T);
    }, timeoutMs);
    pending.set(id, (v) => {
      clearTimeout(timer);
      resolve(v);
    });
    bridge.call(id, method, JSON.stringify(args));
  });
}

export function createAndroidPlatform(): Platform {
  return {
    kind: "android",
    label: "Fire TV (native)",
    real: { apps: true, network: true },
    listApps: async () => (await call<{ apps?: InstalledApp[] }>("listApps")).apps ?? [],
    launchApp: async (t: AppTarget) => {
      const r = await call<{ ok?: boolean; error?: string }>("launchApp", { packageName: t.packageName, activity: t.activity });
      return { ok: Boolean(r.ok), error: r.error, simulated: false } satisfies LaunchResult;
    },
    http: (req: HttpRequest) =>
      call<HttpResponse>("http", req, (req.timeoutMs ?? 5000) + 3000).then((r) => ({ status: r.status ?? 0, body: r.body ?? "", error: r.error })),
    udp: (req: UdpRequest) => call<UdpResponse>("udp", req, (req.timeoutMs ?? 2000) + 3000).then((r) => ({ reply: r.reply ?? null, error: r.error })),
    deviceInfo: async () => {
      const r = await call<DeviceInfo & { error?: string }>("deviceInfo");
      return r.error ? null : { ...r, userAgent: navigator.userAgent };
    },
    speak: async (text) => Boolean((await call<{ ok?: boolean }>("speak", { text })).ok),
    stopSpeaking: () => void call("stopSpeaking"),
    voiceAvailable: async () => Boolean((await call<{ available?: boolean }>("voiceAvailable")).available),
    listen: () => call<{ text?: string; error?: string }>("listen", {}, 30000),
    openSystemSettings: async () => Boolean((await call<{ ok?: boolean }>("openSystemSettings")).ok),
    openStockHome: async () => Boolean((await call<{ ok?: boolean }>("openStockHome")).ok),
  };
}
