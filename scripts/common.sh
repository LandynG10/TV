# Shared by the scripts in scripts/. Not meant to be run by itself.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG=com.grantos.tv
GUARD=com.grantos.tv/com.grantos.tv.HomeGuardService

# Connects to the Fire TV at $1 (or $FIRETV_IP). Sets $TV for tv_shell.
connect_tv() {
  ip="${1:-${FIRETV_IP:-}}"
  if [ -z "$ip" ]; then
    echo "Give the Fire TV's IP address: $0 <fire-tv-ip>   (or set FIRETV_IP)" >&2
    echo "Find it on the Fire TV: Settings > My Fire TV > About > Network." >&2
    exit 1
  fi
  command -v adb >/dev/null || { echo "adb not found. Install Android platform-tools (see docs/DEPLOYMENT.md)." >&2; exit 1; }
  TV="$ip:5555"
  adb connect "$TV" >/dev/null
  if [ "$(adb -s "$TV" get-state 2>/dev/null)" != device ]; then
    echo "Cannot reach $TV. On the Fire TV turn on Developer Options > ADB Debugging," >&2
    echo "then accept the 'Allow USB debugging?' prompt on the TV and run this again." >&2
    exit 1
  fi
}

tv_shell() {
  adb -s "$TV" shell "$@" | tr -d '\r'
}
