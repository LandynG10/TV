# Installing GrantOS on your TV

About 30 minutes, once. Everything is reversible (`scripts/uninstall.sh`), nothing is rooted, no firmware is
changed, and no Amazon packages are disabled. VIU, YouTube and their data are left alone.

You need: the TCL Roku TV, the Fire TV Stick, a computer (Windows, Mac or Linux) on the **same Wi-Fi**.

## 0. Check the Fire Stick can run GrantOS

On the Fire Stick: *Settings → My Fire TV → About*.

- It must say **Fire OS 6, 7 or 8**. If it says **Vega OS** (e.g. *Fire TV Stick 4K Select*), sideloading isn't
  supported and GrantOS can't be installed. See "If your stick runs Vega OS" at the end.
- Write down the **device name / model** and **Fire OS version** (see [HARDWARE-CHECKLIST.md](HARDWARE-CHECKLIST.md)).

## 1. Turn on ADB debugging on the Fire Stick

1. *Settings → My Fire TV → About*: select the device name **7 times** until it says you're a developer.
2. Back to *My Fire TV → Developer Options*: turn on **ADB Debugging**.
   (If you also see *Apps from Unknown Sources*, it's not needed for ADB installs.)
3. *Settings → My Fire TV → About → Network*: write down the Fire Stick's **IP address**.

## 2. Install ADB on the computer

- **Windows:** download "SDK Platform-Tools for Windows" from
  <https://developer.android.com/tools/releases/platform-tools>, unzip, open a terminal in that folder.
  (Run the `.sh` scripts below from **Git Bash** or **WSL**, or type the `adb` commands from
  `scripts/install.sh` by hand.)
- **Mac:** `brew install android-platform-tools`
- **Linux:** `sudo apt install adb`

## 3. Get GrantOS

```sh
git clone https://github.com/landyng10/tv.git && cd tv
```

The ready-built APK is `release/GrantOS.apk`. To build it yourself instead, see [DEVELOPMENT.md](DEVELOPMENT.md).

## 4. Look at the Fire Stick first (read-only)

```sh
scripts/probe-device.sh <fire-stick-ip>
```

The first time, the TV shows **"Allow USB debugging?"**: tick *Always allow* and choose **OK**, then run the
command again. This saves `hardware-report.txt` with the model, Fire OS version, API level and the **real
VIU and YouTube package names**. Nothing is changed.

## 5. Install

```sh
scripts/install.sh <fire-stick-ip>
```

This installs GrantOS, turns on its **Home button guard** (an accessibility service that brings GrantOS back
whenever the Amazon home screen appears, including at start-up) and opens it. Run the same command again to
update; settings are kept. `--no-guard` skips the guard.

On **Fire OS 7** the Home button may take 1–5 seconds to show GrantOS (an Android 9 limit, documented by
home-on-fire). Fire OS 8 is instant. Amazon's home screen can flash briefly in both.

## 6. Set up GrantOS on the TV (with the remote)

Open *Settings* (below the four tiles):

1. **Applications → Detect installed apps** → choose *Use Viu* and *Use YouTube*. Then *Test: open VIU*.
2. **TV & HDMI** → enter the Roku TV's IP address (*TV: Settings → Network → About*) and the Fire Stick's HDMI
   number → *Test connection*.
3. **PlayStation 5** → set the PS5's HDMI number and IP → *Check PS5 now*. See [PS5.md](PS5.md).
4. **Clock & greeting**, **Appearance**, **Goodbye**: to taste.

## 7. Set up the Roku TV

- *Settings → System → Advanced system settings → Control by mobile apps → Network access* → **Enabled**.
  Required for input switching and Goodbye → standby (Roku OS 14.1+).
- *Settings → System → Power → Power On* → the Fire Stick's input (**HDMI _n_**) if your TV lists inputs,
  otherwise **Last used TV input**. The TV then starts on GrantOS.
- *Settings → System → Control other devices (CEC)* → turn on **System standby** / **System power on**
  (names vary slightly by Roku OS version).
- On the Fire Stick: *Settings → Display & Sounds → HDMI CEC Device Control* → **On**.

Reserve the IP addresses of the TV, Fire Stick and PS5 in your router, so the settings keep working.

## 8. Check it works

Go through [HARDWARE-CHECKLIST.md](HARDWARE-CHECKLIST.md) part B ("Tests to run on the real devices"), and
*Settings → Diagnostics → Run diagnostics* on the TV.

## Undo everything

```sh
scripts/uninstall.sh <fire-stick-ip>
```

Removes GrantOS and turns its guard off. The Amazon home screen works as before. Roku and PS5 settings you
changed by hand can be switched back the same way.

## If your stick runs Vega OS

GrantOS can't be installed there. The cheapest options:
1. Install the same APK on any Android TV / Google TV device you already own (the Home guard is Fire-specific, but the app works).
2. A used Fire TV Stick 4K / 4K Max on **Fire OS** (often ~$15–25 second-hand).
3. Run the desktop preview (`npm run dev`) on a laptop connected to the TV over HDMI; Roku and PS5
   control work from there through the dev server.
