import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AppsIcon,
  ClockIcon,
  GamepadIcon,
  InfoIcon,
  PaletteIcon,
  PulseIcon,
  RocketIcon,
  SparkleIcon,
  TvIcon,
  WaveIcon,
} from "../components/Icons";
import { ChoiceRow, Group, Info, StepperRow, TextRow, ToggleRow } from "../components/SettingRows";
import { TopBar } from "../components/TopBar";
import { useToast } from "../components/Toast";
import { useSettings } from "../lib/SettingsContext";
import { isIPv4, type AppTarget } from "../lib/settings";
import { focusFirst } from "../lib/spatialNav";
import { usePlatform } from "../platform/PlatformContext";
import type { DeviceInfo, InstalledApp } from "../platform/types";
import { APP_NAMES, findCandidates, launchManagedApp, toTarget, type ManagedApp } from "../services/apps";
import { normalizeCredential, Ps5Client } from "../services/ps5";
import { ROKU_ACCESS_HINT, RokuClient } from "../services/roku";
import { createProvider } from "../ai";
import { devServerAiStatus } from "../platform";

export type SectionId = "appearance" | "clock" | "goodbye" | "tv" | "ps5" | "apps" | "ai" | "startup" | "diagnostics" | "about";

const SECTIONS: { id: SectionId; label: string; icon: ReactNode }[] = [
  { id: "appearance", label: "Appearance", icon: <PaletteIcon /> },
  { id: "clock", label: "Clock & greeting", icon: <ClockIcon /> },
  { id: "goodbye", label: "Goodbye", icon: <WaveIcon /> },
  { id: "tv", label: "TV & HDMI", icon: <TvIcon /> },
  { id: "ps5", label: "PlayStation 5", icon: <GamepadIcon /> },
  { id: "apps", label: "Applications", icon: <AppsIcon /> },
  { id: "ai", label: "AI Assistant", icon: <SparkleIcon /> },
  { id: "startup", label: "Startup", icon: <RocketIcon /> },
  { id: "diagnostics", label: "Diagnostics", icon: <PulseIcon /> },
  { id: "about", label: "About & compatibility", icon: <InfoIcon /> },
];

export const APP_VERSION = "0.1.0";

export function SettingsScreen({ initialSection = "appearance", onPreviewGoodbye }: { initialSection?: SectionId; onPreviewGoodbye: () => void }) {
  const [section, setSection] = useState<SectionId>(initialSection);
  const navRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = SECTIONS.find((s) => s.id === section)!;

  // Moving Left from anywhere in the panel lands on the open section's menu item.
  useEffect(() => {
    panelRef.current?.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => el.setAttribute("data-nav-left", `#nav-${section}`));
  });

  return (
    <main className="screen" data-nav-root data-testid="settings">
      <TopBar title="Settings" showClock />
      <div className="settings">
        <nav className="settings__nav" ref={navRef} aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              id={`nav-${s.id}`}
              className="navitem"
              data-nav
              data-nav-right="#panel-first"
              data-autofocus={s.id === initialSection ? "" : undefined}
              aria-current={s.id === section}
              onFocus={() => setSection(s.id)}
              onClick={() => panelRef.current && focusFirst(panelRef.current)}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
        <div className="panel" ref={panelRef} key={section} data-testid={`section-${section}`}>
          <h2 className="panel__title">{current.label}</h2>
          <SectionBody id={section} onPreviewGoodbye={onPreviewGoodbye} />
        </div>
      </div>
    </main>
  );
}

/** Marks the first focusable element of the panel so Right from the menu goes there. */
function useFirstTarget(dep: unknown) {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(".panel");
    if (!panel) return;
    panel.querySelectorAll("#panel-first").forEach((el) => el.removeAttribute("id"));
    const first = panel.querySelector<HTMLElement>("[data-nav]:not([id])");
    if (first) first.id = "panel-first";
  }, [dep]);
}

function SectionBody({ id, onPreviewGoodbye }: { id: SectionId; onPreviewGoodbye: () => void }) {
  useFirstTarget(id);
  switch (id) {
    case "appearance":
      return <Appearance />;
    case "clock":
      return <ClockSection />;
    case "goodbye":
      return <GoodbyeSection onPreview={onPreviewGoodbye} />;
    case "tv":
      return <TvSection />;
    case "ps5":
      return <Ps5Section />;
    case "apps":
      return <AppsSection />;
    case "ai":
      return <AiSection />;
    case "startup":
      return <StartupSection />;
    case "diagnostics":
      return <Diagnostics />;
    case "about":
      return <About />;
  }
}

