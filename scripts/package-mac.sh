#!/bin/sh
# Baut die App und installiert sie nach ~/Applications.
# Signiert wird erst dort: Auf dem iCloud-synchronisierten Schreibtisch hängt macOS
# sofort wieder Datei-Attribute an, und codesign bricht dann ab.
set -e

SRC="dist/mac-arm64/Lokal IDE.app"
DEST="$HOME/Applications/Lokal IDE.app"

node scripts/licenses.mjs
electron-vite build
electron-builder --mac dir --arm64

mkdir -p "$HOME/Applications"
rm -rf "$DEST"
ditto --norsrc --noextattr --noacl "$SRC" "$DEST"
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"

echo "Fertig: $DEST"
