#!/bin/sh
# Lokal IDE mit einem Befehl herunterladen, bauen und installieren:
#
#   curl -fsSL https://raw.githubusercontent.com/constantin-loesch/Lokal-IDE/main/scripts/install.sh | sh
#
# macOS: App landet in ~/Applications/Lokal IDE.app
# Linux: AppImage landet in ~/.local/bin/lokal-ide, dazu ein Eintrag im App-Menü
#
# Ordner für den Quellcode ändern:  LOKAL_IDE_DIR=~/code/lokal-ide sh install.sh
set -e

REPO="https://github.com/constantin-loesch/Lokal-IDE.git"
DIR="${LOKAL_IDE_DIR:-$HOME/.lokal-ide}"
OS="$(uname -s)"

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mFehler:\033[0m %s\n' "$1" >&2; exit 1; }

# ---------- Voraussetzungen ----------
command -v git >/dev/null 2>&1 || fail "git fehlt. macOS: xcode-select --install · Linux: sudo apt install git"
command -v node >/dev/null 2>&1 || fail "Node.js 22+ fehlt. Download: https://nodejs.org (macOS auch: brew install node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js $NODE_MAJOR ist zu alt – bitte Version 22 oder neuer installieren."

if [ "$OS" = "Linux" ]; then
  # node-pty (Terminal) wird unter Linux aus dem Quellcode gebaut
  for tool in python3 make g++; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool fehlt (für das Terminal). Debian/Ubuntu: sudo apt install build-essential python3"
  done
fi

# ---------- Quellcode holen oder aktualisieren ----------
if [ -d "$DIR/.git" ]; then
  say "Aktualisiere $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Lade Lokal IDE nach $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

say "Installiere Abhängigkeiten (dauert beim ersten Mal ein paar Minuten)"
npm install --no-audit --no-fund

# ---------- Bauen und installieren ----------
case "$OS" in
  Darwin)
    say "Baue die Mac-App"
    npm run app
    say "Fertig! Lokal IDE liegt in ~/Applications – starten mit: open \"$HOME/Applications/Lokal IDE.app\""
    ;;
  Linux)
    say "Baue das AppImage"
    npm run app:linux
    APPIMAGE="$(ls -t dist/*.AppImage | head -n 1)"
    mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons"
    cp "$APPIMAGE" "$HOME/.local/bin/lokal-ide"
    chmod +x "$HOME/.local/bin/lokal-ide"
    cp build/icon.png "$HOME/.local/share/icons/lokal-ide.png"
    cat > "$HOME/.local/share/applications/lokal-ide.desktop" <<EOF
[Desktop Entry]
Name=Lokal IDE
Comment=IDE mit eingebauter lokaler KI
Exec=$HOME/.local/bin/lokal-ide %U
Icon=$HOME/.local/share/icons/lokal-ide.png
Terminal=false
Type=Application
Categories=Development;IDE;
EOF
    say "Fertig! Starten mit: lokal-ide (oder über das App-Menü)"
    ;;
  *)
    fail "Nicht unterstütztes System: $OS (nur macOS und Linux)"
    ;;
esac
