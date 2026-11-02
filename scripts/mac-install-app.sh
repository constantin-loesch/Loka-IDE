#!/bin/sh
# Kopiert eine gebaute App an ihren Platz und signiert sie (ad hoc).
# Aufruf: sh scripts/mac-install-app.sh <gebaute .app> <Ziel .app>
set -e
SRC="$1"
DEST="$2"
[ -d "$SRC" ] || { echo "Nicht gefunden: $SRC" >&2; exit 1; }

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
ditto --norsrc --noextattr --noacl "$SRC" "$DEST"
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"
