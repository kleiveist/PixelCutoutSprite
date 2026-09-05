# PixelCutoutSprite Studio — Einstieg

**Stand:** 5. September 2026 · **Inhalt:** Tauri-Desktop-App auf dem vorhandenen Tooling-Template.

## Anwendung starten

Die native React-/Tauri-Shell ist seit P01 vorhanden. Abhängigkeiten, Tests und Entwicklungslauf
bleiben über den vorbereiteten Tooling-Einstieg erreichbar:

```sh
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri run --foreground
```

Das Studio ist ein lokales Desktop-Produkt. Die von Vite erzeugte Seite wird nur in die Tauri-
WebView gebündelt und nicht als eigenständiges Webprodukt ausgeliefert.

## Dateien

| Datei | Zweck |
|---|---|
| [Produktspezifikation](docs/developer/features/pixelcutoutsprite-studio.md) | Vollständige Anforderungen, Bedienung, Datenstruktur, Exporte, Architektur und Abnahmen. |
| [Lebender ExecPlan](docs/developer/plans/pixelcutoutsprite-execplan.md) | Tatsächlicher Fortschritt, Entscheidungen und Tests während der Umsetzung. |
| [Phasenindex](docs/developer/prompts/pixelcutoutsprite/README.md) | 23 Phasen P00–P22 in der erforderlichen Reihenfolge. |
| [Masterauftrag](docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md) | Übergeordneter Arbeitsauftrag einschließlich Serienmodus. |
| [Fortsetzungsauftrag](docs/developer/prompts/pixelcutoutsprite/FORTSETZEN.md) | Wiederaufnahme in einer neuen Arbeitssitzung. |

## Ablage im Repository

Die Verzeichnisstruktur unter docs/developer ist für das bestehende Repository vorbereitet. Vorhandene gleichnamige Dateien gegebenenfalls vergleichen und zusammenführen. Bestehende AGENTS.md, .agent/PLANS.md, Lizenz und Tooling-Regeln nicht durch neue Standarddateien ersetzen. Den Dokumentationsindex in P00 über den vorhandenen Mechanismus ergänzen.

## Aktueller Arbeitsauftrag

P00 bis P03 sind abgeschlossen. Der nächste ausführbare Schritt ist P04 für Projekt-Dashboard,
Labels und Dropdown-Filter. Die lokale Vault, validiertes JSON-Schreiben, Pfadgrenzen und der
Single-Writer-Lock sind implementiert. Die übrigen Phasen werden weiterhin einzeln im dokumentierten
Serienmodus umgesetzt; das Vorhandensein eines Prompts bedeutet nicht, dass seine Funktion
bereits fertig ist.

## Leitentscheidungen

Auf dem vorhandenen Template-Tooling und dessen Profil `desktop-local` aufbauen: Vite/React/TypeScript im Frontend und Tauri 2/Rust als native Desktop-Laufzeit. Godot ist nur zusätzliches Exportziel. Desktop-only. Normale JSON-/PNG-Dateien in einer lokalen Vault; kein SQL. Bewegungsvorlagen, NPC-Aussehen und Zuordnungen getrennt halten. Vordefinierte Cutout-Teile statt erforderlicher manueller Bone-Einrichtung. PNG-Sheets plus JSON als Standardexport, Godot-Ressourcen als zusätzliche Ausgabe.

Dieses Paket wurde als Download erstellt. Es wurde nicht automatisch in das GitHub-Repository geschrieben und enthält keine nativen Studio-Builds.
