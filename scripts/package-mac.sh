#!/bin/sh
# Baut die App und installiert sie nach ~/Applications.
# Signiert wird erst dort: Auf dem iCloud-synchronisierten Schreibtisch hängt macOS
# sofort wieder Datei-Attribute an, und codesign bricht dann ab.
#
# LOKAL_IDE_BUILD_ONLY=1 baut nur (für Updates aus der laufenden App) – das Austauschen
# übernimmt dann scripts/mac-install-app.sh nach dem Beenden.
set -e

# Der Monaco-Editor ist groß – beim Bündeln braucht Node mehr Speicher als die Vorgabe
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
  # Eigener Ausgabeordner: eine laufende App in dist/ wird beim Update nicht angefasst
  electron-builder --mac dir $ARCH -c.directories.output=dist/update
  echo "Gebaut: dist/update/${SRC#dist/}"
  exit 0
fi

electron-builder --mac dir $ARCH

sh scripts/mac-install-app.sh "$SRC" "$DEST"
echo "Fertig: $DEST"
