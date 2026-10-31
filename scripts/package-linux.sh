#!/bin/sh
# Baut Lokal IDE für Linux (x64) als AppImage und .tar.gz in dist/.
# Muss auf Linux laufen: `npm install` lädt dort die passenden llama.cpp-Binärdateien
# (CPU, Vulkan und – bei NVIDIA – CUDA) als optionale Pakete von node-llama-cpp.
set -e

# Der Monaco-Editor ist groß – beim Bündeln braucht Node mehr Speicher als die Vorgabe
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"

node scripts/licenses.mjs
electron-vite build
electron-builder --linux AppImage tar.gz --x64

echo "Fertig: dist/*.AppImage und dist/*.tar.gz"
