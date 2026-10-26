import { fakePlatform } from "../test/fakePlatform";
import type { InstalledApp } from "../platform/types";
import { findCandidates, launchManagedApp } from "./apps";

const app = (packageName: string, label: string, tv = true): InstalledApp => ({ packageName, label, activity: packageName + ".Main", tv });
const installed = [app("a.viu", "Viu"), app("b.video", "Preview Player"), app("c.yt", "YouTube"), app("d.ytk", "YouTube Kids"), app("e.yttv", "YouTube TV")];

describe("findCandidates", () => {
  it("finds VIU by its label, not by a guessed package", () => {
    expect(findCandidates(installed, "viu").map((a) => a.packageName)).toEqual(["a.viu"]);
  });
  it("ranks the main YouTube app first", () => {
    expect(findCandidates(installed, "youtube")[0].packageName).toBe("c.yt");
  });
});

describe("launchManagedApp", () => {
  it("asks for setup when no package is set", async () => {
    const { platform, calls } = fakePlatform();
    const r = await launchManagedApp(platform, "viu", { packageName: "", activity: "" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Detect installed apps/);
    expect(calls.launch).toHaveLength(0);
  });
  it("explains an app that isn't installed", async () => {
    const { platform } = fakePlatform();
    platform.launchApp = async () => ({ ok: false, simulated: false, error: "not installed" });
    const r = await launchManagedApp(platform, "youtube", { packageName: "com.amazon.firetv.youtube", activity: "" });
    expect(r.message).toMatch(/doesn't seem to be installed/);
  });
  it("passes package and activity through", async () => {
    const { platform, calls } = fakePlatform();
    await launchManagedApp(platform, "viu", { packageName: "a.viu", activity: "a.viu.Main" });
    expect(calls.launch[0]).toEqual({ packageName: "a.viu", activity: "a.viu.Main" });
  });
});