/* ---------------- Appearance ---------------- */

function Appearance() {
  const { settings, update } = useSettings();
  const bg = settings.background;
  return (
    <>
      <p className="panel__intro">Changes apply immediately and are saved on this device.</p>
      <Group label="Theme">
        <ChoiceRow
          label="Theme"
          desc="Colour of surfaces, highlights and the aurora light."
          value={settings.theme}
          options={[
            { value: "midnight", label: "Midnight" },
            { value: "graphite", label: "Graphite" },
            { value: "aurora", label: "Aurora" },
            { value: "oled", label: "OLED black" },
          ]}
          onChange={(theme) => update("theme", theme)}
        />
      </Group>
      <Group label="Background">
        <ChoiceRow
          label="Wallpaper"
          value={bg.kind}
          options={[
            { value: "aurora", label: "Aurora (animated)" },
            { value: "gradient", label: "Gradient" },
            { value: "image", label: "Custom image" },
          ]}
          onChange={(kind) => update("background", { kind })}
        />
        <ChoiceRow
          label="Gradient"
          desc="Used behind the aurora and gradient wallpapers."
          value={bg.gradient}
          options={[
            { value: "midnight", label: "Midnight blue" },
            { value: "dusk", label: "Dusk" },
            { value: "deep-sea", label: "Deep sea" },
            { value: "ember", label: "Ember" },
          ]}
          onChange={(gradient) => update("background", { gradient })}
        />
        {bg.kind === "image" && (
          <>
            <TextRow
              label="Image address"
              desc={
                <>
                  An https:// link, or a photo copied to the Fire TV with <code>scripts/push-wallpaper.sh</code> (then use{" "}
                  <code>https://grantos.local/user/wallpaper.jpg</code>).
                </>
              }
              value={bg.imageUrl}
              placeholder="https://…/photo.jpg"
              inputMode="url"
              onChange={(imageUrl) => update("background", { imageUrl })}
            />
            <StepperRow label="Dim image" desc="Darkens the photo so text stays readable." value={bg.dim} min={0} max={80} step={5} format={(v) => `${v}%`} onChange={(dim) => update("background", { dim })} />
          </>
        )}
      </Group>
      <Group label="Display">
        <StepperRow
          label="Interface size"
          desc="Shrink this if the edges of GrantOS are cut off by the TV (overscan)."
          value={Math.round(settings.display.scale * 100)}
          min={80}
          max={120}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update("display", { scale: v / 100 })}
        />
      </Group>
    </>
  );
}

/* ---------------- Clock & greeting ---------------- */

function ClockSection() {
  const { settings, update } = useSettings();
  return (
    <>
      <p className="panel__intro">
        GrantOS uses the Fire TV's clock and time zone (set in Fire TV Settings → Preferences → Date &amp; Time). The greeting changes by itself: morning from
        5:00, afternoon from 12:00, evening from 17:00.
      </p>
      <Group label="Greeting">
        <ToggleRow label="Show greeting" value={settings.greeting.enabled} onChange={(enabled) => update("greeting", { enabled })} />
        <TextRow label="Your name" desc="Optional. “Good evening.” becomes “Good evening, Grant.”" value={settings.greeting.name} placeholder="No name" onChange={(name) => update("greeting", { name })} />
      </Group>
      <Group label="Clock">
        <ChoiceRow
          label="Time format"
          value={settings.clock.format}
          options={[
            { value: "12h", label: "12-hour (7:30 PM)" },
            { value: "24h", label: "24-hour (19:30)" },
          ]}
          onChange={(format) => update("clock", { format })}
        />
        <ToggleRow label="Show seconds" value={settings.clock.seconds} onChange={(seconds) => update("clock", { seconds })} />
        <ChoiceRow
          label="Date"
          value={settings.clock.dateStyle}
          options={[
            { value: "long", label: "Monday, October 26" },
            { value: "short", label: "Mon, Oct 26" },
            { value: "off", label: "Hidden" },
          ]}
          onChange={(dateStyle) => update("clock", { dateStyle })}
        />
      </Group>
    </>
  );
}

/* ---------------- Goodbye ---------------- */

