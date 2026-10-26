import { sanitizeSettings } from "../lib/settings";
import { fakePlatform } from "../test/fakePlatform";
import { runPs5Flow } from "./ps5Flow";

const noSleep = async () => {};
const settings = (patch: object) => sanitizeSettings({ roku: { ip: "192.168.1.20" }, ps5: { ip: "192.168.1.30", hdmiInput: 2, ...patch } });

describe("runPs5Flow", () => {
  it("wakes a sleeping PS5 and switches input", async () => {
    let awake = false;
    const { platform, calls } = fakePlatform({
      udp: (r) => {
        if (r.message.startsWith("WAKEUP")) awake = true;
        return { reply: r.expectReply ? `HTTP/1.1 ${awake ? "200 Ok" : "620 Server Standby"}\nhost-name:PS5\n` : null };
      },
    });
    const steps = await runPs5Flow(platform, settings({ credential: "1517653659" }), () => {}, { sleep: noSleep, pollMs: 1, wakeTimeoutMs: 10 });
    expect(steps.map((s) => s.state)).toEqual(["ok", "ok", "ok"]);
    expect(calls.udp.some((u) => u.message.includes("user-credential:1517653659"))).toBe(true);
    expect(calls.http.pop()?.url).toBe("http://192.168.1.20:8060/keypress/InputHDMI2");
  });

  it("skips wake when already on", async () => {
    const { platform } = fakePlatform({ udp: () => ({ reply: "HTTP/1.1 200 Ok\n" }) });
    const steps = await runPs5Flow(platform, settings({ credential: "1" }), () => {}, { sleep: noSleep });
    expect(steps[1]).toMatchObject({ state: "skipped", detail: "Already on." });
  });

  it("explains the HDMI-CEC fallback when there is no credential", async () => {
    const { platform, calls } = fakePlatform({ udp: () => ({ reply: "HTTP/1.1 620 Server Standby\n" }) });
    const steps = await runPs5Flow(platform, settings({}), () => {}, { sleep: noSleep });
    expect(steps[1].state).toBe("skipped");
    expect(steps[1].detail).toMatch(/HDMI Device Link/);
    expect(calls.udp.some((u) => u.message.startsWith("WAKEUP"))).toBe(false);
    expect(steps[2].state).toBe("ok");
  });

  it("never claims success when the TV refuses", async () => {
    const { platform } = fakePlatform({ http: () => ({ status: 403, body: "" }) });
    const steps = await runPs5Flow(platform, settings({}), () => {}, { sleep: noSleep });
    expect(steps[2].state).toBe("failed");
    expect(steps[2].detail).toMatch(/Control by mobile apps/);
    expect(steps[2].detail).toMatch(/Input → HDMI 2/);
  });

  it("reports progress as it goes", async () => {
    const { platform } = fakePlatform();
    const updates: string[] = [];
    await runPs5Flow(platform, settings({}), (s) => updates.push(s.map((x) => x.state).join(",")), { sleep: noSleep });
    expect(updates[0]).toBe("running,pending,pending");
    expect(updates.length).toBeGreaterThan(3);
  });
});
