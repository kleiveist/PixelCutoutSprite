# PixelCutoutSprite Studio — Einstieg

Stand: P43-Abschlussbericht mit offenen Freigabepunkten · 10. September 2026.

Die Anwendung ist ein lokales Tauri-Desktop-Studio mit drei gemeinsamen Modulen.
Der neue Cutout-Einstieg ersetzt die frühere Projekt-/Area-/Animations-Anwendung.
Die alte Fachbasis wurde entfernt; ihre Nutzerdateien werden nicht gelöscht oder
beim Öffnen automatisch migriert.

## Aktueller Funktionsstand

| Modul | Jetzt verfügbar | Anleitung |
| --- | --- | --- |
| PixelPromptStudio | Vault-Basisprofil, neun Assetkategorien, paginierter Wizard, Autosave, Profile und Markdown-Ausgaben | [Prompt](docs/guides/prompt-generator.md) |
| PixelCutoutSprite | Sichere Bildauswahl, manuelle/assistierte überlappende Masken, PNG-Teile und Manifest | [Cutout](docs/guides/cutout-willkommen.md) |
| PixelSpriteStudio | Set-Autoload, Originalanordnung, View-Ebenen, Transformationen, Szenen-Autosave und Generationsabgleich | [Sprite](docs/guides/sprite-studio.md) |

Keine alten Projekte-, Areas-, Motion-, Dummy-, Outfit-, NPC- oder Export-Routen
sind mehr erreichbar.
Prompt und Bildmodule werden über Vault-Dateien verbunden, nicht über einen Area-Handoff.

## Anwendung starten und prüfen

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri test --cargo
python tools/control.py tauri run --foreground
```

Für einen frischen Checkout vor nativen Tests zusätzlich `npm --prefix frontend run build`
ausführen: Der Custom-Protocol-Build benötigt das gebündelte Frontend.
Ein Vite-Browserfenster ist keine native Desktop-Abnahme.

## Maßgebliche Dokumente

- [Vollständiger deutschsprachiger Arbeitsablauf](docs/guides/gesamtworkflow.md)
- [P43-Gesamtabnahme und konkrete offene Nachweise](docs/developer/acceptance/P43-gesamtabnahme_haertung_dokumentation.md)
- [P37-Abnahme und Entfernen-/Bewahren-Nachweis](docs/developer/acceptance/P37-cutout_altbasis_entfernen_willkommen.md)
- [Aktueller Implementierungsplan P28–P43](docs/-PixelStudio_Implementierungsplan_2026-09-09/START_HERE.md)
- [Neuer Cutout-Einstieg](docs/guides/cutout-willkommen.md)
- [Prompt-Generator verwenden](docs/guides/prompt-generator.md)
- [Gemeinsame Vault-/Storage-Grenzen](docs/developer/storage/vault-storage.md)
- [Aktuelle Modularchitektur](docs/developer/prompt-generator-architecture.md)

P00–P27 und deren RQ-01–RQ-40-Matrix dokumentieren das historische Vorgängerprodukt.
Diese alten Funktionsabnahmen sind keine aktuelle Produktzusage.
P37–P42 besitzen eigene ausgeführte Phasengates. Native Plattformabnahmen sind im P43-Bericht
getrennt aufgeführt; ungeprüfte Windows-/macOS-Punkte sind nicht freigegeben. Auch die
weitergehende Dateisystem-Race-Härtung H1 bleibt dort ausdrücklich offen.
`tools/` und `docs/toolingdocs/` bleiben unabhängige Tooling-Bereiche. Es wurde kein Release
signiert, veröffentlicht oder gepusht.
