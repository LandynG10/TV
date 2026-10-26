# Research and decisions

What was checked, what was found, and what GrantOS does about it. Everything marked
**verified** was confirmed from source code or official documentation; **needs device test**
means it is implemented but cannot be confirmed until it runs on your TV, Fire Stick and PS5.

## 1. The three GitHub projects

All three were cloned and read in full before anything was reused (October 2026).

| | [pickdani/fire-tv-web-launcher](https://github.com/pickdani/fire-tv-web-launcher) | [erickmenezes/fire-tv-cleanup](https://github.com/erickmenezes/fire-tv-cleanup) | [toolicious/home-on-fire](https://github.com/toolicious/home-on-fire) |
|---|---|---|---|
| Licence | MIT | MIT | **GPL-3.0** |
| What it is | Kotlin app whose home screen is a **web page** in a WebView, plus a Home-button accessibility guard and ADB scripts | Native Java "dock" launcher + debloat lists + a prompt for AI assistants | Accessibility service that redirects the Home button to any launcher |
| Last activity | Oct 2026 (active) | Oct 2026 (active) | Sep 2026, release 1.5.2 (active) |
| Tested on | Fire OS 8.1 | Fire OS 8 (Hisense Fire TV Edition) | Fire OS 7.7 and 8.1 |
| Build | Gradle 8.9, AGP 8.5, JDK 21 | Gradle, SDK 34 | Its own script |
| Fit for GrantOS | **Best**: the UI is HTML/JS, so a React/TypeScript dashboard drops straight in | Native UI would need to be rewritten; debloat lists are optional | Good idea, but GPL-3.0 would force GrantOS to be GPL, and it's a redirector, not a UI |

**Decision:** GrantOS is built on the architecture of **fire-tv-web-launcher** (MIT). The pieces reused
(adapted and credited in the source) are the WebView host with a custom `https://<host>/` origin, the
Home-button guard service, and the ADB install approach that re-enables the guard after updates.
Everything else (the React UI, the native bridge, Roku/PS5 control, AI, settings) is new.

**Not reused, on purpose:**
- The debloat scripts from fire-tv-web-launcher and fire-tv-cleanup. They disable Amazon packages; you asked not
  to disable OS services, and GrantOS doesn't need it. Nothing in this project disables any package.
- home-on-fire's code (GPL-3.0). Its README was used as research: it documents that Fire OS 8 ignores
  default-launcher settings, that Fire OS 7 delays Home-triggered launches by up to 5 s, and that Fire OS 6
  doesn't support the redirect at all.

## 2. Platform choice

| Option | Verdict |
|---|---|
| **GrantOS as an app on the Fire Stick + TV powers on to the Fire Stick's HDMI input** | **Chosen.** Free, no rooting, sideloading supported on Fire OS sticks, full Android APIs for launching VIU/YouTube. |
| Replace the Fire OS launcher | **Not possible** without root: Fire OS ignores third-party HOME activities and the Sept 2025 patch closed the old workarounds. GrantOS uses the accessibility "Home guard" redirect instead (Amazon's screen can flash for a moment). |
| Native Roku channel (BrightScript) talking to a Fire Stick companion | **Feasible but worse.** A sideloaded developer channel is free, but a Roku channel cannot launch Android apps, cannot change TV inputs from inside a channel, and the Fire Stick picture still needs the TV on its HDMI input. You'd juggle two apps for no gain. Not built. |
| Raspberry Pi / Android TV box as the hub | Works, but costs money. Only worth it if your Fire Stick turns out to be a Vega OS model (below). |

### Important: check the Fire Stick isn't running Vega OS
Amazon's **Fire TV Stick 4K Select** (Oct 2025) and newer sticks run **Vega OS** (Linux/React Native,
not Android). **Sideloading isn't supported there**, so GrantOS can't be installed. "Fire TV Stick 4K",
"4K Max" and "4K Plus" models on Fire OS are fine. Check *Settings → My Fire TV → About*: it must say
**Fire OS** 6, 7 or 8. `scripts/probe-device.sh` reports it too.

## 3. App launching (VIU, YouTube)

- **Verified (Android API):** `PackageManager.getLeanbackLaunchIntentForPackage(pkg)` returns the app's TV entry
  point; `startActivity` with it opens the app directly, without the Amazon home screen. GrantOS falls back to
  `getLaunchIntentForPackage`, or uses an exact activity if one is configured.
- **VIU's package is not guessed.** Settings → Applications → *Detect installed apps* lists the apps on the
  Fire Stick by their visible name and stores the real package and activity. `scripts/probe-device.sh` does the
  same over ADB.
- **YouTube** on Fire TV is `com.amazon.firetv.youtube` (it's the package used in fire-tv-web-launcher's config).
  It's the default, and detection confirms or replaces it on your device.
- Launching never modifies or reinstalls the apps; their data stays intact.

## 4. PS5 and the TV

### Roku External Control Protocol (ECP)
- HTTP on port 8060 of the TV. `POST /keypress/InputHDMI2` switches input, `POST /keypress/PowerOff` turns the
  TV off, `GET /query/device-info` reports model, Roku OS version and power mode. (Roku ECP documentation.)
- **Restriction (verified from Roku's docs/support pages):** since Roku OS 14.1, keypress commands need
  *Settings → System → Advanced system settings → Control by mobile apps → Network access* = **Enabled**.
  Roku OS 14.1.4 made **Limited** the default on some TVs, which blocks them. GrantOS shows this fix whenever
  the TV answers 401/403.
- ECP has no CORS headers, so a web page can't call it directly. On the Fire TV the Java bridge makes the
  request; in the desktop preview the Vite dev server does.
- **Needs device test:** InputHDMI and PowerOff on your specific TCL model and Roku OS version.

### HDMI-CEC
- The Fire Stick and Roku TV both support CEC, but a sideloaded Android app **cannot send CEC commands**
  (Android's `HdmiControlManager` needs a system permission). GrantOS doesn't attempt it.
- What CEC can still do for you, configured on the devices:
  - Fire Stick *Settings → Display & Sounds → HDMI CEC Device Control: On* — waking the Fire Stick turns the TV
    on and switches to it.
  - TV *Settings → System → Control other devices (CEC)* — enables the TV side.

### PS5 HDMI Device Link
- PS5 *Settings → System → HDMI → Enable HDMI Device Link* (and *Enable One-Touch Play*) lets the PS5 turn on
  the TV and switch to itself when the PS5 is turned on.
- Whether **switching the TV to the PS5's input wakes a PS5 in Rest Mode** depends on the TV's CEC
  implementation. **Not assumed.** GrantOS treats it as a possible bonus, never as confirmation.

### PS5 Rest Mode wake over the network
- **Verified from source (pyremoteplay):** Remote Play apps find a console with a UDP "SRCH" packet to port
  **9302** (sent from port 9303 for PS5), and wake it with a "WAKEUP" packet containing a `user-credential`.
  Replies: `HTTP/1.1 200 Ok` = on, `620 Server Standby` = Rest Mode.
- The credential comes from registering a Remote Play client with the console once (needs your PSN login and a
  PIN from the PS5). See [PS5.md](PS5.md). Without it, GrantOS can still *check* the PS5 but not wake it.
- Requires PS5 *Settings → System → Power Saving → Features Available in Rest Mode*: **Stay Connected to the
  Internet** and **Enable Turning On PS5 from Network**.
- A PS5 that is fully **off** (not Rest Mode) cannot be woken by anything except its power button or the
  controller's PS button.
- **Needs device test.**

### Is a helper device needed?
No. The Fire Stick itself sends the ECP and DDP packets. A computer is only needed once, for ADB install and
(optionally) the PS5 credential.

## 5. Goodbye and the Power button

- **TV standby:** Roku ECP `PowerOff` (needs the Network access setting above). **Needs device test.**
- A sideloaded app cannot put the Fire Stick itself to sleep (`goToSleep` / key injection need system
  permissions).
- **The remote's Power button cannot trigger the Goodbye animation.** On Fire TV remotes the Power button
  sends IR/CEC straight to the TV, and Android never delivers `KEYCODE_POWER` to apps. Documented in the app;
  the Goodbye button is the supported route.

## 6. AI assistant

- Default is **Demo mode**: offline, rule-based, free, and clearly labelled as not a real AI.
- Live mode uses any **OpenAI-compatible Chat Completions** API. OpenAI and similar services are paid per use.
  **Free options:** [Ollama](https://ollama.com) or LM Studio on a home computer
  (`http://<pc-ip>:11434/v1`), which the Fire Stick can reach on your network.
- Keys are never in the code: entered on the TV (stored on the device only) or, for the desktop preview,
  read from `OPENAI_API_KEY` by the dev server (never sent to the browser).
- **Voice input:** the Fire TV remote's mic is reserved for Alexa, and Fire OS generally has no
  `SpeechRecognizer` service for apps. GrantOS checks at runtime and says so; typing (on-screen keyboard)
  always works. In the desktop preview, Chrome/Edge speech recognition works.
- **Spoken replies:** Android `TextToSpeech`, available on Fire OS. **Needs device test.**

## Sources
- Repositories listed above (source read directly).
- Roku: [External Control Protocol](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md), [Control by mobile apps (support)](https://support.roku.com/article/217288467), [openHAB note on 14.1.4 default change](https://community.openhab.org/t/roku-firmware-update-requires-configuration-change/160938).
- Vega OS / sideloading: [AFTVnews](https://www.aftvnews.com/tag/vega-os/page/2/), [Android Authority](https://www.androidauthority.com/amazon-fire-tv-os-vega-os-explanation-3615880), home-on-fire README.
- PS5 Remote Play / DDP: [ktnrg45/pyremoteplay](https://github.com/ktnrg45/pyremoteplay) (`ddp.py`, `util.py`), [Remote Play rest-mode settings](https://content.nexus.support.com/how-to/remote-play-ps5).
