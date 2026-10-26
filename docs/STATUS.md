# What works, what's simulated, what's blocked

Status as of the first build (v0.1.0). "Tested" means tested in this repository's automated tests and
headless-browser runs. **Nothing has run on the real TV, Fire Stick or PS5 yet.**

## Functional (tested in the desktop preview and automated tests)

| Feature | How it was checked |
|---|---|
| Dashboard: 4 tiles in order (VIU, PS5, YouTube, AI Assistant), Settings + Goodbye below | Unit test + screenshots at 1920×1080 and 960×540 |
| Remote/keyboard navigation (arrows, OK/Enter, Back/Escape) with visible focus | Playwright drives every screen with keys only (`e2e/smoke.mjs`) |
| Greeting 05:00 / 12:00 / 17:00 boundaries, updates without restart | Unit tests incl. fake clock crossing 11:59 → 12:00 |
| Local date/time, 12/24 h, seconds, date styles | Unit tests |
| Settings: theme, wallpaper (aurora / gradients / custom image + dim), interface size, greeting, clock, Goodbye text and length, HDMI numbers, app packages, AI provider, startup, hardware mode, reset | Screenshots + persistence unit tests (localStorage) |
| Goodbye animation (fade-out, message, ring, fade to black, return on key) | Playwright |
| AI Assistant: chat UI, history for the session, text input, suggestions, clear, demo mode answers | Playwright + unit tests |
| AI provider abstraction (OpenAI-compatible; key from Settings or `OPENAI_API_KEY`) | Unit tests with a fake network (no live API call was made) |
| Android APK builds and is signed | `android/build-apk.sh` here (Ubuntu SDK build-tools 29, platform 23) |
| The Android build's web bundle talks to the native bridge correctly | `e2e/android-bridge.mjs` loads `android/assets/web` at `https://grantos.local/` with a stand-in bridge and checks every call (apps, launch, ECP, UDP) |

## Implemented, needs a device test

| Feature | Mechanism | Risk |
|---|---|---|
| Open VIU / YouTube directly | `getLeanbackLaunchIntentForPackage` / exact activity | Low |
| Detect installed apps (real VIU package) | `PackageManager.queryIntentActivities` | Low |
| Home button + start-up show GrantOS | Accessibility guard (from fire-tv-web-launcher) | Low on Fire OS 8, slower on Fire OS 7, **not on Fire OS 6** |
| Switch TV to PS5 input | Roku ECP `InputHDMIn` from the Fire Stick | Medium: needs *Network access = Enabled* on the TV |
| Goodbye → TV standby | Roku ECP `PowerOff` | Medium: same setting |
| PS5 on/standby check | DDP SRCH, UDP 9302 from 9303 | Medium |
| PS5 wake from Rest Mode | DDP WAKEUP with Remote Play credential | Medium-high: needs a one-time registration ([PS5.md](PS5.md)) |
| Spoken replies | Android TextToSpeech | Low |
| Custom wallpaper from `/sdcard/grantos` | `https://grantos.local/user/…` served by the app | Low |
| Diagnostics (model, Fire OS, API level, IP) | `Build`, `getprop` | Low |
| Interface scaling on the TV's WebView | rem scaling from the 1920×1080 design | Low: tested at 960×540 @2x |

## Simulated (clearly labelled in the app)

- **Desktop preview:** app launches are simulated (a computer can't open Fire TV apps). Roku and PS5 calls are
  **real** if you enter their IPs: the dev server sends them on your home network.
- **Hardware mode = Simulated** (Settings → About): a fake Roku TV, PS5 and app list for demos. Every result
  carries a SIMULATED badge.

## Blocked by the platform (with the workaround used)

| Wanted | Why not | Instead |
|---|---|---|
| Replace the Fire OS home screen | Fire OS ignores third-party launchers without root | Home button guard redirect |
| Remote Power button plays Goodbye | Power goes to the TV via IR/CEC; Android never gives `KEYCODE_POWER` to apps | Goodbye button |
| Wake a fully powered-off PS5 | Only Rest Mode listens to the network | Use Rest Mode; PS button |
| Fire Stick sends HDMI-CEC directly | Needs a system permission | Roku ECP over Wi-Fi; device CEC settings |
| Fire Stick sleeps itself after Goodbye | Needs a system permission | TV standby via ECP; the Fire Stick sleeps on its own timer / via CEC |
| Voice input on Fire TV | No speech recognizer for apps; the remote mic is Alexa's | Typing; desktop preview supports voice |
| GrantOS on Vega OS sticks | No sideloading | Fire OS stick, or any Android TV device |
| A free cloud AI | Hosted LLM APIs are paid | Demo mode, or Ollama/LM Studio on a home PC |

## Not verified here

- The Gradle/Android Studio route was not used: Google's Maven repository isn't reachable from the build
  machine, so the APK is built with the plain SDK tools (`android/build-apk.sh`). CI uses the same script.
- No live OpenAI/Ollama request was made (no key or local server available here).
