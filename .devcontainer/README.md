# PixelCutoutSprite Studio im Devcontainer und in Codespaces

Der Devcontainer ist eine reproduzierbare Linux-Umgebung für Quellcodearbeit, die Python-
Tooling-Suite, Rust-/Frontendtests und unsignierte Linux-Testbundles. Basisimage, Node/npm und
Rust sind festgelegt; die offiziellen Node- und Rust-Archive werden vor der Installation mit
SHA-256 geprüft. Abhängigkeiten aus `package-lock.json`, `Cargo.lock` und
`tools/requirements.txt` bleiben die jeweiligen transitiven Locks.

Nach `postCreateCommand` stehen insbesondere diese Headless-Gates bereit:

```sh
.tooling-state/venv/bin/python tools/control.py quality lint
.tooling-state/venv/bin/python tools/control.py quality architecture
.tooling-state/venv/bin/python tools/control.py integrate --check --json
npm --prefix frontend test -- --run
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Ein Linux-DEB-Testkandidat lässt sich im Container mit dem zentralen Einstieg bauen und unter
einem virtuellen X11-Display starten:

```sh
.tooling-state/venv/bin/python tools/control.py tauri build --target linux --bundles deb
xvfb-run --auto-servernum .tooling-state/venv/bin/python tools/control.py tauri smoke --target linux
```

Codespaces stellt keine native Windows-, Linux- oder macOS-Desktop-Sitzung bereit. Eine
Portweiterleitung des Vite-Servers wäre lediglich ein Entwicklungsdetail der eingebetteten
WebView und gilt weder als Webprodukt noch als native GUI-Abnahme. Reale Dateidialoge und
Desktopinteraktion werden deshalb auf dem jeweiligen Betriebssystem geprüft; der
`ci-studio.yml`-Workflow baut die drei nativen Kandidaten und führt dort die verfügbaren
Start-/Service-Smokes aus.

Die CI-Kandidaten sind bewusst unsigniert und kurzlebig. Signierung, macOS-Notarisierung,
Veröffentlichung, Tagging und Push sind getrennte, ausdrücklich freizugebende Release-Schritte.
