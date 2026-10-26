import type { Platform } from "../platform/types";
import { isIPv4 } from "../lib/settings";

/**
 * Roku External Control Protocol (ECP): plain HTTP on port 8060 of the TV.
 * Key names are from Roku's ECP documentation (PowerOff, PowerOn, InputHDMI1-4 work on Roku TVs).
 *
 * Since Roku OS 14.1, keypress only works when the TV's
 * Settings → System → Advanced system settings → Control by mobile apps → Network access
 * is "Enabled" (newer firmware may default to "Limited").
 */
export const ECP_PORT = 8060;

export const ROKU_ACCESS_HINT =
  'On the TV: Settings → System → Advanced system settings → Control by mobile apps → Network access → "Enabled".';

export const hdmiKey = (input: number) => `InputHDMI${Math.min(4, Math.max(1, Math.round(input)))}`;

export interface RokuDeviceInfo {
  vendor: string;
  model: string;
  softwareVersion: string;
  powerMode: string;
  isTv: boolean;
}

export interface EcpResult {
  ok: boolean;
  simulated: boolean;
  message: string;
  hint?: string;
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return m ? m[1].trim() : "";
};

export function parseDeviceInfo(xml: string): RokuDeviceInfo | null {
  if (!xml.includes("<device-info")) return null;
  return {
    vendor: tag(xml, "vendor-name"),
    model: tag(xml, "model-name") || tag(xml, "friendly-model-name"),
    softwareVersion: tag(xml, "software-version"),
    powerMode: tag(xml, "power-mode"),
    isTv: tag(xml, "is-tv") === "true",
  };
}

/** Turns an HTTP status from the TV into words someone can act on. */
export function explainEcpStatus(status: number, error: string | undefined, action: string): Omit<EcpResult, "simulated"> {
  if (status >= 200 && status < 300) return { ok: true, message: `${action}: done.` };
  if (status === 0) {
    return {
      ok: false,
      message: `${action}: the TV did not answer${error ? ` (${error})` : ""}.`,
      hint: "Check the Roku TV's IP address in Settings → TV & HDMI, and that the TV and Fire Stick are on the same network.",
    };
  }
  if (status === 401 || status === 403) {
    return { ok: false, message: `${action}: the TV refused the command (HTTP ${status}).`, hint: ROKU_ACCESS_HINT };
  }
  return { ok: false, message: `${action}: unexpected answer from the TV (HTTP ${status}).` };
}

export class RokuClient {
  constructor(private platform: Platform, private ip: string) {}

  get configured() {
    return isIPv4(this.ip);
  }

  private url(path: string) {
    return `http://${this.ip}:${ECP_PORT}${path}`;
  }

  private notConfigured(action: string): EcpResult {
    return {
      ok: false,
      simulated: !this.platform.real.network,
      message: `${action}: the Roku TV's IP address is not set.`,
      hint: "Find it on the TV under Settings → Network → About, then enter it in GrantOS Settings → TV & HDMI.",
    };
  }

  async deviceInfo(): Promise<{ info: RokuDeviceInfo | null; result: EcpResult }> {
    if (!this.configured) return { info: null, result: this.notConfigured("Find Roku TV") };
    const r = await this.platform.http({ url: this.url("/query/device-info"), timeoutMs: 4000 });
    const info = r.status === 200 ? parseDeviceInfo(r.body) : null;
    const explained = explainEcpStatus(r.status, r.error, "Find Roku TV");
    return {
      info,
      result: { ...explained, simulated: !this.platform.real.network, message: info ? `Found ${info.model || "Roku TV"} (power: ${info.powerMode || "unknown"}).` : explained.message },
    };
  }

  async keypress(key: string, action = `Send ${key}`): Promise<EcpResult> {
    if (!this.configured) return this.notConfigured(action);
    const r = await this.platform.http({ method: "POST", url: this.url(`/keypress/${encodeURIComponent(key)}`), body: "", timeoutMs: 4000 });
    return { ...explainEcpStatus(r.status, r.error, action), simulated: !this.platform.real.network };
  }

  switchToHdmi(input: number) {
    return this.keypress(hdmiKey(input), `Switch TV to HDMI ${input}`);
  }

  powerOff() {
    return this.keypress("PowerOff", "Put TV in standby");
  }
}
