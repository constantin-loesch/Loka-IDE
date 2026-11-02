<p align="center">
  <img src="build/icon.png" width="112" alt="Lokal IDE Icon">
</p>

<h1 align="center">Lokal IDE</h1>

<p align="center">
  <b>Code-Editor mit eingebauter KI, die komplett auf deinem Rechner läuft.</b><br>
  Chat, Coding-Agent, Terminal, Devcontainer, Git und GitHub – ohne Cloud, ohne API-Schlüssel, ohne Abo.
</p>

<p align="center">
  <b>Installieren mit einem Befehl</b> (macOS &amp; Linux):
</p>

```bash
curl -fsSL https://raw.githubusercontent.com/constantin-loesch/Lokal-IDE/main/scripts/install.sh | sh
```

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%C2%B7%20Metal-000?logo=apple">
  <img alt="Linux" src="https://img.shields.io/badge/Linux-CUDA%20%C2%B7%20Vulkan%20%C2%B7%20CPU-FCC624?logo=linux&logoColor=black">
  <img alt="llama.cpp" src="https://img.shields.io/badge/Engine-llama.cpp-4f8cff">
  <img alt="100 % lokal" src="https://img.shields.io/badge/Daten-100%25%20lokal-4fbf7a">
</p>

<p align="center">
  <img src="docs/screenshots/agent-freigabe.png" alt="Der Coding-Agent schlägt eine Korrektur vor und wartet mit Diff auf die Freigabe" width="900">
</p>

---

## Was kann Lokal IDE?

