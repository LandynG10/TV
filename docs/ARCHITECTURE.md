# Architecture

```
            ┌──────────────────────── TCL Roku TV ────────────────────────┐
  power on  │  HDMI 1: Fire TV Stick ──► GrantOS (what you see)           │
  ────────► │  HDMI 2: PS5                                                │
            │  ECP :8060  ◄── HTTP ──┐                                    │
            └────────────────────────┼────────────────────────────────────┘
                                     │  (home Wi-Fi)
┌──────────── Fire TV Stick (Fire OS) ┼───────────────────────┐        ┌──── PS5 ────┐
│ GrantOS APK (com.grantos.tv)        │                       │  UDP   │ DDP :9302   │
│  ┌──────────────────────────────┐   │                       │ ─────► │ (Rest Mode) │
│  │ React + TypeScript UI         │  │                       │        └─────────────┘
│  │ (web/ → android/assets/web)   │  │                       │
│  └──────────────┬───────────────┘   │                       │
│        window.GrantOSNative (async JSON bridge)             │
│  ┌──────────────┴───────────────────┴─────────────┐         │
│  │ Java: MainActivity (WebView), WebAssets,        │         │
│  │ NativeBridge (apps, http, udp, tts, voice,      │ ──────► VIU / YouTube (startActivity)
│  │ device info), HomeGuardService (accessibility)  │         │
│  └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

## Layers (web/src)

| Folder | Responsibility | Platform-specific? |
|---|---|---|
| `platform/` | One `Platform` interface: list/launch apps, HTTP, UDP, device info, speech. Three implementations: `android.ts` (native bridge), `desktop.ts` (Vite dev server), `simulated.ts` (fake hardware). `index.ts` picks one. | Yes, only here |
| `services/` | Pure logic on top of `Platform`: Roku ECP client, PS5 DDP client, the PS5 flow, app resolution/launch, TV standby. | No |
| `ai/` | `AiProvider` interface; offline demo provider; OpenAI-compatible provider. | No |
| `lib/` | Settings schema + validation + storage, greeting, time formatting, clock hook, spatial navigation, remote key handling, stage scaling. | No |
| `screens/`, `components/` | React UI. | No |

Because services only depend on the `Platform` interface, they're unit-tested with a fake platform
(`src/test/fakePlatform.ts`) and behave identically on the TV and in the desktop preview.

## Native bridge protocol

`window.GrantOSNative.call(id, method, argsJson)` returns immediately; Java runs the work on a thread pool
and answers with `window.__grantosNativeResult(id, resultJson)`. Methods: `listApps`, `launchApp`, `http`,
`udp`, `deviceInfo`, `speak`, `stopSpeaking`, `voiceAvailable`, `listen`, `openSystemSettings`,
`openStockHome`. The shell also calls `window.grantos.onBack/onHome/onShow/onHide`.

Safety limits in the bridge: plain HTTP and UDP only to private (home network) addresses; HTTPS anywhere
(for an online AI provider). The page is only ever loaded from `https://grantos.local/` (the APK's own files) or
a home-network dev server you set explicitly with `scripts/dev-url.sh`.

## Remote control

The WebView turns D-pad presses into arrow-key events but doesn't move focus. `lib/spatialNav.ts` picks the
nearest focusable element (`[data-nav]`) in the pressed direction, preferring straight lines, with explicit
overrides (`data-nav-up="#id"`) where the geometry is ambiguous. Overlays add their own `[data-nav-root]`,
which traps focus. Back is intercepted natively so the launcher never closes.

## Layout scaling

Everything is designed on a 1920×1080 canvas in `rem`; `useStageScale` sets the root font size from the
actual viewport (`16px × min(w/1920, h/1080) × user scale`). A Fire TV WebView reporting 960×540 CSS px
renders the same layout at 8px/rem.

## Settings

`lib/settings.ts` defines the schema and defaults and validates anything read back (bad or old values are
repaired, never crash). Saved in WebView `localStorage` (app-private storage on the Fire Stick).
