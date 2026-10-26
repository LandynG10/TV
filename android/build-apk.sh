#!/bin/sh
# Builds GrantOS.apk with the plain Android SDK tools (aapt2, javac, d8/dx, zipalign, apksigner).
# No Gradle or Android Studio needed.
#
#   android/build-apk.sh            build the web UI, then the APK
#   android/build-apk.sh --skip-web reuse android/assets/web as it is
#
# SDK: $ANDROID_HOME (or $ANDROID_SDK_ROOT) with any build-tools and a platform >= 23.
# On Ubuntu/Debian: sudo apt install android-sdk-build-tools android-sdk-platform-23 apksigner zipalign
# Output: android/build/GrantOS.apk
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$HERE/build"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/lib/android-sdk}}"
[ -d "$SDK" ] || { echo "Android SDK not found. Set ANDROID_HOME." >&2; exit 1; }
BT="$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | grep -v debian | sort -V | tail -1)"
[ -n "$BT" ] || BT="$SDK/build-tools/debian/"
PLATFORM="$(ls -d "$SDK"/platforms/android-*/ | sort -V | tail -1)"
ANDROID_JAR="${PLATFORM}android.jar"
tool() { if [ -x "$BT$1" ]; then echo "$BT$1"; elif command -v "$1" >/dev/null; then command -v "$1"; else echo ""; fi; }
AAPT2="$(tool aapt2)"; ZIPALIGN="$(tool zipalign)"; APKSIGNER="$(tool apksigner)"; D8="$(tool d8)"; DX="$(tool dx)"
for t in AAPT2 ZIPALIGN APKSIGNER; do eval "[ -n \"\$$t\" ]" || { echo "Missing $t in $BT" >&2; exit 1; }; done
echo "SDK: $SDK  build-tools: $BT  platform: $PLATFORM"

if [ "${1:-}" != "--skip-web" ]; then
  echo "== Building the web interface"
  (cd "$ROOT/web" && { [ -d node_modules ] || npm ci; } && npm run build:android)
fi
[ -f "$HERE/assets/web/index.html" ] || { echo "assets/web/index.html missing: run without --skip-web" >&2; exit 1; }

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "== Resources"
"$AAPT2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$AAPT2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" --manifest "$HERE/AndroidManifest.xml" \
  -A "$HERE/assets" --java "$OUT/gen" "$OUT/res.zip" --auto-add-overlay

echo "== Java"
find "$HERE/src" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"

echo "== Dex"
if [ -n "$D8" ]; then
  "$D8" --release --min-api 22 --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
else
  "$DX" --dex --min-sdk-version=22 --output="$OUT/dex/classes.dex" "$OUT/classes"
fi
(cd "$OUT/dex" && zip -q -j "$OUT/unsigned.apk" classes.dex)

echo "== Align and sign"
KEYSTORE="$HERE/grantos-sideload.jks"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass grantos-sideload -keypass grantos-sideload \
    -alias grantos -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=GrantOS sideload" >/dev/null 2>&1
fi
"$ZIPALIGN" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:grantos-sideload --key-pass pass:grantos-sideload \
  --ks-key-alias grantos --min-sdk-version 22 --out "$OUT/GrantOS.apk" "$OUT/aligned.apk"
"$APKSIGNER" verify "$OUT/GrantOS.apk"
ls -l "$OUT/GrantOS.apk"
echo "Built $OUT/GrantOS.apk"