function GoodbyeSection({ onPreview }: { onPreview: () => void }) {
  const { settings, update } = useSettings();
  return (
    <>
      <p className="panel__intro">Choose Goodbye on the home screen to fade out, show your message, then put the TV in standby.</p>
      <Group label="Message">
        <TextRow label="Message" value={settings.goodbye.message} placeholder="Goodbye." onChange={(message) => update("goodbye", { message })} />
        <TextRow label="Second line" value={settings.goodbye.subtitle} placeholder="See you later." onChange={(subtitle) => update("goodbye", { subtitle })} />
        <StepperRow
          label="Animation length"
          value={settings.goodbye.durationMs / 1000}
          min={2}
          max={10}
          step={0.5}
          format={(v) => `${v.toFixed(1)} s`}
          onChange={(v) => update("goodbye", { durationMs: v * 1000 })}
        />
      </Group>
      <Group label="After the animation">
        <ToggleRow
          label="Put the TV in standby"
          desc="Sends “PowerOff” to the Roku TV over the network (needs the TV's IP address in TV & HDMI)."
          value={settings.goodbye.tvStandby}
          onChange={(tvStandby) => update("goodbye", { tvStandby })}
        />
        <div className="actions">
          <button className="pill pill--small" data-nav onClick={onPreview}>
            Preview animation (TV stays on)
          </button>
        </div>
      </Group>
      <p className="note note--warn">
        <strong>The remote's Power button can't trigger this animation.</strong> On the Fire TV remote, Power is sent straight to the TV (infrared / HDMI-CEC) and
        Android never gives that key to apps, so GrantOS can't intercept it. Use the Goodbye button instead.
      </p>
    </>
  );
}

/* ---------------- TV & HDMI ---------------- */

function TvSection() {
  const { settings, update } = useSettings();
  const platform = usePlatform();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const roku = new RokuClient(platform, settings.roku.ip);

  const test = async () => {
    setBusy(true);
    const { result } = await roku.deviceInfo();
    setBusy(false);
    toast(`${result.message}${result.ok ? "" : result.hint ? ` ${result.hint}` : ""}`, { kind: result.ok ? "success" : "error", simulated: result.simulated });
  };
  const key = async (fn: () => Promise<{ ok: boolean; message: string; hint?: string; simulated: boolean }>) => {
    const r = await fn();
    toast(`${r.message}${!r.ok && r.hint ? ` ${r.hint}` : ""}`, { kind: r.ok ? "success" : "error", simulated: r.simulated });
  };

  return (
    <>
      <p className="panel__intro">
        GrantOS controls the TCL Roku TV with Roku's External Control Protocol over your home network. The Fire Stick and TV must be on the same Wi-Fi.
      </p>
      <Group label="Roku TV">
        <TextRow
          label="Roku TV IP address"
          desc="On the TV: Settings → Network → About. Reserve it in your router so it doesn't change."
          value={settings.roku.ip}
          placeholder="192.168.1.20"
          inputMode="decimal"
          onChange={(ip) => {
            update("roku", { ip });
            if (ip && !isIPv4(ip.trim())) toast("That doesn't look like an IP address (e.g. 192.168.1.20).", { kind: "warn" });
          }}
        />
        <StepperRow label="Fire Stick is on HDMI" value={settings.roku.fireStickInput} min={1} max={4} format={(v) => `HDMI ${v}`} onChange={(fireStickInput) => update("roku", { fireStickInput })} />
        <div className="actions">
          <button className="pill pill--small" data-nav onClick={test} aria-busy={busy}>
            {busy ? "Testing…" : "Test connection"}
          </button>
          <button className="pill pill--small" data-nav onClick={() => key(() => roku.switchToHdmi(settings.ps5.hdmiInput))}>
            Switch to PS5 input (HDMI {settings.ps5.hdmiInput})
          </button>
        </div>
      </Group>
      <p className="note">
        <strong>Required on Roku OS 14.1 and later:</strong> {ROKU_ACCESS_HINT} Otherwise the TV ignores input and power commands.
      </p>
      <p className="note">
        <strong>Make GrantOS the first thing you see:</strong> on the TV, Settings → System → Power → Power On: pick <strong>HDMI {settings.roku.fireStickInput}</strong>{" "}
        (the Fire Stick) if listed, otherwise <strong>Last used TV input</strong>. Also turn on Settings → System → Control other devices (CEC). See docs/DEPLOYMENT.md.
      </p>
    </>
  );
}

