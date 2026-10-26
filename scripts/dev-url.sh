#!/bin/sh
# Points GrantOS on the Fire TV at `npm run dev` on your computer, so edits show on the TV
# instantly and the real native bridge is used. "off" goes back to the built-in interface.
# Usage: scripts/dev-url.sh <fire-tv-ip> http://<computer-ip>:5173/   |   scripts/dev-url.sh <fire-tv-ip> off
set -e
. "$(dirname "$0")/common.sh"
connect_tv "$1"
if [ "${2:-}" = off ] || [ -z "${2:-}" ]; then
  tv_shell rm -f /sdcard/grantos/dev-url.txt
else
  tv_shell mkdir -p /sdcard/grantos
  tv_shell "echo '$2' > /sdcard/grantos/dev-url.txt"
fi
tv_shell am start -n $PKG/.MainActivity --ez reload true >/dev/null
echo "Reloaded GrantOS on the TV."
