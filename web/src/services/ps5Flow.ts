import type { Settings } from "../lib/settings";
import type { Platform } from "../platform/types";
import { Ps5Client, normalizeCredential } from "./ps5";
import { RokuClient } from "./roku";

export type StepState = "pending" | "running" | "ok" | "skipped" | "warn" | "failed";

export interface FlowStep {
  id: "check" | "wake" | "input";
  title: string;
  state: StepState;
  detail: string;
}

export interface FlowOptions {
  /** How long to wait for the console after sending WAKEUP. */
  wakeTimeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const initialPs5Steps = (s: Settings): FlowStep[] => [
  { id: "check", title: "Check PlayStation 5", state: "pending", detail: "" },
  { id: "wake", title: "Wake PlayStation 5", state: "pending", detail: "" },
  { id: "input", title: `Switch TV to HDMI ${s.ps5.hdmiInput}`, state: "pending", detail: "" },
];

/**
 * 1. Ask the PS5 whether it is on (DDP search).
 * 2. If it is in Rest Mode and a Remote Play credential is set, send WAKEUP and wait for it.
 *    Without a credential, rely on HDMI-CEC (PS5 "HDMI Device Link") when the TV changes input.
 * 3. Tell the Roku TV to change to the PS5's HDMI input (ECP keypress InputHDMIn).
 *
 * Each step reports honestly; a failed step never claims the PS5 is on.
 */
export async function runPs5Flow(
  platform: Platform,
  settings: Settings,
  onUpdate: (steps: FlowStep[]) => void,
  opts: FlowOptions = {},
): Promise<FlowStep[]> {
  const sleep = opts.sleep ?? defaultSleep;
  const steps = initialPs5Steps(settings);
  const set = (id: FlowStep["id"], state: StepState, detail: string) => {
    const i = steps.findIndex((s) => s.id === id);
    steps[i] = { ...steps[i], state, detail };
    onUpdate(steps.map((s) => ({ ...s })));
  };
  const sim = platform.real.network ? "" : " (simulated)";
  const ps5 = new Ps5Client(platform, settings.ps5.ip);
  const roku = new RokuClient(platform, settings.roku.ip);

  // 1. Status
  let power: "on" | "standby" | "unknown" = "unknown";
  if (!ps5.configured) {
    set("check", "skipped", "PS5 IP address not set, so its power state can't be checked. Add it in Settings → PlayStation 5.");
  } else {
    set("check", "running", "Asking the PS5 on the network…");
    const st = await ps5.status();
    if (!st) set("check", "warn", `No answer from ${settings.ps5.ip}. It may be fully off, or “Stay connected to the internet” in Rest Mode is off.`);
    else {
      power = st.power;
      set("check", "ok", `${st.hostName || "PS5"} is ${st.power === "on" ? "on" : st.power === "standby" ? "in Rest Mode" : `reporting code ${st.code}`}${sim}.`);
    }
  }

  // 2. Wake
  if (power === "on") {
    set("wake", "skipped", "Already on.");
  } else if (!settings.ps5.wake) {
    set("wake", "skipped", "Network wake is turned off in Settings. Relying on HDMI-CEC (PS5 HDMI Device Link).");
  } else if (!ps5.configured || !normalizeCredential(settings.ps5.credential)) {
    set(
      "wake",
      "skipped",
      "No Remote Play credential set, so GrantOS can't wake the PS5 over the network. If HDMI Device Link is on, the PS5 may wake when the TV switches input. Otherwise press the PS button on the controller.",
    );
  } else {
    set("wake", "running", "Sending wake signal…");
    const sent = await ps5.wake(settings.ps5.credential);
    if (!sent.sent) {
      set("wake", "failed", `Wake signal not sent: ${sent.error}`);
    } else {
      const timeout = opts.wakeTimeoutMs ?? 20000;
      const poll = opts.pollMs ?? 2000;
      let awake = false;
      for (let waited = 0; waited < timeout && !awake; waited += poll) {
        await sleep(poll);
        awake = (await ps5.status(1500))?.power === "on";
      }
      set(
        "wake",
        awake ? "ok" : "warn",
        awake ? `PS5 is awake${sim}.` : "Wake signal sent, but the PS5 hasn't reported “on” yet. It may still be starting up.",
      );
    }
  }

  // 3. Input
  if (!settings.ps5.switchInput) {
    set("input", "skipped", `Input switching is off. Use the TV remote: Input → HDMI ${settings.ps5.hdmiInput}.`);
  } else {
    set("input", "running", `Asking the Roku TV to show HDMI ${settings.ps5.hdmiInput}…`);
    const r = await roku.switchToHdmi(settings.ps5.hdmiInput);
    set(
      "input",
      r.ok ? "ok" : "failed",
      r.ok
        ? `TV switched to HDMI ${settings.ps5.hdmiInput}${sim}.`
        : `${r.message}${r.hint ? ` ${r.hint}` : ""} Fallback: TV remote → Input → HDMI ${settings.ps5.hdmiInput}.`,
    );
  }
  return steps;
}
