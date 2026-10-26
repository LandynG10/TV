# Hardware checklist

## A. Information needed from your devices

Most of this is collected automatically by `scripts/probe-device.sh` (Fire Stick) and
`scripts/roku-probe.sh` (TV). Fill in the rest.

### Fire TV Stick
| Item | Where to find it | Value |
|---|---|---|
| Model (e.g. Fire TV Stick 4K, 2nd gen) and model code (e.g. AFTKM) | *Settings → My Fire TV → About*, or probe script | |
| OS: **Fire OS** 6/7/8, or **Vega OS** (Vega = can't sideload) | *About → Fire TV Stick* / probe script | |
| Fire OS version (e.g. 8.1.1.2) | probe script | |
| Android API level (25 = Fire OS 6, 28 = Fire OS 7, 30 = Fire OS 8) | probe script | |
| ADB Debugging can be turned on | *Developer Options* | yes / no |
| IP address | *About → Network* | |
| HDMI port it's plugged into on the TV | label on the TV port | HDMI __ |
| VIU package → activity | probe script, "Apps" section | |
| YouTube package → activity | probe script | |

### TCL Roku TV
| Item | Where | Value |
|---|---|---|
| Model (e.g. 65S455) | *Settings → System → About*, or `scripts/roku-probe.sh <ip>` | |
| Roku OS version | same | |
| IP address | *Settings → Network → About* | |
| Control by mobile apps → Network access | *Settings → System → Advanced system settings* | must be **Enabled** |
| Power On options available (list of inputs?) | *Settings → System → Power* | |
| CEC options (System standby / power on) | *Settings → System → Control other devices (CEC)* | |

### PlayStation 5
| Item | Where | Value |
|---|---|---|
| HDMI port on the TV | label on the TV port | HDMI __ |
| IP address | *Settings → Network → Connection Status* | |
| System software version | *Settings → System → System Software* | |
| Rest Mode: Stay Connected to the Internet | *Settings → System → Power Saving* | On |
| Rest Mode: Enable Turning On PS5 from Network | same | On |
| HDMI Device Link / One-Touch Play | *Settings → System → HDMI* | On |
| Remote Play credential (optional) | [PS5.md](PS5.md) | |

## B. Tests to run on the real devices

Nothing below has been run on your hardware yet. Tick each one when you've tried it.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Turn the TV on | TV starts on the Fire Stick's input, GrantOS shows (Amazon home may flash first) | |
| 2 | Press Home on the remote from inside VIU | Back to GrantOS | |
| 3 | Arrows / OK / Back on the dashboard | Focus moves between the four tiles, Settings and Goodbye; OK opens; Back returns | |
| 4 | Greeting and clock | Correct local time; greeting matches morning/afternoon/evening | |
| 5 | VIU tile | VIU opens directly (no Amazon home) | |
| 6 | YouTube tile | YouTube opens directly | |
| 7 | Settings → TV & HDMI → Test connection | "Found <your TV model>" | |
| 8 | PS5 tile with PS5 **on** | "Already on", TV switches to the PS5 input | |
| 9 | PS5 tile with PS5 in **Rest Mode**, no credential | TV switches input; note whether the PS5 wakes by itself (CEC) | |
| 10 | PS5 tile in Rest Mode **with** credential | "PS5 is awake", TV switches input | |
| 11 | Goodbye | Fade, message, ring, then the TV turns off | |
| 12 | Turn the TV back on after Goodbye | GrantOS dashboard (not the black Goodbye screen) | |
| 13 | AI Assistant, demo mode | Answers time/date/maths; type with the on-screen keyboard | |
| 14 | AI Assistant, speaker button on | Replies are read aloud | |
| 15 | AI Assistant, mic button | Expected: "Voice input isn't available" (confirms the Fire OS limit) | |
| 16 | Settings persist | Change the theme, unplug the Fire Stick, plug back in: theme kept | |
| 17 | Settings → Diagnostics | Device, Fire OS, Roku and PS5 rows filled in | |
| 18 | Text fits the screen | No edges cut off; otherwise Appearance → Interface size 95% / 90% | |

Report back the results (or `hardware-report.txt` + a photo of any problem), and the remaining issues can be
fixed precisely.
