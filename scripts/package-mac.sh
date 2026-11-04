#!/bin/sh
# Builds the app and installs it to ~/Applications.
# Signing happens only there: on an iCloud-synced Desktop macOS immediately re-attaches
# file attributes, and codesign then aborts.
#
# LOKAL_IDE_BUILD_ONLY=1 only builds (for updates from the running app) – swapping the app
# is then done by scripts/mac-install-app.sh after quitting.
set -e

# The Monaco editor is big – bundling needs more memory than Node's default
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"

if [ "$(uname -m)" = "arm64" ]; then
  ARCH=--arm64
  SRC="dist/mac-arm64/Lokal IDE.app"
else
  ARCH=--x64
  SRC="dist/mac/Lokal IDE.app"
fi
DEST="$HOME/Applications/Lokal IDE.app"

node scripts/licenses.mjs
electron-vite build

if [ -n "$LOKAL_IDE_BUILD_ONLY" ]; then
  # Separate output folder: a running app in dist/ is not touched by the update
  electron-builder --mac dir $ARCH -c.directories.output=dist/update
  echo "Built: dist/update/${SRC#dist/}"
  exit 0
fi

electron-builder --mac dir $ARCH

sh scripts/mac-install-app.sh "$SRC" "$DEST"
echo "Done: $DEST"
