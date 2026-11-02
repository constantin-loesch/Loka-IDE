#!/bin/sh
# Baut Lokal IDE für Linux (x64 oder arm64, z. B. NVIDIA Jetson) als AppImage und .tar.gz in dist/.
# Muss auf Linux laufen: `npm install` lädt dort die passenden llama.cpp-Binärdateien
# (CPU, Vulkan und – bei NVIDIA – CUDA) als optionale Pakete von node-llama-cpp.
set -e

# Der Monaco-Editor ist groß – beim Bündeln braucht Node mehr Speicher als die Vorgabe
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"

node scripts/licenses.mjs
# Jetson / ARM64 mit NVIDIA-GPU: llama.cpp mit CUDA bauen (macht sonst nichts)
sh scripts/build-llama-cuda.sh
electron-vite build
case "$(uname -m)" in
  aarch64 | arm64) ARCH=--arm64 ;;
  *) ARCH=--x64 ;;
esac
electron-builder --linux AppImage tar.gz $ARCH

echo "Fertig: dist/*.AppImage und dist/*.tar.gz"
