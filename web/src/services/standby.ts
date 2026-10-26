import type { Settings } from "../lib/settings";
import type { Platform } from "../platform/types";
import { RokuClient } from "./roku";

export interface StandbyOutcome {
  attempted: boolean;
  ok: boolean;
  simulated: boolean;
  message: string;
}

/**
 * Puts the TV in standby after the Goodbye animation.
 * The only verified, app-accessible method is Roku ECP "PowerOff". A sideloaded Fire TV app
 * cannot put the Fire Stick itself to sleep or send HDMI-CEC "standby" (both need system permissions).
 */
export async function requestTvStandby(platform: Platform, settings: Settings): Promise<StandbyOutcome> {
  const simulated = !platform.real.network;
  if (!settings.goodbye.tvStandby) {
    return { attempted: false, ok: false, simulated, message: "TV standby is turned off in Settings." };
  }
  const roku = new RokuClient(platform, settings.roku.ip);
  if (!roku.configured) {
    return {
      attempted: false,
      ok: false,
      simulated,
      message: "Set the Roku TV's IP address in Settings → TV & HDMI to turn the TV off automatically. Press Power on the remote for now.",
    };
  }
  const r = await roku.powerOff();
  return {
    attempted: true,
    ok: r.ok,
    simulated,
    message: r.ok ? (simulated ? "Simulated: TV standby sent." : "TV is going to standby.") : `${r.message}${r.hint ? ` ${r.hint}` : ""}`,
  };
}
