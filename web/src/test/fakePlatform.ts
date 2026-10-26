import type { HttpRequest, HttpResponse, Platform, UdpRequest, UdpResponse } from "../platform/types";

/** A scriptable Platform for unit tests: records every call, answers with the given handlers. */
export function fakePlatform(opts: {
  http?: (req: HttpRequest) => HttpResponse;
  udp?: (req: UdpRequest) => UdpResponse;
  real?: boolean;
  kind?: Platform["kind"];
} = {}) {
  const calls: { http: HttpRequest[]; udp: UdpRequest[]; launch: unknown[] } = { http: [], udp: [], launch: [] };
  const platform: Platform = {
    kind: opts.kind ?? "android",
    label: "fake",
    real: { apps: opts.real ?? true, network: opts.real ?? true },
    listApps: async () => [],
    launchApp: async (t) => {
      calls.launch.push(t);
      return { ok: true, simulated: false };
    },
    http: async (req) => {
      calls.http.push(req);
      return opts.http ? opts.http(req) : { status: 200, body: "" };
    },
    udp: async (req) => {
      calls.udp.push(req);
      return opts.udp ? opts.udp(req) : { reply: null };
    },
    deviceInfo: async () => null,
    speak: async () => true,
    stopSpeaking: () => {},
    voiceAvailable: async () => false,
    listen: async () => ({ error: "none" }),
    openSystemSettings: async () => false,
    openStockHome: async () => false,
  };
  return { platform, calls };
}