| | |
| --- | --- |
| 🤖 **Coding-Agent** | Gib eine Aufgabe („Behebe den Fehler und führe die Tests aus“) – der Agent sucht im Projekt, liest Code, ändert Dateien und startet Terminal-Befehle. Jede Änderung siehst du vorher als Diff und gibst sie frei. |
| 🧠 **Erkennt selbst, was du willst** | Kein Umschalten zwischen Modi: Allgemeine Fragen beantwortet er direkt, Projektfragen durch Nachlesen, Aufträge als Agent. |
| 💻 **Lokale KI** | Modelle laufen über [llama.cpp](https://github.com/ggml-org/llama.cpp) direkt in der App – mit Metal (Mac), CUDA (NVIDIA), Vulkan (AMD/Intel) oder auf der CPU. |
| 📚 **21 Modelle, 0,8B – 480B** | Qwen 3.5/3.6/3.8, Gemma 4, gpt-oss, Qwen3 Coder … jeweils von 2-Bit bis zum unquantisierten Original – mit Tempo-Schätzung für deinen Rechner. |
| 📝 **Editor wie VS Code** | Monaco-Editor mit Syntax-Highlighting für alle gängigen Sprachen, Vorschau für Bilder, PDFs, Audio und Video. |
| 📁 **Explorer** | Dateien und Ordner anlegen (auch `ordner/unterordner/datei.ts` in einem Schritt), umbenennen (F2), in den Papierkorb verschieben, Pfad kopieren, im Terminal öffnen. Änderungen von außen erscheinen sofort. |
| 🖥️ **Integriertes Terminal** | Echte Shell (zsh/bash) mit Farben, mehreren Terminals nebeneinander – lokal oder im Devcontainer. <kbd>⌃\`</kbd> blendet ein/aus. |
| 🔌 **Ports** | Startet ein Programm im Terminal einen Server, taucht sein Port automatisch auf. Ports aus dem Devcontainer werden auf `localhost` weitergeleitet – ein Klick öffnet sie im Browser. |
| 📦 **Devcontainer** | `devcontainer.json` per Dialog anlegen (Sprache, Build-Tools, Ports), Container bauen, starten, stoppen und neu bauen – über die offizielle Dev-Container-CLI, kompatibel mit VS Code. |
| 🔨 **Build-Aufgaben** | Erkennt npm-/pnpm-/yarn-Skripte, Make, Cargo, Go, Maven, Gradle, CMake, Python, .NET, Docker – ein Klick führt sie im Terminal aus, lokal oder im Container. |
| 🌿 **Git & GitHub** | Änderungen ansehen, Dateien auswählen, committen, pushen, pullen – und neue Repositories direkt auf GitHub veröffentlichen. |
| ⚙️ **Alles einstellbar** | Temperatur, Top-P/K, Kontextgröße, GPU-Backend, System-Prompt, Freigabe-Regeln für den Agent … |
| ⬆️ **Updates in der App** | Gibt es auf GitHub eine neue Version, erscheint ein Hinweis mit den Änderungen. Ein Klick lädt und baut sie im Hintergrund, ein Neustart installiert sie. |
| 💾 **Merkt sich alles** | Beim nächsten Start sind Ordner und offene Dateien wieder da. |

## Der Coding-Agent

<p align="center">
  <img src="docs/agent-ablauf.svg" alt="Ablauf des Coding-Agents" width="900">
</p>

Kleine lokale Modelle sind nicht so zuverlässig wie große Cloud-Modelle. Deshalb ist der Agent mit vielen Sicherungen gebaut:

- **Du gibst frei:** Dateiänderungen und Befehle erscheinen als Karte mit Diff. Erlauben, ablehnen (optional mit Hinweis ans Modell) oder „für diesen Chat immer erlauben“.
- **Leitplanken:** Der Agent arbeitet nur im geöffneten Projektordner. Gefährliche Befehle (`sudo`, `rm`, `git push`, Pfade außerhalb des Projekts …) werden **immer** nachgefragt.
- **Ehrlichkeit:** Erfindet das Modell Ergebnisse („Test erfolgreich!“), bevor etwas ausgeführt wurde, wird die Antwort live gestoppt und der echte Schritt ausgeführt. Am Ende steht nur, was wirklich passiert ist.
- **Selbstkontrolle:** Nach jedem Schreiben wird die Syntax geprüft (JavaScript, JSON, Python, Shell). Vor dem Abschluss prüft die App, ob Tests grün sind und alle verlangten Dateien existieren – sonst macht der Agent weiter.
- **Rückgängig:** Unter jeder Antwort lassen sich alle Änderungen mit einem Klick zurücknehmen.
- **Robust bei kleinen Modellen:** Werkzeug-Aufrufe werden auch erkannt, wenn das Modell kein sauberes JSON schreibt; Änderungen gehen auch über Zeilennummern statt exakten Text.

<p align="center">
  <img src="docs/screenshots/agent-ergebnis.png" alt="Ergebnis: Fehler behoben, Funktion ergänzt, Tests bestanden" width="900">
  <br><sub>Echter Lauf mit Qwen2.5 Coder 3B auf einem Mac mit M3 und 8 GB RAM: Fehler gefunden, Funktion ergänzt, <code>npm test</code> grün.</sub>
</p>

## Terminal, Ports & Devcontainer

<p align="center">
  <img src="docs/screenshots/devcontainer.png" alt="Dialog zum Anlegen eines Devcontainers mit Build-Tools, Ports und Vorschau der devcontainer.json" width="900">
</p>

**Terminal** – das Terminal-Symbol links oder <kbd>⌃\`</kbd> öffnet unten ein Terminal im Projektordner (<kbd>⌃⇧\`</kbd> ein weiteres). Es ist eine echte Shell über [node-pty](https://github.com/microsoft/node-pty) und [xterm.js](https://github.com/xtermjs/xterm.js): Farben, Vollbild-Programme wie `vim` oder `htop`, <kbd>⌘C</kbd> kopiert die Auswahl, <kbd>⌘K</kbd> leert. Terminals laufen weiter, wenn der Bereich ausgeblendet ist.

**Ports** – die App beobachtet, welche Programme aus ihren Terminals einen TCP-Port öffnen (`lsof` bzw. `ss`), und zeigt sie im Tab *Ports* mit Link zum Öffnen. Im Devcontainer werden lauschende Ports automatisch erkannt (`/proc/net/tcp`) und auf `localhost` weitergeleitet – ist der Port belegt, wird der nächste freie genommen. Eigene Weiterleitungen trägst du unten im Tab ein.

**Devcontainer** – im Bereich *Container & Build* (Würfel-Symbol):

1. **Anlegen:** Der Dialog schlägt passend zum Projekt ein Image vor (Node, Python, Go, Rust, Java, C/C++, .NET …), dazu Build-Tools als [Features](https://containers.dev/features) (Node, Python, Go, Rust, Java + Maven + Gradle, gcc/make/CMake, Docker-in-Docker, GitHub CLI), Ports und einen Befehl nach dem Erstellen (z. B. `npm install`). Die `devcontainer.json` siehst du live, bevor sie geschrieben wird.
2. **Starten / Neu bauen / Stoppen / Löschen:** läuft über die offizielle [Dev-Container-CLI](https://github.com/devcontainers/cli) – dieselbe Technik wie in VS Code, also funktionieren auch vorhandene Konfigurationen mit Dockerfile oder Docker Compose. Den Fortschritt zeigt der Tab *Ausgabe*.
3. **Arbeiten:** „Terminal im Container“ öffnet eine Shell im Container (als `remoteUser`, im Arbeitsordner). Build-Aufgaben lassen sich wahlweise *lokal* oder *im Container* ausführen.

Voraussetzung ist Docker: [Docker Desktop](https://www.docker.com/products/docker-desktop/), OrbStack, Colima oder die Docker Engine unter Linux.

## Modelle

<p align="center">
  <img src="docs/screenshots/modelle.png" alt="Modell-Katalog mit Varianten, Tempo-Schätzung und Lizenz" width="900">
</p>

Jedes Modell gibt es in mehreren Varianten. Weniger Bits = kleiner und schneller, aber etwas ungenauer – **4-Bit ist meist der beste Kompromiss**. Modelle mit **MoE** (z. B. „35B A3B“) rechnen pro Wort nur einen kleinen Teil ihrer Parameter und sind deshalb fast so schnell wie kleine Modelle.

| Dein Rechner | Empfehlung |
| --- | --- |
| 8 GB RAM (z. B. MacBook Air) | Qwen3.5 4B oder Gemma 4 E4B in 4-Bit |
| 16–32 GB RAM | Qwen3.5 9B, gpt-oss 20B, Gemma 4 26B A4B |
| 32–64 GB RAM / NVIDIA mit 24 GB | Qwen3.6 35B A3B, Qwen3 Coder 30B A3B, Qwen3.8 27B |
| 64–256 GB (Mac Studio, Workstation) | Qwen3 Coder Next 80B, gpt-oss 120B, Qwen3.8 Flash-Next |
| 256 GB+ | Qwen3.5 397B, Qwen3 Coder 480B |

Die App zeigt für jede Variante, ob sie auf **deinen** Rechner passt und wie viele Wörter pro Sekunde ungefähr zu erwarten sind – bei NVIDIA-Karten inklusive Hinweis, wenn ein Teil auf die CPU ausweichen muss.

## Git & GitHub

<p align="center">
  <img src="docs/screenshots/git.png" alt="Git-Panel mit Änderungen und Commit" width="900">
</p>

Repository anlegen, Dateien auswählen, committen (⌘↩), pushen und pullen. Für GitHub reicht ein Zugangs-Token – er wird im Schlüsselbund des Systems gespeichert (macOS-Schlüsselbund bzw. libsecret unter Linux).

## So ist die App aufgebaut

<p align="center">
  <img src="docs/architektur.svg" alt="Architektur von Lokal IDE" width="900">
</p>

| Bereich | Datei | Aufgabe |
| --- | --- | --- |
| Hauptprozess | [`src/main/index.ts`](src/main/index.ts) | Fenster, Menü, Dateizugriff, IPC |
| KI-Engine | [`src/main/llm.ts`](src/main/llm.ts) | Modell laden, Backend-Wahl (Metal/CUDA/Vulkan/CPU), Chat, Agent-Schleife |
| Agent | [`src/main/agent.ts`](src/main/agent.ts), [`agentTools.ts`](src/main/agentTools.ts) | Werkzeuge, Freigaben, Leitplanken, Syntaxprüfung, Rückgängig |
| Hardware | [`src/main/hardware.ts`](src/main/hardware.ts) | Passt das Modell? Wie schnell läuft es? |
| Modelle | [`src/main/models.ts`](src/main/models.ts), [`catalog.ts`](src/main/catalog.ts) | Katalog, mehrteilige Downloads, Installation |
| Git | [`src/main/git.ts`](src/main/git.ts) | Git-Befehle, GitHub-API |
| Terminal | [`src/main/terminal.ts`](src/main/terminal.ts) | Pseudo-Terminals (node-pty), lokal oder per `devcontainer exec` |
| Ports | [`src/main/ports.ts`](src/main/ports.ts) | Ports erkennen, Weiterleitung aus dem Container nach `localhost` |
| Devcontainer | [`src/main/devcontainer.ts`](src/main/devcontainer.ts) | Vorlagen, Docker-Status, Start/Neubau/Stopp über die Dev-Container-CLI |
| Build-Aufgaben | [`src/main/tasks.ts`](src/main/tasks.ts) | Erkennt Skripte und Build-Systeme im Projekt |
| Updates | [`src/main/updater.ts`](src/main/updater.ts) | Vergleich mit GitHub, Pull & Neubau, Austausch beim Neustart |
| Oberfläche | [`src/renderer/src/`](src/renderer/src/) | React + Monaco + xterm.js: Editor, Explorer, Terminal, Ports, Container, Chat, Freigabe-Karten, Katalog, Git |

## Installieren & starten

### Mit einem Befehl

```bash
curl -fsSL https://raw.githubusercontent.com/constantin-loesch/Lokal-IDE/main/scripts/install.sh | sh
```

Das Skript ([`scripts/install.sh`](scripts/install.sh)) prüft die Voraussetzungen, lädt den Quellcode nach `~/.lokal-ide`, installiert die Abhängigkeiten und baut die App:

- **macOS:** `~/Applications/Lokal IDE.app`
- **Linux:** `~/.local/bin/lokal-ide` (AppImage) plus Eintrag im App-Menü

Danach aktualisiert sich die App selbst (siehe [Updates](#updates)); das Skript erneut auszuführen geht aber auch. Voraussetzungen: `git` und [Node.js](https://nodejs.org) 22+, unter Linux zusätzlich `build-essential` und `python3` (für das Terminal). Für Devcontainer außerdem Docker.

### Zum Entwickeln

```bash
git clone https://github.com/constantin-loesch/Lokal-IDE.git
cd Lokal-IDE
npm install
npm run dev
```

Beim ersten Start unter „Modelle“ ein Modell herunterladen (z. B. **Qwen3.5 4B**), einen Ordner öffnen und im Chat loslegen.

### Linux

```bash
sudo apt install build-essential python3   # für das Terminal (node-pty wird gebaut)
npm install          # lädt automatisch die llama.cpp-Bausteine für CPU, Vulkan und CUDA
npm run dev
```

- **NVIDIA (CUDA):** aktueller NVIDIA-Treiber und [CUDA Toolkit](https://developer.nvidia.com/cuda-downloads) 12.4+ (oder 13.1+).
- **AMD / Intel (Vulkan):** Vulkan-Treiber der Distribution (z. B. `mesa-vulkan-drivers`).
- Ohne passende GPU läuft alles auf der CPU. Das Backend lässt sich in den Modell-Einstellungen festlegen.
- GitHub-Token landen im Schlüsselbund (libsecret); ist der nicht installiert, in `~/.git-credentials`.

> Die Linux-Unterstützung ist neu: Code und Build-Konfiguration sind vorbereitet, getestet ist bisher aber nur macOS. Rückmeldungen sind willkommen.

## Updates

Die App merkt sich beim Bauen ihren Git-Stand und den Quellordner (bei der Installation per Skript `~/.lokal-ide`). Kurz nach dem Start und danach alle vier Stunden fragt sie GitHub, ob es auf `main` neuere Commits gibt (**Hilfe → Nach Updates suchen …** prüft sofort).

Gibt es welche, erscheint unten rechts ein Hinweis mit der Liste der Änderungen:

1. **Installieren** – im Hintergrund: `git pull` im Quellordner, `npm install`, App neu bauen. Du kannst dabei weiterarbeiten; „Details“ zeigt die Ausgabe.
2. **Jetzt neu starten** – die App beendet sich, die neue Version ersetzt die alte (macOS: am selben Ort, neu signiert; Linux: das AppImage) und startet wieder.

„Später“ blendet den Hinweis bis zur nächsten neuen Version aus; in der Statusleiste bleibt „Update verfügbar“ sichtbar. Hat der Quellordner nicht committete Änderungen, bricht das Update ab, statt sie zu überschreiben. Für Entwickler: `npm run dev` holt beim Update nur den neuen Code; mit `LOKAL_IDE_BUILD_COMMIT=<sha> npm run build` lässt sich ein älterer Stand vortäuschen, um den Hinweis zu testen.

## Als App bauen

| Plattform | Befehl | Ergebnis |
| --- | --- | --- |
| macOS | `npm run app` | `~/Applications/Lokal IDE.app` (signiert) |
| Linux | `npm run app:linux` (auf Linux ausführen) | `dist/Lokal-IDE-<version>-x64.AppImage` und `.tar.gz` |

Auf dem Mac wird bewusst außerhalb des Projektordners signiert: Liegt das Projekt auf einem iCloud-synchronisierten Schreibtisch, hängt macOS sofort wieder Datei-Attribute an und `codesign` bricht ab.

Modelle liegen unter `~/Library/Application Support/Lokal IDE/models` (macOS) bzw. `~/.config/Lokal IDE/models` (Linux).

## Ideen für später

- Inline-Vervollständigung im Editor (Ghost-Text)
- Dateien per Drag & Drop im Explorer verschieben
- Projektweiter Kontext (Embeddings über den geöffneten Ordner)
- OpenAI-kompatibler lokaler Server, damit auch andere Tools die Modelle nutzen können

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
| [xterm.js](https://github.com/xtermjs/xterm.js) | Terminal-Darstellung | MIT |
| [node-pty](https://github.com/microsoft/node-pty) | Echte Pseudo-Terminals | MIT |
| [Dev Container CLI](https://github.com/devcontainers/cli) | Devcontainer bauen und starten | MIT |
| [Vite](https://github.com/vitejs/vite), [electron-vite](https://github.com/alex8088/electron-vite) | Build | MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) | Mac-App packen | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Sprache | Apache 2.0 |

Die vollständigen Lizenztexte aller mitgelieferten Pakete (126 Stück, alle freizügig: MIT, ISC, Blue Oak, Apache 2.0, MPL 2.0 wahlweise) stehen in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). Die Datei wird bei `npm run app` neu erzeugt (`scripts/licenses.mjs`), mit der App ausgeliefert und ist dort über **Hilfe → Open-Source-Lizenzen** erreichbar.

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
