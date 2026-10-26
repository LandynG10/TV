import { fakePlatform } from "../test/fakePlatform";
import { explainEcpStatus, hdmiKey, parseDeviceInfo, RokuClient } from "./roku";

const XML = `<?xml version="1.0"?><device-info><vendor-name>TCL</vendor-name><model-name>65S455</model-name>
<is-tv>true</is-tv><software-version>14.1.4</software-version><power-mode>DisplayOff</power-mode></device-info>`;

describe("Roku ECP", () => {
  it("maps HDMI inputs to key names and clamps them", () => {
    expect(hdmiKey(2)).toBe("InputHDMI2");
    expect(hdmiKey(0)).toBe("InputHDMI1");
    expect(hdmiKey(7)).toBe("InputHDMI4");
  });

  it("parses device-info", () => {
    expect(parseDeviceInfo(XML)).toEqual({ vendor: "TCL", model: "65S455", softwareVersion: "14.1.4", powerMode: "DisplayOff", isTv: true });
    expect(parseDeviceInfo("<html>")).toBeNull();
  });

  it("explains failures with a fix", () => {
    expect(explainEcpStatus(200, undefined, "x").ok).toBe(true);
    expect(explainEcpStatus(403, undefined, "x").hint).toMatch(/Control by mobile apps/);
    expect(explainEcpStatus(0, "timeout", "x").message).toMatch(/did not answer \(timeout\)/);
  });

  it("sends keypress as POST to port 8060", async () => {
    const { platform, calls } = fakePlatform();
    const r = await new RokuClient(platform, "192.168.1.20").switchToHdmi(3);
    expect(r.ok).toBe(true);
    expect(calls.http[0]).toMatchObject({ method: "POST", url: "http://192.168.1.20:8060/keypress/InputHDMI3" });
  });

  it("refuses to send without an IP address", async () => {
    const { platform, calls } = fakePlatform();
    const r = await new RokuClient(platform, "").powerOff();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/IP address is not set/);
    expect(calls.http).toHaveLength(0);
  });

  it("marks results from a simulated platform", async () => {
    const { platform } = fakePlatform({ real: false });
    expect((await new RokuClient(platform, "192.168.1.20").powerOff()).simulated).toBe(true);
  });
});
