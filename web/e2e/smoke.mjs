// End-to-end smoke test: drives GrantOS with the keyboard (like a Fire TV remote) at 1920×1080
// and saves screenshots. Needs `npm run dev` running. Usage: node e2e/smoke.mjs [baseUrl] [outDir]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Uses the project's playwright if installed, otherwise a global one.
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(execSync("npm root -g").toString().trim() + "/playwright");
}
const { chromium } = pw;
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://localhost:5173/";
const out = process.argv[3] || "e2e/screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const focused = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 40));
const press = async (key, n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
};
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const check = (cond, msg) => {
  if (!cond) throw new Error("FAILED: " + msg);
  console.log("ok -", msg);
};

// Start in simulated hardware mode so the PS5 and Goodbye flows have a TV to talk to.
await page.addInitScript(() => {
  if (!localStorage.getItem("grantos.settings.v1")) {
    localStorage.setItem("grantos.settings.v1", JSON.stringify({ hardwareMode: "simulated", roku: { ip: "192.168.1.20" }, ps5: { ip: "192.168.1.30", credential: "3561373538653962" } }));
  }
});
await page.goto(base);
await page.waitForSelector("[data-testid=home]");
await page.waitForTimeout(1800);
await shot("01-home");
check(/^Good (morning|afternoon|evening)\.$/.test(await page.textContent("[data-testid=greeting]")), "greeting shown");
check((await focused()) === "tile-viu", "VIU tile focused first");
await press("ArrowRight");
check((await focused()) === "tile-ps5", "Right → PS5");
await press("ArrowRight");
check((await focused()) === "tile-youtube", "Right → YouTube");
await press("ArrowRight");
check((await focused()) === "tile-ai", "Right → AI");
await shot("02-home-focus-ai");
await press("ArrowDown");
check((await focused()) === "action-settings", "Down → Settings");
await press("ArrowRight");
check((await focused()) === "action-goodbye", "Right → Goodbye");
await press("ArrowUp");
check((await focused()) === "tile-ps5", "Up from Goodbye → PS5");

// PS5 flow (simulated)
await press("Enter");
await page.waitForSelector("[data-testid=ps5-overlay]");
await page.waitForFunction(() => document.querySelector("[data-testid=step-input]")?.getAttribute("data-state") !== "pending" && document.querySelector("[data-testid=step-input]")?.getAttribute("data-state") !== "running", null, { timeout: 30000 });
await page.waitForTimeout(500);
await shot("03-ps5-flow");
check((await page.getAttribute("[data-testid=step-input]", "data-state")) === "ok", "PS5 flow switched input (simulated)");
await press("Escape");
await page.waitForSelector("[data-testid=ps5-overlay]", { state: "detached" });
await page.waitForTimeout(200);

// AI assistant
await press("ArrowRight", 2);
console.log("focused after overlay:", await focused());
check((await focused()) === "tile-ai", "back to AI tile");
await press("Enter");
await page.waitForSelector("[data-testid=assistant]");
await page.waitForTimeout(500);
await shot("04-assistant-empty");
await press("Enter"); // first suggestion: What time is it?
await page.waitForSelector("[data-testid=msg-assistant]");
await page.fill("[data-testid=chat-input]", "what is 18 x 24");
await page.focus("[data-testid=chat-input]");
await press("Enter");
await page.waitForFunction(() => document.querySelectorAll("[data-testid=msg-assistant]").length >= 2);
await page.waitForTimeout(400);
await shot("05-assistant-chat");
check((await page.textContent("body")).includes("= 432"), "demo maths answer");
await press("Escape");
await page.waitForSelector("[data-testid=home]");

// Settings
await press("ArrowDown");
await press("ArrowLeft", 3);
check((await focused()) === "action-settings", "Settings pill focused");
await press("Enter");
await page.waitForSelector("[data-testid=settings]");
await page.waitForTimeout(400);
await shot("06-settings-appearance");
await press("ArrowRight");
await press("Enter"); // cycle theme
await page.waitForTimeout(300);
check((await page.evaluate(() => document.documentElement.dataset.theme)) === "graphite", "theme cycled to graphite");
await press("Enter", 3); // back to midnight
await press("ArrowLeft");
check((await focused()) === "nav-appearance", "Left → section menu");
for (const [n, name] of [[3, "07-settings-tv"], [1, "08-settings-ps5"], [1, "09-settings-apps"], [1, "10-settings-ai"], [2, "11-settings-diagnostics"], [1, "12-settings-about"]]) {
  await press("ArrowDown", n);
  await page.waitForTimeout(350);
  if (name.includes("apps")) {
    await press("ArrowRight");
    await press("Enter");
    await page.waitForTimeout(600);
    await press("ArrowLeft");
  }
  if (name.includes("diagnostics")) {
    await press("ArrowRight");
    await press("Enter");
    await page.waitForTimeout(1500);
    await press("ArrowLeft");
  }
  await shot(name);
}
await press("Escape");
await page.waitForSelector("[data-testid=home]");

// Goodbye
await press("ArrowDown");
await press("ArrowRight");
check((await focused()) === "action-goodbye", "Goodbye focused");
await press("Enter");
await page.waitForTimeout(1600);
await shot("13-goodbye");
await page.waitForSelector("[data-testid=goodbye-status]", { timeout: 15000 });
await page.waitForTimeout(400);
await shot("14-goodbye-standby");
await press("Enter");
await page.waitForSelector("[data-testid=goodbye]", { state: "detached" });
check(true, "Goodbye returns to dashboard on key press");

// Small screen (Fire TV WebViews often report 960×540)
await page.setViewportSize({ width: 960, height: 540 });
await page.waitForTimeout(500);
await shot("15-home-960x540");

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
console.log("SMOKE TEST PASSED");
