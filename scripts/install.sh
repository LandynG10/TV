#!/bin/sh
# Installs (or updates) GrantOS on the Fire TV, keeping its settings, and turns on the
# Home button guard so GrantOS opens at start-up and on Home. Other apps are not touched.
# Usage: scripts/install.sh <fire-tv-ip> [--no-guard] [--apk path]
set -e
. "$(dirname "$0")/common.sh"
IP="$1"; shift || true
GUARD_ON=1
APK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-guard) GUARD_ON=0 ;;
    --apk) APK="$2"; shift ;;
  esac
  shift
done
connect_tv "$IP"

SDK=$(tv_shell getprop ro.build.version.sdk)
if [ "${SDK:-0}" -lt 22 ]; then
  echo "This Fire TV reports API level $SDK. GrantOS needs Fire OS 5 or newer (API 22+)." >&2
  exit 1
fi

if [ -z "$APK" ]; then
  if [ -f "$ROOT/android/build/GrantOS.apk" ]; then APK="$ROOT/android/build/GrantOS.apk"
  elif [ -f "$ROOT/release/GrantOS.apk" ]; then APK="$ROOT/release/GrantOS.apk"
  else "$ROOT/android/build-apk.sh" && APK="$ROOT/android/build/GrantOS.apk"; fi
fi
echo "Installing $APK"
adb -s "$TV" install -r "$APK"
tv_shell pm grant $PKG android.permission.READ_EXTERNAL_STORAGE 2>/dev/null || true
tv_shell mkdir -p /sdcard/grantos

if [ "$GUARD_ON" = 1 ]; then
  # Android turns the accessibility service off while it finishes an update, so set it, wait, check.
  for attempt in 1 2 3 4 5; do
    sleep 3
    current=$(tv_shell settings get secure enabled_accessibility_services)
    case "$current" in
      *"$GUARD"*) ;;
      "" | null) tv_shell settings put secure enabled_accessibility_services "$GUARD" ;;
      *) tv_shell settings put secure enabled_accessibility_services "$current:$GUARD" ;;
    esac
    tv_shell settings put secure accessibility_enabled 1
    sleep 2
    if tv_shell dumpsys accessibility | grep -q "HomeGuardService"; then
      echo "Home button guard: on"
      break
    fi
    [ "$attempt" = 5 ] && echo "Warning: the Home button guard did not start. Run this script again, or turn it on in Fire TV Settings > Accessibility." >&2
  done
fi

tv_shell am start -n $PKG/.MainActivity >/dev/null
echo "GrantOS is open on the TV."
