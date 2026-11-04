#!/bin/sh
# Builds llama.cpp with CUDA for Linux on ARM64 – NVIDIA Jetson (Orin, Xavier, Thor) and DGX Spark.
# node-llama-cpp has no prebuilt CUDA binaries for these devices; without this build
# the AI only runs on the CPU (much slower).
#
# Runs automatically with `npm run app:linux` (so also on install and updates).
# By hand:  sh scripts/build-llama-cuda.sh        Force:  LOKAL_IDE_CUDA_REBUILD=1 sh scripts/build-llama-cuda.sh
# Disable:  LOKAL_IDE_NO_CUDA=1
#
# Never aborts the installation: if the build fails, the AI simply runs on the CPU.

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mNote:\033[0m %s\n' "$1"; }

[ "$(uname -s)" = "Linux" ] || exit 0
case "$(uname -m)" in
  aarch64 | arm64) ;;
  *) exit 0 ;; # x64: node-llama-cpp ships prebuilt CUDA binaries
esac
[ -n "$LOKAL_IDE_NO_CUDA" ] && exit 0

MODEL="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)"
JETSON=""
if [ -f /etc/nv_tegra_release ] || echo "$MODEL" | grep -qi jetson; then JETSON=1; fi

# Find the CUDA compiler – on the Jetson it lives in /usr/local/cuda but is often not on the PATH
for d in /usr/local/cuda/bin /usr/local/cuda-*/bin; do
  if [ -x "$d/nvcc" ]; then
    PATH="$d:$PATH"
    break
  fi
done
export PATH
if ! command -v nvcc >/dev/null 2>&1; then
  if [ -n "$JETSON" ]; then
    warn "CUDA toolkit (nvcc) not found – so the AI only runs on the CPU."
    warn "Install it with: sudo apt install nvidia-jetpack   (then run the installation again)"
  fi
  exit 0
fi
CUDA_HOME="$(dirname "$(dirname "$(command -v nvcc)")")"
export CUDA_HOME CUDA_PATH="$CUDA_HOME" CUDACXX="$(command -v nvcc)"

# Only build for this GPU – saves a lot of time compared to all architectures
case "$MODEL" in
  *Thor*) CUDA_ARCH=110 ;;
  *Orin*) CUDA_ARCH=87 ;;
  *Xavier*) CUDA_ARCH=72 ;;
  *TX2*) CUDA_ARCH=62 ;;
  *Nano* | *TX1*) CUDA_ARCH=53 ;;
  *) CUDA_ARCH=native ;; # e.g. DGX Spark – CMake detects the GPU itself
esac

LLAMA_DIR="node_modules/node-llama-cpp"
[ -d "$LLAMA_DIR" ] || { warn "node-llama-cpp is missing – run npm install first."; exit 0; }
VERSION="$(node -p "require('./$LLAMA_DIR/package.json').version")"
MARKER="$LLAMA_DIR/llama/.lokal-ide-cuda-$VERSION-$CUDA_ARCH"

if [ -f "$MARKER" ] && [ -z "$LOKAL_IDE_CUDA_REBUILD" ]; then
  say "llama.cpp with CUDA is already built (sm_$CUDA_ARCH)"
  exit 0
fi

say "Building llama.cpp with CUDA for ${MODEL:-this GPU} (sm_$CUDA_ARCH) – takes 10–40 minutes once"
if NODE_LLAMA_CPP_CMAKE_OPTION_CMAKE_CUDA_ARCHITECTURES="$CUDA_ARCH" \
  node "$LLAMA_DIR/dist/cli/cli.js" source download --gpu cuda --noUsageExample; then
  rm -f "$LLAMA_DIR"/llama/.lokal-ide-cuda-*
  touch "$MARKER"
  say "CUDA build done – the AI runs on the GPU"
else
  warn "CUDA build failed – the AI runs on the CPU. Try again: LOKAL_IDE_CUDA_REBUILD=1 sh scripts/build-llama-cuda.sh"
fi
exit 0
