# P28 · Baseline

Datum: 2026-09-09
Branch/HEAD: `main` / `9efa821bc21b0099dc2f0d51895e472fc02b737f`
Umgebung: Linux x86_64, Node `22.23.2`, npm `10.9.8`, Python `3.11.2`

## Arbeitsbaum

Der Arbeitsbaum war bereits vor P28 umfangreich verändert. Diese Nutzeränderungen wurden weder
zurückgesetzt noch inhaltlich vereinnahmt. P28–P33 ändern gezielt Frontend-, Tauri- und neue
Abnahmedateien. Die installierte Node-/npm-Version liegt unter den in `frontend/package.json`
deklarierten Versionen (`node 24.19.0`, `npm 11.17.0`), führte die Gates aber aus.

## Baseline-Gates vor dem Umbau

| Befehl | Exit | Ergebnis |
| --- | ---: | --- |
| `npm --prefix frontend test` | 0 | 149 Testdateien, 771 Tests bestanden |
| `npm --prefix frontend run typecheck` | 0 | TypeScript-Buildprüfung bestanden |
| `npm --prefix frontend run lint` | 0 | ESLint bestanden |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 127 | nicht ausführbar: `cargo` fehlt |

## Umgebungsblocker

- `cargo` und `rustc` sind nicht installiert; native Tests und Rust-Kompilierung sind daher nicht
  als grün bewertet.
- Das Playwright-Paket ist vorhanden, das Chromium-Binary fehlt. Der Browserlauf beendet sich vor
  dem ersten Test mit dem Hinweis auf das fehlende
  `chromium_headless_shell-1243/chrome-headless-shell`.
- Python-Testzusätze `pytest` und `jsonschema` fehlen. Dadurch sind die betreffenden Tooling- und
  Planpaket-Prüfungen in dieser Sitzung nicht ausführbar.

Die finalen Frontend-Ergebnisse nach P33 stehen in den jeweiligen Phasenberichten.
