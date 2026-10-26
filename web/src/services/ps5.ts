import type { Platform } from "../platform/types";
import { isIPv4 } from "../lib/settings";

/**
 * PlayStation Device Discovery Protocol (DDP), the LAN protocol Remote Play apps use to
 * find a console and wake it from Rest Mode. PS5 listens on UDP 9302 and answers queries
 * sent from port 9303. Wake needs the "user-credential" produced when a Remote Play client
 * is registered (paired) with the console; see docs/PS5.md for how to get it for free.
 *
 * Verified against the open-source pyremoteplay implementation; NOT yet tested on your PS5.
 */
export const PS5_DDP_PORT = 9302;
export const PS5_LOCAL_PORT = 9303;
export const DDP_VERSION = "00030010";

export const buildSearchMessage = () => `SRCH * HTTP/1.1\ndevice-discovery-protocol-version:${DDP_VERSION}\n`;

export const buildWakeMessage = (credential: string) =>
  [
    "WAKEUP * HTTP/1.1",
    "client-type:vr",
    "auth-type:R",
    "model:w",
    "app-type:r",
    `user-credential:${credential}`,
    `device-discovery-protocol-version:${DDP_VERSION}`,
    "",
  ].join("\n");

export type Ps5Power = "on" | "standby" | "unknown";

export interface DdpStatus {
  code: number;
  power: Ps5Power;
  hostName: string;
  hostType: string;
  runningApp: string;
}

export function parseDdpReply(reply: string): DdpStatus | null {
  const first = /HTTP\/1\.1 (\d+)/.exec(reply);
  if (!first) return null;
  const code = Number(first[1]);
  const field = (k: string) => {
    const m = new RegExp(`^${k}:(.*)$`, "m").exec(reply);
    return m ? m[1].trim() : "";
  };
  return {
    code,
    power: code === 200 ? "on" : code === 620 ? "standby" : "unknown",
    hostName: field("host-name"),
    hostType: field("host-type"),
    runningApp: field("running-app-name"),
  };
}

const isHex = (s: string) => /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
const hexToAscii = (hex: string) => hex.match(/../g)!.map((b) => String.fromCharCode(parseInt(b, 16))).join("");

function hexToDecimal(hex: string): string {
  if (typeof BigInt === "function") return BigInt("0x" + hex).toString(10);
  return String(parseInt(hex, 16));
}

/**
 * Accepts either the decimal user-credential, or the "RegistKey" that Remote Play registration
 * tools save (hex of an ASCII hex string, e.g. "3561373538653962"), and returns the decimal value
 * the WAKEUP message needs. Returns "" when the input is neither.
 */
export function normalizeCredential(input: string): string {
  const s = input.trim();
  // A RegistKey is often all digits too ("3561…" = ASCII "5a…"), so test for it first. The decimal
  // credential of a 4-byte key is at most 10 digits, so it can't be mistaken for one.
  if (s.length >= 12 && isHex(s)) {
    const inner = hexToAscii(s);
    if (isHex(inner)) return hexToDecimal(inner);
  }
  if (/^\d+$/.test(s)) return s;
  if (!isHex(s)) return "";
  return hexToDecimal(s);
}

export class Ps5Client {
  constructor(private platform: Platform, private ip: string) {}

  get configured() {
    return isIPv4(this.ip);
  }

  async status(timeoutMs = 2000): Promise<DdpStatus | null> {
    if (!this.configured) return null;
    const r = await this.platform.udp({
      host: this.ip,
      port: PS5_DDP_PORT,
      localPort: PS5_LOCAL_PORT,
      message: buildSearchMessage(),
      expectReply: true,
      timeoutMs,
    });
    return r.reply ? parseDdpReply(r.reply) : null;
  }

  async wake(credential: string): Promise<{ sent: boolean; error?: string }> {
    const cred = normalizeCredential(credential);
    if (!this.configured) return { sent: false, error: "PS5 IP address is not set." };
    if (!cred) return { sent: false, error: "The Remote Play credential is missing or not in a recognised format." };
    const r = await this.platform.udp({
      host: this.ip,
      port: PS5_DDP_PORT,
      localPort: PS5_LOCAL_PORT,
      message: buildWakeMessage(cred),
      expectReply: false,
    });
    return { sent: !r.error, error: r.error };
  }
}
