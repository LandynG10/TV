# Development

## Desktop preview

Needs Node.js 20+.

```sh
cd web
npm install
npm run dev            # http://localhost:5173
```

Keyboard = remote: arrows move, Enter = OK, Escape/Backspace = Back.

The top-right badge says which mode you're in:
- **Desktop preview** — the dev server is running. Roku TV and PS5 commands are **real** (sent on your home
  network) once you enter their IPs in Settings. App launches are simulated.
- **Simulated hardware** — everything is faked (Settings → About & compatibility → Hardware mode), or the page
  was opened without the dev server.

Live AI in the preview without typing the key into the page:

```sh
OPENAI_API_KEY=sk-... npm run dev                                         # OpenAI (paid)
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_MODEL=llama3.2 npm run dev # Ollama (free, local)
```

then Settings → AI Assistant → *OpenAI-compatible service*.

## Tests

```sh
npm test                 # 81 unit tests (Vitest): greeting, clock, settings, navigation, Roku, PS5, apps, AI
npm run typecheck
npm run dev &            # then, in another terminal:
npm run e2e              # drives every screen with the keyboard at 1920×1080, saves e2e/screenshots/
npm run build:android && node e2e/android-bridge.mjs   # the APK's bundle against a stand-in Java bridge
```

The e2e scripts use Playwright (`npm i -D playwright && npx playwright install chromium` if you don't have it).

## Building the APK

```sh
android/build-apk.sh        # builds web → android/assets/web, then android/build/GrantOS.apk
```

Uses the plain Android SDK tools, no Gradle: set `ANDROID_HOME` to an SDK with build-tools and a platform
(23 or newer). On Ubuntu: `sudo apt install android-sdk-build-tools android-sdk-platform-23 apksigner zipalign`.
GitHub Actions builds the same APK on every push (`.github/workflows/build.yml`, artifact *GrantOS-apk*).

Signing uses `android/grantos-sideload.jks` (password `grantos-sideload`). It's in the repository on purpose so
every build can update the installed app; it's a personal sideload key, not a secret. For a store release,
make your own key.

## Live editing on the TV

```sh
cd web && npm run dev                                   # note your computer's IP
scripts/dev-url.sh <fire-stick-ip> http://<computer-ip>:5173/
# ...edit files: the TV reloads instantly, with the real native bridge...
scripts/dev-url.sh <fire-stick-ip> off
```

Debug the page on the TV from Chrome on the computer: `chrome://inspect` (with ADB connected).

## Project layout

```
web/                 React + TypeScript interface, tests, dev server plugin (devserver/)
android/             Java shell (src/), manifest, resources, build-apk.sh, assets/web (built UI)
scripts/             ADB helpers: probe-device, install, uninstall, push-wallpaper, dev-url, roku-probe
release/GrantOS.apk  Pre-built APK
docs/                Research, architecture, deployment, PS5, status, hardware checklist
```
