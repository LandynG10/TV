import type { AppTarget } from "../lib/settings";

/**
 * Everything GrantOS needs from the device it runs on.
 *
 *  - "android":   the Fire TV app. Real app launches, real LAN HTTP/UDP, Android TTS.
 *  - "desktop":   `npm run dev` on a computer. Real LAN HTTP/UDP through the dev server,
 *                 app launches are SIMULATED (a computer cannot open Fire TV apps).
 *  - "simulated": no hardware at all. Every hardware action is SIMULATED and says so.
 */
export type PlatformKind = "android" | "desktop" | "simulated";

export interface HttpRequest {
  method?: "GET" | "POST";
  url: string;
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface HttpResponse {
  /** 0 when the request never got an answer (timeout, refused, blocked). */
  status: number;
  body: string;
  error?: string;
}

export interface UdpRequest {
  host: string;
  port: number;
  /** Local port to bind. The PS5 only answers discovery sent from port 9303. */
  localPort?: number;
  message: string;
  expectReply: boolean;
  timeoutMs?: number;
}

export interface UdpResponse {
  reply: string | null;
  error?: string;
}

export interface InstalledApp {
  packageName: string;
  label: string;
  /** Fully qualified launchable activity class. */
  activity: string;
  /** True when the app has a TV (leanback) entry point. */
  tv: boolean;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  androidVersion: string;
  sdkInt: number;
  /** e.g. "Fire OS 7.6.6.9 (PS7669/4359)"; empty when the property is not readable. */
  fireOsVersion: string;
  buildId: string;
  ipAddress: string;
  appVersion: string;
  homeGuardEnabled: boolean;
  speechRecognizer: boolean;
  userAgent: string;
}

export interface LaunchResult {
  ok: boolean;
  simulated: boolean;
  error?: string;
}

export interface Platform {
  kind: PlatformKind;
  label: string;
  /** False where this platform only pretends (and the UI must say SIMULATED). */
  real: { apps: boolean; network: boolean };
  listApps(): Promise<InstalledApp[]>;
  launchApp(target: AppTarget): Promise<LaunchResult>;
  http(req: HttpRequest): Promise<HttpResponse>;
  udp(req: UdpRequest): Promise<UdpResponse>;
  deviceInfo(): Promise<DeviceInfo | null>;
  speak(text: string): Promise<boolean>;
  stopSpeaking(): void;
  voiceAvailable(): Promise<boolean>;
  /** One utterance of speech to text. */
  listen(): Promise<{ text?: string; error?: string }>;
  /** Opens the Fire TV's own settings / Amazon home. Not available off-device. */
  openSystemSettings(): Promise<boolean>;
  openStockHome(): Promise<boolean>;
}
