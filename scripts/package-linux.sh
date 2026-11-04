#!/bin/sh
# Builds Lokal IDE for Linux (x64 or arm64, e.g. NVIDIA Jetson) as AppImage and .tar.gz in dist/.
# Must run on Linux: `npm install` downloads the matching llama.cpp binaries there
# (CPU, Vulkan and – with NVIDIA – CUDA) as optional packages of node-llama-cpp.
set -e

# The Monaco editor is big – bundling needs more memory than Node's default
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"

node scripts/licenses.mjs
# Jetson / ARM64 with NVIDIA GPU: build llama.cpp with CUDA (does nothing otherwise)
sh scripts/build-llama-cuda.sh
electron-vite build
case "$(uname -m)" in
  aarch64 | arm64) ARCH=--arm64 ;;
  *) ARCH=--x64 ;;
esac
electron-builder --linux AppImage tar.gz $ARCH

echo "Done: dist/*.AppImage and dist/*.tar.gz"
