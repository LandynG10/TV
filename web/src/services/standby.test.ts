import { sanitizeSettings } from "../lib/settings";
import { fakePlatform } from "../test/fakePlatform";
import { requestTvStandby } from "./standby";

describe("requestTvStandby", () => {
  it("sends PowerOff to the Roku TV", async () => {
    const { platform, calls } = fakePlatform();
    const r = await requestTvStandby(platform, sanitizeSettings({ roku: { ip: "192.168.1.20" } }));
    expect(r.ok).toBe(true);
    expect(calls.http[0].url).toBe("http://192.168.1.20:8060/keypress/PowerOff");
  });
  it("does nothing when turned off in Settings", async () => {
    const { platform, calls } = fakePlatform();
    const r = await requestTvStandby(platform, sanitizeSettings({ roku: { ip: "192.168.1.20" }, goodbye: { tvStandby: false } }));
    expect(r.attempted).toBe(false);
    expect(calls.http).toHaveLength(0);
  });
  it("tells the user to use the remote when no TV address is set", async () => {
    const { platform } = fakePlatform();
    const r = await requestTvStandby(platform, sanitizeSettings({}));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Press Power on the remote/);
  });
});
