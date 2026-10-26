#!/bin/sh
# Copies a photo to the Fire TV for GrantOS's custom wallpaper.
# Then in GrantOS: Settings > Appearance > Wallpaper: Custom image,
# address https://grantos.local/user/wallpaper.jpg
# Usage: scripts/push-wallpaper.sh <fire-tv-ip> <photo.jpg>
set -e
. "$(dirname "$0")/common.sh"
[ -f "${2:-}" ] || { echo "Usage: $0 <fire-tv-ip> <photo.jpg>" >&2; exit 1; }
connect_tv "$1"
tv_shell mkdir -p /sdcard/grantos
adb -s "$TV" push "$2" /sdcard/grantos/wallpaper.jpg
tv_shell pm grant $PKG android.permission.READ_EXTERNAL_STORAGE 2>/dev/null || true
echo "Wallpaper copied. Use https://grantos.local/user/wallpaper.jpg in Settings > Appearance."
