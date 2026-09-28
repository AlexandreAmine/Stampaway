#!/bin/bash
# Capture Stampaway's [perf] timing markers from the iOS Simulator.
#
# Needs an app built with markers compiled in:
#   VITE_PERF_MARKS=1 npm run build && npx cap sync ios   (then build + install)
#
# Usage: scripts/measure-perf.sh [seconds=25] [simulator=booted]
# Cold-launches the app with its console attached, then records every [perf]
# line (and the native splash hide) for the given number of seconds, so you
# can tap around in the Simulator while it runs. Output: timestamps are
# seconds since this script launched the app; @Nms values are ms since the
# web view started.
set -euo pipefail

SECONDS_TO_RECORD="${1:-25}"
DEVICE="${2:-booted}"
BUNDLE_ID="com.alexandreamine.stampaway"
OUT="$(mktemp -t stampaway-perf)"

xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 1

xcrun simctl launch --console-pty "$DEVICE" "$BUNDLE_ID" 2>&1 \
  | perl -MTime::HiRes=time -ne 'BEGIN { $| = 1; $t0 = time } printf("%7.3fs %s", time - $t0, $_)' \
  > "$OUT" &
CAPTURE_PID=$!

sleep "$SECONDS_TO_RECORD"
kill "$CAPTURE_PID" 2>/dev/null || true
# Stopping the console capture also ends the app session it launched.

grep -E "\[perf\]|WebView loaded|SplashScreen hide" "$OUT" | sed -E 's/⚡️ +(\[info\] - )?//'
echo "(full log: $OUT)"
