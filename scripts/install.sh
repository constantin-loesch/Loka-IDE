#!/bin/sh
# Lokal IDE mit einem Befehl herunterladen, bauen und installieren:
#
#   curl -fsSL https://raw.githubusercontent.com/constantin-loesch/Lokal-IDE/main/scripts/install.sh | sh
#
# macOS: App landet in ~/Applications/Lokal IDE.app
# Linux: AppImage landet in ~/.local/bin/lokal-ide, dazu ein Eintrag im App-Menü
#
# Ordner für den Quellcode ändern:  LOKAL_IDE_DIR=~/code/lokal-ide sh install.sh
# Fehlt Node.js 22+, wird es automatisch nach ~/.local/share/lokal-ide/node geladen.
set -e

REPO="https://github.com/constantin-loesch/Lokal-IDE.git"
DIR="${LOKAL_IDE_DIR:-$HOME/.lokal-ide}"
OS="$(uname -s)"

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mFehler:\033[0m %s\n' "$1" >&2; exit 1; }

# ---------- Voraussetzungen ----------
command -v git >/dev/null 2>&1 || fail "git fehlt. macOS: xcode-select --install · Linux: sudo apt install git"

# Node.js 22+ wird zum Bauen gebraucht. Fehlt es oder ist es zu alt, lädt das Skript ein eigenes
# Node.js nach ~/.local/share/lokal-ide/node – ohne sudo und ohne das System-Node zu verändern.
NODE_HOME="$HOME/.local/share/lokal-ide/node"
node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 22 ]
}
[ -x "$NODE_HOME/bin/node" ] && PATH="$NODE_HOME/bin:$PATH" && export PATH
if ! node_ok; then
  case "$(uname -m)" in
    x86_64 | amd64) NARCH=x64 ;;
    aarch64 | arm64) NARCH=arm64 ;;
    *) fail "Node.js 22+ fehlt, und für $(uname -m) gibt es keinen automatischen Download. Bitte selbst installieren: https://nodejs.org" ;;
  esac
  case "$OS" in
    Darwin) NOS=darwin ;;
    Linux) NOS=linux ;;
    *) fail "Nicht unterstütztes System: $OS" ;;
  esac
  command -v curl >/dev/null 2>&1 || fail "curl fehlt."
  say "Node.js 22+ fehlt – lade ein eigenes Node.js nach $NODE_HOME"
  BASE="https://nodejs.org/dist/latest-v22.x"
  LINE="$(curl -fsSL "$BASE/SHASUMS256.txt" | grep " node-v[0-9.]*-$NOS-$NARCH.tar.gz\$")" || fail "Node.js-Download nicht gefunden."
  FILE="$(echo "$LINE" | awk '{print $2}')"
  SUM="$(echo "$LINE" | awk '{print $1}')"
  TMP="$(mktemp -d)"
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
  if command -v sha256sum >/dev/null 2>&1; then GOT="$(sha256sum "$TMP/$FILE" | awk '{print $1}')"; else GOT="$(shasum -a 256 "$TMP/$FILE" | awk '{print $1}')"; fi
  [ "$GOT" = "$SUM" ] || fail "Prüfsumme von $FILE stimmt nicht – Download abgebrochen."
  rm -rf "$NODE_HOME"
  mkdir -p "$NODE_HOME"
  tar -xzf "$TMP/$FILE" -C "$NODE_HOME" --strip-components=1
  rm -rf "$TMP"
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
  node -v >/dev/null 2>&1 || fail "Das geladene Node.js startet nicht (zu altes System? Ubuntu 18.04 / JetPack 4 wird von Node 22 nicht mehr unterstützt)."
fi
say "Node.js $(node -v)"

JETSON=""
if [ "$OS" = "Linux" ]; then
  # node-pty (Terminal) wird unter Linux aus dem Quellcode gebaut
  for tool in python3 make g++; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool fehlt (für das Terminal). Debian/Ubuntu: sudo apt install build-essential python3"
  done
  # NVIDIA Jetson: llama.cpp wird mit CUDA gebaut (scripts/build-llama-cuda.sh) – dafür braucht es nvcc
  JMODEL="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)"
  if [ -f /etc/nv_tegra_release ] || echo "$JMODEL" | grep -qi jetson; then
    JETSON=1
    say "Erkannt: ${JMODEL:-NVIDIA Jetson} ($(awk '/MemTotal/ {printf "%.0f GB", $2/1048576}' /proc/meminfo) gemeinsamer Speicher)"
    if [ -x /usr/local/cuda/bin/nvcc ] || command -v nvcc >/dev/null 2>&1; then
      say "CUDA gefunden – die KI wird für die GPU gebaut"
    else
      printf '\033[1;33mHinweis:\033[0m CUDA-Toolkit fehlt – ohne läuft die KI nur auf der CPU.\n'
      printf '         Installieren mit: sudo apt install nvidia-jetpack   (dann dieses Skript erneut starten)\n'
    fi
  fi
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
    if [ -n "$JETSON" ]; then
      echo ""
      say "Tipp für maximales KI-Tempo auf dem Jetson (volle Leistung, Takt hoch):"
      echo "    sudo nvpmodel -m 0      # Leistungsmodus MAXN (bleibt nach Neustart)"
      echo "    sudo jetson_clocks      # Takt fest auf Maximum (bis zum nächsten Neustart)"
    fi
    ;;
  *)
    fail "Nicht unterstütztes System: $OS (nur macOS und Linux)"
    ;;
esac
