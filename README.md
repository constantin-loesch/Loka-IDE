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

Erzeugt `dist/mac-arm64/Lokal IDE.app` mit Icon (`build/icon.svg` → `build/icon.png`). Danach in `/Applications` kopieren:

```bash
ditto "dist/mac-arm64/Lokal IDE.app" "/Applications/Lokal IDE.app"
```
