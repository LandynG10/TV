import { fakePlatform } from "../test/fakePlatform";
import { buildSearchMessage, buildWakeMessage, normalizeCredential, parseDdpReply, Ps5Client } from "./ps5";

describe("PS5 DDP", () => {
  it("builds the search and wake messages", () => {
    expect(buildSearchMessage()).toBe("SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00030010\n");
    const wake = buildWakeMessage("1517653659");
    expect(wake.startsWith("WAKEUP * HTTP/1.1\n")).toBe(true);
    expect(wake).toContain("\nuser-credential:1517653659\n");
    expect(wake).toContain("\nclient-type:vr\nauth-type:R\nmodel:w\napp-type:r\n");
    expect(wake.endsWith("device-discovery-protocol-version:00030010\n")).toBe(true);
  });

  it("parses on and standby replies", () => {
    expect(parseDdpReply("HTTP/1.1 200 Ok\nhost-name:PS5-123\nhost-type:PS5\nrunning-app-name:Game\n")).toMatchObject({ code: 200, power: "on", hostName: "PS5-123", runningApp: "Game" });
    expect(parseDdpReply("HTTP/1.1 620 Server Standby\nhost-name:PS5-123\n")?.power).toBe("standby");
    expect(parseDdpReply("garbage")).toBeNull();
  });

  it("normalizes credentials like Remote Play tools store them", () => {
    // RegistKey "3561373538653962" = hex of ASCII "5a758e9b" → 0x5a758e9b
    expect(normalizeCredential("3561373538653962")).toBe(String(0x5a758e9b));
    expect(normalizeCredential("1517653659")).toBe("1517653659");
    expect(normalizeCredential(" 5a758e9b ")).toBe(String(0x5a758e9b));
    expect(normalizeCredential("not a key")).toBe("");
    expect(normalizeCredential("")).toBe("");
  });

  it("queries status from port 9303 to 9302", async () => {
    const { platform, calls } = fakePlatform({ udp: () => ({ reply: "HTTP/1.1 620 Server Standby\nhost-name:PS5\n" }) });
    const st = await new Ps5Client(platform, "192.168.1.30").status();
    expect(st?.power).toBe("standby");
    expect(calls.udp[0]).toMatchObject({ host: "192.168.1.30", port: 9302, localPort: 9303, expectReply: true });
  });

  it("won't wake without a usable credential", async () => {
    const { platform, calls } = fakePlatform();
    expect((await new Ps5Client(platform, "192.168.1.30").wake("")).sent).toBe(false);
    expect(calls.udp).toHaveLength(0);
  });
});