/* ---------------- PS5 ---------------- */

function Ps5Section() {
  const { settings, update } = useSettings();
  const platform = usePlatform();
  const toast = useToast();
  const credOk = Boolean(normalizeCredential(settings.ps5.credential));

  const check = async () => {
    const ps5 = new Ps5Client(platform, settings.ps5.ip);
    if (!ps5.configured) return toast("Enter the PS5's IP address first.", { kind: "warn" });
    const st = await ps5.status();
    toast(
      st ? `${st.hostName || "PS5"} answered: ${st.power === "on" ? "on" : st.power === "standby" ? "in Rest Mode" : `code ${st.code}`}.` : `No answer from ${settings.ps5.ip}.`,
      { kind: st ? "success" : "error", simulated: !platform.real.network },
    );
  };

  return (
    <>
      <p className="panel__intro">When you pick the PS5 tile, GrantOS checks the console, wakes it if it can, then switches the TV to the PS5's HDMI input.</p>
      <Group label="Connection">
        <StepperRow label="PS5 is on HDMI" desc="Look at the label on the TV's HDMI port." value={settings.ps5.hdmiInput} min={1} max={4} format={(v) => `HDMI ${v}`} onChange={(hdmiInput) => update("ps5", { hdmiInput })} />
        <ToggleRow label="Switch the TV to the PS5" desc="Uses the Roku TV connection from TV & HDMI." value={settings.ps5.switchInput} onChange={(switchInput) => update("ps5", { switchInput })} />
        <TextRow label="PS5 IP address" desc="PS5: Settings → Network → Connection Status → View Connection Status." value={settings.ps5.ip} placeholder="192.168.1.30" inputMode="decimal" onChange={(ip) => update("ps5", { ip })} />
      </Group>
      <Group label="Wake from Rest Mode">
        <ToggleRow label="Wake over the network" value={settings.ps5.wake} onChange={(wake) => update("ps5", { wake })} />
        <TextRow
          label="Remote Play credential"
          desc={credOk ? "Saved." : "Optional. Without it GrantOS relies on HDMI-CEC to wake the PS5. How to get it: docs/PS5.md."}
          value={settings.ps5.credential}
          secret
          placeholder="Not set"
          onChange={(credential) => update("ps5", { credential })}
        />
        <div className="actions">
          <button className="pill pill--small" data-nav onClick={check}>
            Check PS5 now
          </button>
        </div>
      </Group>
      <p className="note">
        <strong>On the PS5</strong> (Settings → System → Power Saving → Features Available in Rest Mode): turn on <strong>Stay Connected to the Internet</strong> and{" "}
        <strong>Enable Turning On PS5 from Network</strong>. Also Settings → System → HDMI: turn on <strong>Enable HDMI Device Link</strong>.
      </p>
      <p className="note note--warn">
        Switching the TV's input does not guarantee a sleeping PS5 wakes up. Whether HDMI-CEC wakes it depends on the TV; network wake needs the credential. A fully
        powered-off PS5 (not Rest Mode) can only be turned on with its power button or the controller's PS button.
      </p>
    </>
  );
}

/* ---------------- Applications ---------------- */

function AppsSection() {
  const platform = usePlatform();
  const toast = useToast();
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [showAll, setShowAll] = useState<ManagedApp | null>(null);

  const detect = async () => {
    const list = await platform.listApps();
    setApps(list);
    if (!list.length) {
      toast(platform.kind === "desktop" ? "App detection only works on the Fire TV (a computer can't see its apps)." : "No apps found.", { kind: "warn" });
    } else {
      toast(`Found ${list.length} apps${platform.real.apps ? "" : " (simulated list)"}.`, { simulated: !platform.real.apps });
    }
  };

  return (
    <>
      <p className="panel__intro">
        Tiles open apps already installed on the Fire Stick, directly (no Amazon home screen). Package names come from the device itself, never guessed.
      </p>
      <div className="actions">
        <button className="pill pill--small" data-nav onClick={detect}>
          Detect installed apps
        </button>
      </div>
      {(["viu", "youtube"] as ManagedApp[]).map((which) => (
        <AppConfig key={which} which={which} apps={apps} showAll={showAll === which} onShowAll={() => setShowAll(showAll === which ? null : which)} />
      ))}
    </>
  );
}

