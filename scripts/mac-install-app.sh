#!/bin/sh
# Copies a built app into place and signs it (ad hoc).
# Usage: sh scripts/mac-install-app.sh <built .app> <target .app>
#
# If the target already exists, only its contents are replaced – the folder itself stays the same.
# That keeps the Dock icon linked to the app.
set -e
SRC="$1"
DEST="$2"
[ -d "$SRC/Contents" ] || { echo "Not found: $SRC" >&2; exit 1; }
[ "$SRC" != "$DEST" ] || { echo "Source and target are the same: $SRC" >&2; exit 1; }

if [ -d "$DEST/Contents" ]; then
  rsync -a --delete "$SRC/" "$DEST/"
else
  mkdir -p "$(dirname "$DEST")"
  rm -rf "$DEST"
  ditto --norsrc --noextattr --noacl "$SRC" "$DEST"
fi
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST"
# Tell Finder and Dock about the new version
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST" >/dev/null 2>&1 || true
