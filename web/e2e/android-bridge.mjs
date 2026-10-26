// Loads the Android build (android/assets/web) the way the APK does, at https://grantos.local/,
// with a stand-in for the Java bridge that records calls. Verifies the JS <-> native protocol:
// call(id, method, json) -> window.__grantosNativeResult(id, json).
// Usage: node e2e/android-bridge.mjs [outDir]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g").toString().trim() + "/playwright");
}
const out = process.argv[2] || "e2e/screenshots";
mkdirSync(out, { recursive: true });
const assets = resolve(import.meta.dirname, "../../android/assets/web");
if (!existsSync(assets + "/index.html")) throw new Error("Run npm run build:android first");

const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff" };
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.route("https://grantos.local/**", (route) => {
  const path = new URL(route.request().url()).pathname.replace(/^\/+/, "") || "index.html";
  const file = resolve(assets, path);
  if (!file.startsWith(assets) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
  route.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
});

await page.addInitScript(() => {
  window.__calls = [];
  const answers = {
    listApps: { apps: [
      { packageName: "com.example.viu.tv", label: "Viu", activity: "com.example.viu.tv.Main", tv: true },
      { packageName: "com.amazon.firetv.youtube", label: "YouTube", activity: "dev.cobalt.app.MainActivity", tv: true },
      { packageName: "com.amazon.firetv.youtube.tv", label: "YouTube TV", activity: "x.Main", tv: true },
    ] },
    launchApp: { ok: true },
    http: { status: 200, body: "" },
    udp: { reply: "HTTP/1.1 200 Ok\nhost-name:PS5-LIVINGROOM\nhost-type:PS5\n" },
    deviceInfo: { model: "AFTKA", manufacturer: "Amazon", androidVersion: "9", sdkInt: 28, fireOsVersion: "Fire OS 7.6.6.9", buildId: "PS7669", ipAddress: "192.168.1.40", appVersion: "0.1.0", homeGuardEnabled: true, speechRecognizer: false },
    voiceAvailable: { available: false },
  };
  window.GrantOSNative = {
    call(id, method, json) {
      window.__calls.push({ method, args: JSON.parse(json) });
      const answer = answers[method] ?? { ok: true };
      setTimeout(() => window.__grantosNativeResult(id, JSON.stringify(answer)), 30);
    },
  };
});

const check = (cond, msg) => {
  if (!cond) throw new Error("FAILED: " + msg);
  console.log("ok -", msg);
};
const press = async (k, n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(k);
    await page.waitForTimeout(120);
  }
};
const calls = () => page.evaluate(() => window.__calls);

await page.goto("https://grantos.local/index.html");
await page.waitForSelector("[data-testid=home]");
await page.waitForTimeout(1800);
check(!(await page.$("[data-testid=platform-badge]")), "no simulated/desktop badge on the Fire TV build");
check((await page.evaluate(() => document.documentElement.style.fontSize)) === "8px", "960×540 viewport scales the 1920 design (1rem = 8px)");
await page.screenshot({ path: `${out}/android-home.png` });

// VIU without a package → goes to Settings → Applications
await press("Enter");
await page.waitForSelector("[data-testid=section-apps]");
check(true, "VIU tile without a package opens Settings → Applications");
await press("ArrowRight"); // Detect installed apps
await press("Enter");
await page.waitForSelector("text=Use Viu");
check((await calls()).some((c) => c.method === "listApps"), "listApps called through the bridge");
await page.click("text=Use Viu");
await page.click("text=Test: open VIU");
await page.waitForTimeout(300);
const launch = (await calls()).filter((c) => c.method === "launchApp").pop();
check(launch.args.packageName === "com.example.viu.tv" && launch.args.activity === "com.example.viu.tv.Main", "VIU launched with the detected package + activity");
await page.screenshot({ path: `${out}/android-apps.png` });

// YouTube from the dashboard
await press("Escape");
await page.waitForSelector("[data-testid=home]");
await page.focus("#tile-youtube");
await press("Enter");
await page.waitForTimeout(300);
check((await calls()).filter((c) => c.method === "launchApp").pop().args.packageName === "com.amazon.firetv.youtube", "YouTube tile launches com.amazon.firetv.youtube");

// PS5: needs a Roku IP; set them in settings storage and reload
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("grantos.settings.v1"));
  s.roku.ip = "192.168.1.20";
  s.ps5.ip = "192.168.1.30";
  s.ps5.hdmiInput = 3;
  localStorage.setItem("grantos.settings.v1", JSON.stringify(s));
});
await page.reload();
await page.waitForSelector("[data-testid=home]");
await page.waitForTimeout(500);
await page.focus("#tile-ps5");
await press("Enter");
await page.waitForFunction(() => document.querySelector("[data-testid=step-input]")?.dataset.state === "ok", null, { timeout: 15000 });
const all = await calls();
const udp = all.find((c) => c.method === "udp");
check(udp.args.host === "192.168.1.30" && udp.args.port === 9302 && udp.args.localPort === 9303 && udp.args.message.startsWith("SRCH * HTTP/1.1"), "PS5 status query: UDP 9302 from 9303");
const key = all.filter((c) => c.method === "http").pop();
check(key.args.url === "http://192.168.1.20:8060/keypress/InputHDMI3" && key.args.method === "POST", "Roku ECP keypress InputHDMI3");
await page.screenshot({ path: `${out}/android-ps5.png` });
await press("Escape");

// Goodbye → PowerOff
await page.focus("#action-goodbye");
await press("Enter");
await page.waitForSelector("[data-testid=goodbye-status]", { timeout: 15000 });
check((await calls()).filter((c) => c.method === "http").pop().args.url === "http://192.168.1.20:8060/keypress/PowerOff", "Goodbye sends Roku ECP PowerOff");

// Back key from Android (MainActivity calls window.grantos.onBack)
await press("Enter");
await page.waitForSelector("[data-testid=home]");
await page.focus("#tile-ai");
await press("Enter");
await page.waitForSelector("[data-testid=assistant]");
await page.evaluate(() => window.grantos.onBack());
await page.waitForSelector("[data-testid=home]");
check(true, "Android Back (window.grantos.onBack) returns to the dashboard");

check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
console.log("ANDROID BRIDGE TEST PASSED");
