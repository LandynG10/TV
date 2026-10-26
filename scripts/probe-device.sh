#!/bin/sh
# Read-only. Collects everything GrantOS needs to know about the Fire TV and saves it to
# hardware-report.txt: model, Fire OS, Android API level, and the real package + launch
# activity of VIU and YouTube. Changes nothing on the device.
# Usage: scripts/probe-device.sh <fire-tv-ip>
set -e
. "$(dirname "$0")/common.sh"
connect_tv "$1"
REPORT="$ROOT/hardware-report.txt"

resolve() { # package -> launchable activity (TV entry point first)
  a=$(tv_shell cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER "$1" 2>/dev/null | tail -1)
  case "$a" in */*) echo "$a" ;; *) tv_shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER "$1" 2>/dev/null | tail -1 ;; esac
}

{
  echo "GrantOS hardware report — $(date)"
  echo
  echo "== Fire TV"
  echo "Model code:        $(tv_shell getprop ro.product.model)   (common codes: AFTKA = 4K Max 1st gen, AFTKM = 4K 2nd gen, AFTMM = 4K 1st gen, AFTKRT = 4K Max 2nd gen)"
  echo "Manufacturer:      $(tv_shell getprop ro.product.manufacturer)"
  echo "Fire OS:           $(tv_shell getprop ro.build.version.name)"
  echo "Android version:   $(tv_shell getprop ro.build.version.release)"
  echo "API level:         $(tv_shell getprop ro.build.version.sdk)"
  echo "Build:             $(tv_shell getprop ro.build.display.id)"
  echo "Wi-Fi IP:          $(tv_shell ip -4 addr show wlan0 2>/dev/null | sed -n 's/.*inet \([0-9.]*\).*/\1/p')"
  echo "Resolution:        $(tv_shell wm size | tail -1)"
  echo "Accessibility svc: $(tv_shell settings get secure enabled_accessibility_services)"
  echo
  echo "== Apps (package -> launch activity)"
  for pkg in $(tv_shell pm list packages | sed 's/^package://' | grep -i -E 'viu|youtube' | sort); do
    echo "$pkg -> $(resolve "$pkg")"
  done
  echo
  echo "== GrantOS"
  tv_shell dumpsys package $PKG 2>/dev/null | grep -m1 versionName || echo "not installed"
} | tee "$REPORT"
echo
echo "Saved to $REPORT. Put the VIU / YouTube lines into GrantOS Settings > Applications (or use Detect there)."