function AppConfig({ which, apps, showAll, onShowAll }: { which: ManagedApp; apps: InstalledApp[] | null; showAll: boolean; onShowAll: () => void }) {
  const { settings, update } = useSettings();
  const platform = usePlatform();
  const toast = useToast();
  const target = settings.apps[which];
  const name = APP_NAMES[which];
  const set = (t: Partial<AppTarget>) => update("apps", { [which]: { ...target, ...t } } as Partial<typeof settings.apps>);
  const candidates = apps ? findCandidates(apps, which) : [];
  const listed = showAll && apps ? apps : candidates;
  const installed = apps && target.packageName ? apps.some((a) => a.packageName === target.packageName) : null;

  return (
    <Group label={name}>
      <TextRow
        label="Package name"
        desc={installed === null ? undefined : installed ? <span className="status-ok">Installed on this device.</span> : <span className="status-bad">Not found on this device.</span>}
        value={target.packageName}
        placeholder="Detect, or type it"
        onChange={(packageName) => set({ packageName })}
      />
      <TextRow label="Activity (optional)" desc="Leave empty to use the app's own TV entry point." value={target.activity} placeholder="Automatic" onChange={(activity) => set({ activity })} />
      {apps && (
        <div className="actions">
          {listed.map((a) => (
            <button
              key={a.packageName}
              className="pill pill--small"
              data-nav
              onClick={() => {
                set(toTarget(a));
                toast(`${name} will open ${a.label} (${a.packageName}).`, { kind: "success", simulated: !platform.real.apps });
              }}
            >
              Use {a.label}
              <span style={{ opacity: 0.6, fontWeight: 400 }}>{a.packageName}</span>
            </button>
          ))}
          {!listed.length && <span className="row__desc">No app named like “{name}” found.</span>}
          {apps.length > 0 && (
            <button className="pill pill--small pill--quiet" data-nav onClick={onShowAll}>
              {showAll ? "Show matches only" : "Show all apps"}
            </button>
          )}
        </div>
      )}
      <div className="actions">
        <button
          className="pill pill--small"
          data-nav
          onClick={async () => {
            const r = await launchManagedApp(platform, which, target);
            toast(r.message, { kind: r.ok ? "success" : "error", simulated: r.simulated });
          }}
        >
          Test: open {name}
        </button>
        {which === "youtube" && (
          <button className="pill pill--small pill--quiet" data-nav onClick={() => set({ packageName: "com.amazon.firetv.youtube", activity: "" })}>
            Reset to Fire TV YouTube
          </button>
        )}
      </div>
    </Group>
  );
}

/* ---------------- AI ---------------- */

function AiSection() {
  const { settings, update } = useSettings();
  const platform = usePlatform();
  const toast = useToast();
  const [devKey, setDevKey] = useState<boolean | null>(null);
  useEffect(() => {
    if (platform.kind === "desktop") devServerAiStatus().then((s) => setDevKey(Boolean(s?.envKey)));
  }, [platform]);
  const ai = settings.ai;

  const test = async () => {
    try {
      const reply = await createProvider(platform, ai, Boolean(devKey)).reply([{ role: "user", content: "Reply with: GrantOS connected." }]);
      toast(`AI replied: ${reply.slice(0, 160)}`, { kind: "success" });
    } catch (e) {
      toast(`AI test failed: ${(e as Error).message}`, { kind: "error" });
    }
  };

  return (
    <>
      <p className="panel__intro">
        Demo mode is free and works offline, but it is not a real AI. A live AI needs an OpenAI-compatible service: OpenAI and similar services charge per use;
        Ollama or LM Studio on a home computer are free.
      </p>
      <Group label="Provider">
        <ChoiceRow
          label="Assistant"
          value={ai.provider}
          options={[
            { value: "demo", label: "Demo mode (free, offline)" },
            { value: "openai", label: "OpenAI-compatible service" },
          ]}
          onChange={(provider) => update("ai", { provider })}
        />
        {ai.provider === "openai" && (
          <>
            <TextRow
              label="Service address"
              desc="OpenAI: https://api.openai.com/v1 · Ollama on a PC: http://192.168.1.x:11434/v1"
              value={ai.baseUrl}
              inputMode="url"
              onChange={(baseUrl) => update("ai", { baseUrl })}
            />
            <TextRow label="Model" desc="e.g. gpt-4o-mini, or llama3.2 for Ollama." value={ai.model} onChange={(model) => update("ai", { model })} />
            <TextRow
              label="API key"
              desc={
                devKey
                  ? "The desktop dev server has OPENAI_API_KEY set; leave this empty to use it."
                  : "Stored only on this device. Not needed for Ollama. Never put keys in the source code."
              }
              value={ai.apiKey}
              secret
              placeholder="Not set"
              onChange={(apiKey) => update("ai", { apiKey })}
            />
            <div className="actions">
              <button className="pill pill--small" data-nav onClick={test}>
                Test connection
              </button>
              {ai.apiKey && (
                <button className="pill pill--small pill--quiet" data-nav onClick={() => update("ai", { apiKey: "" })}>
                  Remove API key
                </button>
              )}
            </div>
          </>
        )}
      </Group>
      <Group label="Voice">
        <ToggleRow label="Read replies aloud" desc="Uses the device's text-to-speech voice." value={ai.speakReplies} onChange={(speakReplies) => update("ai", { speakReplies })} />
      </Group>
    </>
  );
}

