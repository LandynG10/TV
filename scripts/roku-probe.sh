#!/bin/sh
# Read-only check of the Roku TV's External Control Protocol from any computer on the same Wi-Fi.
# Shows the model, Roku OS version and power mode, and whether key commands are allowed.
# Usage: scripts/roku-probe.sh <roku-tv-ip> [--test-input N]
#   --test-input N   also switches the TV to HDMI N (a visible change, to prove control works)
set -e
IP="${1:?Usage: $0 <roku-tv-ip> [--test-input N]}"
echo "== device-info"
INFO=$(curl -s --max-time 5 "http://$IP:8060/query/device-info") || { echo "No answer from $IP:8060. Check the IP and that the TV is on the same network." >&2; exit 1; }
for tag in vendor-name model-name model-number software-version power-mode is-tv supports-suspend; do
  printf '%-18s %s\n' "$tag:" "$(echo "$INFO" | sed -n "s:.*<$tag>\(.*\)</$tag>.*:\1:p")"
done
if [ "${2:-}" = "--test-input" ]; then
  N="${3:?give an HDMI number}"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "http://$IP:8060/keypress/InputHDMI$N")
  echo "keypress InputHDMI$N -> HTTP $CODE"
  case "$CODE" in
    200) echo "Key commands work." ;;
    401|403) echo "Blocked. On the TV: Settings > System > Advanced system settings > Control by mobile apps > Network access > Enabled." ;;
  esac
fi
