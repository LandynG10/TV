import type { HttpRequest, InstalledApp, Platform, UdpRequest } from "./types";
import { browserListen, browserSpeak, browserStopSpeaking, browserVoiceAvailable } from "./browserSpeech";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Example data for the simulator. These are NOT real package names for your device. */
export const SIMULATED_APPS: InstalledApp[] = [
  { packageName: "sim.example.viu", label: "Viu (simulated)", activity: "sim.example.viu.MainActivity", tv: true },
  { packageName: "sim.example.youtube", label: "YouTube (simulated)", activity: "sim.example.youtube.TvActivity", tv: true },
  { packageName: "sim.example.settings", label: "Settings (simulated)", activity: "sim.example.settings.Main", tv: true },
];

const SIM_DEVICE_INFO = `<?xml version="1.0" encoding="UTF-8" ?>
<device-info>
  <vendor-name>TCL (simulated)</vendor-name>
  <model-name>65" TCL Roku TV (simulated)</model-name>
  <is-tv>true</is-tv>
  <software-version>14.0.0</software-version>
  <power-mode>PowerOn</power-mode>
  <supports-suspend>true</supports-suspend>
</device-info>`;

/**
 * A fake TV and PS5 for development without hardware. Every result from here is shown
 * in the UI with a SIMULATED label. Nothing here proves the real hardware works.
 */
export function createSimulatedPlatform(): Platform {
  let ps5Awake = false;
  return {
    kind: "simulated",
    label: "Simulated hardware",
    real: { apps: false, network: false },
    listApps: async () => {
      await wait(250);
      return SIMULATED_APPS;
    },
    launchApp: async (t) => {
      await wait(300);
      return t.packageName ? { ok: true, simulated: true } : { ok: false, simulated: true, error: "No package configured" };
    },
    http: async (req: HttpRequest) => {
      await wait(150);
      const path = new URL(req.url).pathname;
      if (path === "/query/device-info") return { status: 200, body: SIM_DEVICE_INFO };
      if (path.startsWith("/keypress/")) return { status: 200, body: "" };
      if (path === "/v1/chat/completions" || path.endsWith("/chat/completions")) {
        return { status: 0, body: "", error: "The simulator has no AI service." };
      }
      return { status: 404, body: "" };
    },
    udp: async (req: UdpRequest) => {
      await wait(200);
      if (req.message.startsWith("WAKEUP")) {
        ps5Awake = true;
        return { reply: null };
      }
      if (req.message.startsWith("SRCH")) {
        return {
          reply: ps5Awake
            ? "HTTP/1.1 200 Ok\nhost-name:PS5-SIM\nhost-type:PS5\nhost-id:000000000000\n"
            : "HTTP/1.1 620 Server Standby\nhost-name:PS5-SIM\nhost-type:PS5\nhost-id:000000000000\n",
        };
      }
      return { reply: null };
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