/* ---------------- Startup ---------------- */

function StartupSection() {
  const { settings, update } = useSettings();
  const platform = usePlatform();
  const toast = useToast();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  useEffect(() => {
    platform.deviceInfo().then(setInfo);
  }, [platform]);

  return (
    <>
      <Group label="GrantOS">
        <ToggleRow label="Entrance animation" value={settings.startup.animate} onChange={(animate) => update("startup", { animate })} />
        <ChoiceRow
          label="Open on"
          value={settings.startup.startScreen}
          options={[
            { value: "home", label: "Dashboard" },
            { value: "assistant", label: "AI Assistant" },
          ]}
          onChange={(startScreen) => update("startup", { startScreen })}
        />
      </Group>
      <Group label="Fire TV Home button">
        <Info
          rows={[
            [
              "Home button guard",
              platform.kind !== "android" ? "Only on the Fire TV" : info?.homeGuardEnabled ? <span className="status-ok">On: Home and start-up open GrantOS</span> : <span className="status-warn">Off</span>,
            ],
          ]}
        />
        <p className="note">
          Fire OS doesn't let apps replace Amazon's launcher. GrantOS instead uses an accessibility service that reopens GrantOS whenever Amazon's home screen
          appears (at start-up and when Home is pressed). Amazon's screen may flash briefly. Turn it on with <code>scripts/install.sh</code>, or Fire TV Settings →
          Accessibility.
        </p>
        <div className="actions">
          <button className="pill pill--small" data-nav onClick={async () => !(await platform.openSystemSettings()) && toast("Only available on the Fire TV.", { kind: "warn" })}>
            Open Fire TV settings
          </button>
          <button className="pill pill--small pill--quiet" data-nav onClick={async () => !(await platform.openStockHome()) && toast("Only available on the Fire TV with the guard on.", { kind: "warn" })}>
            Go to Amazon home screen
          </button>
        </div>
      </Group>
    </>
  );
}

/* ---------------- Diagnostics ---------------- */

type Line = [string, ReactNode];

