import { createAndroidPlatform, hasNativeBridge } from "./android";
import { createDesktopPlatform } from "./desktop";
import { createSimulatedPlatform } from "./simulated";
import type { Platform } from "./types";

export type { Platform } from "./types";

/**
 * Picks the platform: the native bridge when running inside the Fire TV app, the dev server
 * when running under `npm run dev`, otherwise the simulator. "simulated" in Settings forces
 * the simulator everywhere (useful for demos).
 */
export async function detectPlatform(mode: "auto" | "simulated"): Promise<Platform> {
  if (mode === "simulated") return createSimulatedPlatform();
  if (hasNativeBridge()) return createAndroidPlatform();
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    const res = await fetch("/api/health", { signal: controller.signal });
    clearTimeout(t);
    if (res.ok && (await res.json()).ok) return createDesktopPlatform();
  } catch {
    // No dev server (static build or file preview).
  }
  return createSimulatedPlatform();
}

export async function devServerAiStatus(): Promise<{ envKey: boolean; model: string; baseUrl: string } | null> {
  try {
    const res = await fetch("/api/health");
    const body = await res.json();
    return body.ai ?? null;
  } catch {
    return null;
  }
}
