#!/bin/sh
# Baut llama.cpp mit CUDA für Linux auf ARM64 – NVIDIA Jetson (Orin, Xavier, Thor) und DGX Spark.
# Für diese Geräte gibt es keine fertigen CUDA-Bausteine von node-llama-cpp, ohne diesen Build
# rechnet die KI nur auf der CPU (viel langsamer).
#
# Läuft automatisch bei `npm run app:linux` (also auch bei Installation und Updates).
# Von Hand:  sh scripts/build-llama-cuda.sh        Erzwingen:  LOKAL_IDE_CUDA_REBUILD=1 sh scripts/build-llama-cuda.sh
# Abschalten: LOKAL_IDE_NO_CUDA=1
#
# Bricht nie die Installation ab: Klappt der Build nicht, läuft die KI eben auf der CPU.

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mHinweis:\033[0m %s\n' "$1"; }

[ "$(uname -s)" = "Linux" ] || exit 0
case "$(uname -m)" in
  aarch64 | arm64) ;;
  *) exit 0 ;; # x64: node-llama-cpp bringt fertige CUDA-Bausteine mit
esac
[ -n "$LOKAL_IDE_NO_CUDA" ] && exit 0

MODEL="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)"
JETSON=""
if [ -f /etc/nv_tegra_release ] || echo "$MODEL" | grep -qi jetson; then JETSON=1; fi

# CUDA-Compiler suchen – auf dem Jetson liegt er in /usr/local/cuda, ist aber oft nicht im PATH
for d in /usr/local/cuda/bin /usr/local/cuda-*/bin; do
  if [ -x "$d/nvcc" ]; then
    PATH="$d:$PATH"
    break
  fi
done
export PATH
if ! command -v nvcc >/dev/null 2>&1; then
  if [ -n "$JETSON" ]; then
    warn "CUDA-Toolkit (nvcc) nicht gefunden – die KI läuft deshalb nur auf der CPU."
    warn "Installieren mit: sudo apt install nvidia-jetpack   (danach die Installation erneut ausführen)"
  fi
  exit 0
fi
CUDA_HOME="$(dirname "$(dirname "$(command -v nvcc)")")"
export CUDA_HOME CUDA_PATH="$CUDA_HOME" CUDACXX="$(command -v nvcc)"

# Nur für die eigene GPU bauen – spart sehr viel Zeit gegenüber allen Architekturen
case "$MODEL" in
  *Thor*) CUDA_ARCH=110 ;;
  *Orin*) CUDA_ARCH=87 ;;
  *Xavier*) CUDA_ARCH=72 ;;
  *TX2*) CUDA_ARCH=62 ;;
  *Nano* | *TX1*) CUDA_ARCH=53 ;;
  *) CUDA_ARCH=native ;; # z. B. DGX Spark – CMake erkennt die GPU selbst
esac

LLAMA_DIR="node_modules/node-llama-cpp"
[ -d "$LLAMA_DIR" ] || { warn "node-llama-cpp fehlt – erst npm install ausführen."; exit 0; }
VERSION="$(node -p "require('./$LLAMA_DIR/package.json').version")"
MARKER="$LLAMA_DIR/llama/.lokal-ide-cuda-$VERSION-$CUDA_ARCH"

if [ -f "$MARKER" ] && [ -z "$LOKAL_IDE_CUDA_REBUILD" ]; then
  say "llama.cpp mit CUDA ist schon gebaut (sm_$CUDA_ARCH)"
  exit 0
fi

say "Baue llama.cpp mit CUDA für ${MODEL:-diese GPU} (sm_$CUDA_ARCH) – dauert einmalig 10–40 Minuten"
if NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_CUDA_ARCHITECTURES="$CUDA_ARCH" \
  node "$LLAMA_DIR/dist/cli/cli.js" source download --gpu cuda --noUsageExample; then
  rm -f "$LLAMA_DIR"/llama/.lokal-ide-cuda-*
  touch "$MARKER"
  say "CUDA-Build fertig – die KI rechnet auf der GPU"
else
  warn "CUDA-Build fehlgeschlagen – die KI läuft auf der CPU. Erneut versuchen: LOKAL_IDE_CUDA_REBUILD=1 sh scripts/build-llama-cuda.sh"
fi
exit 0