function Diagnostics() {
  const platform = usePlatform();
  const { settings } = useSettings();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: Line[] = [];
    const ok = (t: string) => <span className="status-ok">{t}</span>;
    const bad = (t: string) => <span className="status-bad">{t}</span>;
    const warn = (t: string) => <span className="status-warn">{t}</span>;
    out.push(["Mode", `${platform.label}${platform.real.network ? "" : " · all hardware results are SIMULATED"}`]);
    out.push(["Screen", `${window.innerWidth}×${window.innerHeight} CSS px @ ${window.devicePixelRatio}x`]);
    out.push(["Online", navigator.onLine ? ok("Yes") : bad("No")]);
    const info = await platform.deviceInfo();
    if (info) {
      out.push(["Device", `${info.manufacturer} ${info.model}`]);
      out.push(["Fire OS", info.fireOsVersion || warn("Not readable")]);
      out.push(["Android", `${info.androidVersion} (API ${info.sdkInt})`]);
      out.push(["Device IP", info.ipAddress || warn("Unknown")]);
      out.push(["Home button guard", info.homeGuardEnabled ? ok("On") : warn("Off")]);
      out.push(["Speech recognition", info.speechRecognizer ? ok("Available") : warn("Not available")]);
    }
    const roku = new RokuClient(platform, settings.roku.ip);
    if (!roku.configured) out.push(["Roku TV", warn("IP address not set")]);
    else {
      const { info: r, result } = await roku.deviceInfo();
      out.push(["Roku TV", r ? ok(`${r.model} · Roku OS ${r.softwareVersion} · ${r.powerMode}`) : bad(result.message)]);
    }
    const ps5 = new Ps5Client(platform, settings.ps5.ip);
    if (!ps5.configured) out.push(["PS5", warn("IP address not set")]);
    else {
      const st = await ps5.status();
      out.push(["PS5", st ? ok(`${st.hostName || "PS5"}: ${st.power}`) : bad("No answer (off, or Rest Mode network features off)")]);
    }
    if (platform.real.apps) {
      const apps = await platform.listApps();
      for (const w of ["viu", "youtube"] as ManagedApp[]) {
        const pkg = settings.apps[w].packageName;
        out.push([APP_NAMES[w], !pkg ? warn("Not set up") : apps.some((a) => a.packageName === pkg) ? ok(`Installed (${pkg})`) : bad(`Not installed (${pkg})`)]);
      }
    } else {
      out.push(["Apps", warn("Can only be checked on the Fire TV")]);
    }
    out.push(["AI", settings.ai.provider === "demo" ? "Demo mode (offline)" : `${settings.ai.model} at ${settings.ai.baseUrl}`]);
    out.push(["Web engine", <span style={{ fontSize: "0.95rem" }}>{navigator.userAgent}</span>]);
    setLines(out);
    setRunning(false);
  };

  return (
    <>
      <p className="panel__intro">Checks this device, the Roku TV and the PS5 on your network.</p>
      <div className="actions">
        <button className="pill pill--small" data-nav onClick={run}>
          {running ? "Running…" : lines ? "Run again" : "Run diagnostics"}
        </button>
      </div>
      {lines && <Info rows={lines} />}
    </>
  );
}

/* ---------------- About ---------------- */

function About() {
  const { settings, update, reset } = useSettings();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const rows: [string, string, string][] = [
    ["Dashboard, clock, greeting, settings", "Working", "Runs on the Fire TV and in any browser."],
    ["VIU / YouTube tiles", "Needs device test", "Native launch by package name; VIU's package is detected on the Fire Stick."],
    ["PS5: switch TV input", "Needs device test", "Roku ECP InputHDMI; needs “Control by mobile apps” set to Enabled."],
    ["PS5: wake from Rest Mode", "Needs device test", "Remote Play wake (needs credential) or HDMI-CEC; can't wake a fully-off PS5."],
    ["Goodbye → TV standby", "Needs device test", "Roku ECP PowerOff."],
    ["Remote Power button → Goodbye", "Not possible", "Fire OS never gives the Power key to apps."],
    ["Replace Amazon launcher", "Not possible", "Home button guard redirects to GrantOS instead (Amazon may flash briefly)."],
    ["Voice input on Fire TV", "Likely unavailable", "Fire TV has no speech recognizer for apps; typing works."],
    ["Spoken replies", "Needs device test", "Android text-to-speech."],
  ];
  return (
    <>
      <Info
        rows={[
          ["Version", `GrantOS ${APP_VERSION}`],
          ["Supported devices", "Fire TV on Fire OS 6, 7 or 8 (Android 7.1–11). Not Vega OS sticks (no sideloading)."],
          ["Licence", "MIT. Based on Fire TV Web Launcher (MIT)."],
        ]}
      />
      <table className="compat">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([f, s, n]) => (
            <tr key={f}>
              <td>{f}</td>
              <td className={s === "Working" ? "status-ok" : s === "Not possible" ? "status-bad" : "status-warn"}>{s}</td>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Group label="Advanced">
        <ChoiceRow
          label="Hardware mode"
          desc="Simulated replaces the TV, PS5 and apps with a labelled simulator, for demos."
          value={settings.hardwareMode}
          options={[
            { value: "auto", label: "Automatic" },
            { value: "simulated", label: "Simulated" },
          ]}
          onChange={(hardwareMode) => update("hardwareMode", hardwareMode)}
        />
        <div className="actions">
          <button
            className="pill pill--small pill--danger"
            data-nav
            onClick={() => {
              if (!confirm) return setConfirm(true);
              reset();
              setConfirm(false);
              toast("All settings reset.", { kind: "success" });
            }}
          >
            {confirm ? "Press OK again to reset everything" : "Reset all settings"}
          </button>
        </div>
      </Group>
    </>
  );
}
