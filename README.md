# Lokal IDE

IDE mit eingebauter lokaler KI. Modelle werden direkt in der App geladen (llama.cpp über `node-llama-cpp`, auf Apple Silicon mit Metal-GPU). Kein Ollama, keine Cloud.

## Starten

```bash
npm install
npm run dev
```

## Aufbau

| Bereich | Datei | Aufgabe |
|---|---|---|
| Main-Prozess | `src/main/index.ts` | Fenster, Dateizugriff, IPC |
| Inferenz | `src/main/llm.ts` | Modell laden/entladen, Chat mit Streaming |
| Modelle | `src/main/models.ts` | Katalog, RAM-Einschätzung, Download (fortsetzbar), Import |
| Brücke | `src/preload/index.ts` | Sichere API `window.api` für die Oberfläche |
| Oberfläche | `src/renderer/src/` | React + Monaco: Explorer, Editor-Tabs, Modell-Manager, Chat |

Modelle liegen unter `~/Library/Application Support/Lokal IDE/models`.

## Nächste Schritte (Ideen)

- Inline-Vervollständigung im Editor (Ghost-Text)
- „Code ändern“-Aktion mit Diff-Vorschau
- OpenAI-kompatibler lokaler Server für andere Tools
- Projektweiter Kontext (Embeddings/RAG über den geöffneten Ordner)
- Integriertes Terminal

## Als Mac-App bauen

```bash
npm run app
```

Baut die App mit Icon (`build/icon.svg` → `build/icon.png`), installiert sie nach `~/Applications/Lokal IDE.app` und signiert sie dort. Signiert wird bewusst außerhalb des Projektordners: Liegt das Projekt auf einem iCloud-synchronisierten Schreibtisch, hängt macOS sofort wieder Datei-Attribute an und `codesign` bricht ab.

## Open Source & Lizenzen

Lokal IDE baut auf diesen Open-Source-Projekten auf:

| Projekt | Wofür | Lizenz |
| --- | --- | --- |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | Führt die Sprachmodelle lokal aus (Metal-GPU auf Apple Silicon) | MIT |
| [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) | Anbindung von llama.cpp an Node.js/Electron, Funktionsaufrufe | MIT |
| [Electron](https://github.com/electron/electron) | Desktop-App (enthält Chromium und Node.js) | MIT |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | Code-Editor (derselbe wie in VS Code) | MIT |
| [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) | Monaco in React | MIT |
| [React](https://github.com/facebook/react) | Oberfläche | MIT |
| [Vite](https://github.com/vitejs/vite), [electron-vite](https://github.com/alex8088/electron-vite) | Build | MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) | Mac-App packen | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Sprache | Apache 2.0 |

Die vollständigen Lizenztexte aller mitgelieferten Pakete (121 Stück, alle freizügig: MIT, ISC, Blue Oak, Apache 2.0) stehen in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). Die Datei wird bei `npm run app` neu erzeugt (`scripts/licenses.mjs`), mit der App ausgeliefert und ist dort über **Hilfe → Open-Source-Lizenzen** erreichbar.

### Modelle

Die Modelle sind nicht Teil der App – sie werden erst auf Wunsch von Hugging Face geladen. Der Katalog ([src/main/catalog.ts](src/main/catalog.ts)) wird mit `node scripts/update-catalog.mjs` direkt aus Hugging Face erzeugt: 21 Modelle von 0,8B bis 480B Parametern, jeweils in mehreren Varianten (2-Bit bis unquantisiertes 16-Bit-Original). Die GGUF-Dateien stammen von [unsloth](https://huggingface.co/unsloth), [ggml-org](https://huggingface.co/ggml-org) und [bartowski](https://huggingface.co/bartowski); es gilt jeweils die Lizenz des Originalmodells:

| Modelle | Lizenz | Kommerziell |
| --- | --- | --- |
| Qwen3.5 (0.8B–397B), Qwen3.6, Qwen3.8 27B, Qwen3 Coder (30B, Next, 480B), Qwen2.5 Coder 1.5B/7B | Apache 2.0 | ja |
| Gemma 4 (E2B, E4B, 12B, 26B A4B, 31B) | Apache 2.0 | ja |
| gpt-oss 20B / 120B (OpenAI) | Apache 2.0 | ja |
| **Qwen2.5 Coder 3B** | [Qwen Research License](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct/blob/main/LICENSE) | **nein** – nur Forschung/Ausprobieren |
| **Qwen3.8 Flash-Next 177B** | [Qwen Community License 1.0](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE) | privat/intern ja; **wer kommerziell ein KI-Coding-Produkt (wie diese IDE) anbietet, braucht eine eigene Lizenz** |

Die Lizenz steht auch auf jeder Modell-Karte in der App.
