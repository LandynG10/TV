import { DEFAULT_SETTINGS, isIPv4, loadSettings, sanitizeSettings, saveSettings, STORAGE_KEY } from "./settings";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("settings", () => {
  it("defaults are valid and VIU is not guessed", () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.apps.viu.packageName).toBe("");
    expect(DEFAULT_SETTINGS.ai.provider).toBe("demo");
    expect(DEFAULT_SETTINGS.ai.apiKey).toBe("");
  });

  it("repairs bad values instead of crashing", () => {
    const s = sanitizeSettings({ theme: "neon", ps5: { hdmiInput: 9, ip: 42 }, background: { dim: -5 }, goodbye: { message: "" }, clock: "x" });
    expect(s.theme).toBe("midnight");
    expect(s.ps5.hdmiInput).toBe(4);
    expect(s.ps5.ip).toBe("");
    expect(s.background.dim).toBe(0);
    expect(s.goodbye.message).toBe("Goodbye.");
    expect(s.clock).toEqual(DEFAULT_SETTINGS.clock);
  });

  it("round-trips through storage", () => {
    const store = memory();
    const changed = sanitizeSettings({ theme: "aurora", roku: { ip: "192.168.1.20", fireStickInput: 1 }, goodbye: { message: "See you later." } });
    expect(saveSettings(changed, store)).toBe(true);
    expect(loadSettings(store)).toEqual(changed);
  });

  it("survives corrupt JSON", () => {
    const store = memory();
    store.m.set(STORAGE_KEY, "{not json");
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it("validates IPv4 addresses", () => {
    expect(isIPv4("192.168.1.20")).toBe(true);
    expect(isIPv4("192.168.1.256")).toBe(false);
    expect(isIPv4("tv.local")).toBe(false);
  });
});
