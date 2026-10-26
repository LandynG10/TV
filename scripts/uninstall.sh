#!/bin/sh
# Removes GrantOS and its Home button guard. The Amazon home screen works as before;
# no other app or setting is changed.
# Usage: scripts/uninstall.sh <fire-tv-ip>
set -e
. "$(dirname "$0")/common.sh"
connect_tv "$1"
current=$(tv_shell settings get secure enabled_accessibility_services)
cleaned=$(echo "$current" | tr ':' '\n' | grep -v "^$GUARD$" | paste -sd: -)
if [ -z "$cleaned" ] || [ "$cleaned" = null ]; then
  tv_shell settings delete secure enabled_accessibility_services >/dev/null
else
  tv_shell settings put secure enabled_accessibility_services "$cleaned"
fi
adb -s "$TV" uninstall $PKG || true
tv_shell rm -rf /sdcard/grantos
echo "GrantOS removed. Press Home on the remote for the Amazon home screen."
