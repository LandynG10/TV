import type { AppTarget } from "../lib/settings";
import type { InstalledApp, LaunchResult, Platform } from "../platform/types";

export type ManagedApp = "viu" | "youtube";

export const APP_NAMES: Record<ManagedApp, string> = { viu: "VIU", youtube: "YouTube" };

/**
 * Finds the installed apps that look like VIU or YouTube, by their visible label on the device.
 * Nothing is guessed: the package names come from the Fire Stick's own app list.
 */
export function findCandidates(apps: InstalledApp[], which: ManagedApp): InstalledApp[] {
  const score = (a: InstalledApp): number => {
    const label = a.label.trim().toLowerCase();
    if (which === "viu") {
      if (label === "viu") return 3;
      if (/\bviu\b/.test(label)) return 2;
      return 0;
    }
    if (label === "youtube") return 3;
    if (/youtube/.test(label) && !/kids|music|tv\b/.test(label)) return 2;
    if (/youtube/.test(label)) return 1;
    return 0;
  };
  return apps
    .map((a) => ({ a, s: score(a) + (a.tv ? 0.5 : 0) }))
    .filter((x) => x.s >= 1)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}

export const toTarget = (app: InstalledApp): AppTarget => ({ packageName: app.packageName, activity: app.activity });

export interface AppLaunchOutcome extends LaunchResult {
  message: string;
}

export async function launchManagedApp(platform: Platform, which: ManagedApp, target: AppTarget): Promise<AppLaunchOutcome> {
  const name = APP_NAMES[which];
  if (!target.packageName) {
    return {
      ok: false,
      simulated: !platform.real.apps,
      message: `${name} isn't set up yet. Open Settings → Applications and choose “Detect installed apps”.`,
    };
  }
  const r = await platform.launchApp(target);
  if (r.ok) {
    return { ...r, message: r.simulated ? `Simulated: would open ${name} (${target.packageName}).` : `Opening ${name}…` };
  }
  const notInstalled = /not installed|not found|no launch/i.test(r.error ?? "");
  return {
    ...r,
    message: notInstalled
      ? `${name} doesn't seem to be installed on this Fire TV (${target.packageName}). Install it from the Amazon Appstore, or re-detect it in Settings → Applications.`
      : `Couldn't open ${name}: ${r.error ?? "unknown error"}.`,
  };
}
