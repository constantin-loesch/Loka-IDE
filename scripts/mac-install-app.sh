#!/bin/sh
# Kopiert eine gebaute App an ihren Platz und signiert sie (ad hoc).
# Aufruf: sh scripts/mac-install-app.sh <gebaute .app> <Ziel .app>
#
# Gibt es das Ziel schon, wird nur der Inhalt ersetzt – der Ordner selbst bleibt derselbe.
# So bleibt das Symbol im Dock mit der App verknüpft.
set -e
SRC="$1"
DEST="$2"
[ -d "$SRC/Contents" ] || { echo "Nicht gefunden: $SRC" >&2; exit 1; }
[ "$SRC" != "$DEST" ] || { echo "Quelle und Ziel sind gleich: $SRC" >&2; exit 1; }

if [ -d "$DEST/Contents" ]; then
  rsync -a --delete "$SRC/" "$DEST/"
else
  mkdir -p "$(dirname "$DEST")"
  rm -rf "$DEST"
  ditto --norsrc --noextattr --noacl "$SRC" "$DEST"
fi
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"
# Finder und Dock über die neue Version informieren
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST" >/dev/null 2>&1 || true
