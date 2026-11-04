#!/bin/sh
# Download, build and install Lokal IDE with a single command:
#
#   curl -fsSL https://raw.githubusercontent.com/constantin-loesch/Lokal-IDE/main/scripts/install.sh | sh
#
# macOS: the app goes to ~/Applications/Lokal IDE.app
# Linux: the AppImage goes to ~/.local/bin/lokal-ide, plus an entry in the app menu
#
# Change the source folder:  LOKAL_IDE_DIR=~/code/lokal-ide sh install.sh
# If Node.js 22+ is missing, it is downloaded automatically to ~/.local/share/lokal-ide/node.
set -e

REPO="https://github.com/constantin-loesch/Lokal-IDE.git"
DIR="${LOKAL_IDE_DIR:-$HOME/.lokal-ide}"
OS="$(uname -s)"

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# ---------- Requirements ----------
command -v git >/dev/null 2>&1 || fail "git is missing. macOS: xcode-select --install · Linux: sudo apt install git"

# Node.js 22+ is needed for building. If it is missing or too old, the script downloads its own
# Node.js to ~/.local/share/lokal-ide/node – without sudo and without touching the system Node.
NODE_HOME="$HOME/.local/share/lokal-ide/node"
node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 22 ]
}
[ -x "$NODE_HOME/bin/node" ] && PATH="$NODE_HOME/bin:$PATH" && export PATH
if ! node_ok; then
  case "$(uname -m)" in
    x86_64 | amd64) NARCH=x64 ;;
    aarch64 | arm64) NARCH=arm64 ;;
    *) fail "Node.js 22+ is missing, and there is no automatic download for $(uname -m). Please install it yourself: https://nodejs.org" ;;
  esac
  case "$OS" in
    Darwin) NOS=darwin ;;
    Linux) NOS=linux ;;
    *) fail "Unsupported system: $OS" ;;
  esac
  command -v curl >/dev/null 2>&1 || fail "curl is missing."
  say "Node.js 22+ is missing – downloading a separate Node.js to $NODE_HOME"
  BASE="https://nodejs.org/dist/latest-v22.x"
  LINE="$(curl -fsSL "$BASE/SHASUMS256.txt" | grep " node-v[0-9.]*-$NOS-$NARCH.tar.gz\$")" || fail "Node.js download not found."
  FILE="$(echo "$LINE" | awk '{print $2}')"
  SUM="$(echo "$LINE" | awk '{print $1}')"
  TMP="$(mktemp -d)"
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
  if command -v sha256sum >/dev/null 2>&1; then GOT="$(sha256sum "$TMP/$FILE" | awk '{print $1}')"; else GOT="$(shasum -a 256 "$TMP/$FILE" | awk '{print $1}')"; fi
  [ "$GOT" = "$SUM" ] || fail "Checksum of $FILE does not match – download aborted."
  rm -rf "$NODE_HOME"
  mkdir -p "$NODE_HOME"
  tar -xzf "$TMP/$FILE" -C "$NODE_HOME" --strip-components=1
  rm -rf "$TMP"
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
  node -v >/dev/null 2>&1 || fail "The downloaded Node.js does not start (system too old? Ubuntu 18.04 / JetPack 4 is no longer supported by Node 22)."
fi
say "Node.js $(node -v)"

JETSON=""
if [ "$OS" = "Linux" ]; then
  # node-pty (terminal) is built from source on Linux
  for tool in python3 make g++; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool is missing (needed for the terminal). Debian/Ubuntu: sudo apt install build-essential python3"
  done
  # NVIDIA Jetson: llama.cpp is built with CUDA (scripts/build-llama-cuda.sh) – that needs nvcc
  JMODEL="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)"
  if [ -f /etc/nv_tegra_release ] || echo "$JMODEL" | grep -qi jetson; then
    JETSON=1
    say "Detected: ${JMODEL:-NVIDIA Jetson} ($(awk '/MemTotal/ {printf "%.0f GB", $2/1048576}' /proc/meminfo) shared memory)"
    if [ -x /usr/local/cuda/bin/nvcc ] || command -v nvcc >/dev/null 2>&1; then
      say "CUDA found – the AI will be built for the GPU"
    else
      printf '\033[1;33mNote:\033[0m CUDA toolkit is missing – without it the AI only runs on the CPU.\n'
      printf '      Install it with: sudo apt install nvidia-jetpack   (then run this script again)\n'
    fi
  fi
fi

# ---------- Fetch or update the source ----------
if [ -d "$DIR/.git" ]; then
  say "Updating $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Downloading Lokal IDE to $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

say "Installing dependencies (takes a few minutes the first time)"
npm install --no-audit --no-fund

# ---------- Build and install ----------
case "$OS" in
  Darwin)
    say "Building the Mac app"
    npm run app
    say "Done! Lokal IDE is in ~/Applications – start it with: open \"$HOME/Applications/Lokal IDE.app\""
    ;;
  Linux)
    say "Building the AppImage"
    npm run app:linux
    APPIMAGE="$(ls -t dist/*.AppImage | head -n 1)"
    mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons"
    cp "$APPIMAGE" "$HOME/.local/bin/lokal-ide"
    chmod +x "$HOME/.local/bin/lokal-ide"
    cp build/icon.png "$HOME/.local/share/icons/lokal-ide.png"
    cat > "$HOME/.local/share/applications/lokal-ide.desktop" <<EOF
[Desktop Entry]
Name=Lokal IDE
Comment=IDE with built-in local AI
Exec=$HOME/.local/bin/lokal-ide %U
Icon=$HOME/.local/share/icons/lokal-ide.png
Terminal=false
Type=Application
Categories=Development;IDE;
EOF
    say "Done! Start it with: lokal-ide (or from the app menu)"
    if [ -n "$JETSON" ]; then
      echo ""
      say "Tip for maximum AI speed on the Jetson (full power, high clocks):"
      echo "    sudo nvpmodel -m 0      # power mode MAXN (persists across reboots)"
      echo "    sudo jetson_clocks      # clocks fixed at maximum (until the next reboot)"
    fi
    ;;
  *)
    fail "Unsupported system: $OS (macOS and Linux only)"
    ;;
esac
