# PixelCutoutSprite Studio — Start der Umsetzung

**Stand:** 5. September 2026 · **Inhalt:** Umsetzung auf dem vorhandenen Tooling-Template.

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

## Erster Arbeitsauftrag

Den vollständigen MASTERPROMPT und danach den vollständigen Prompt P00 an den Coding-Agenten geben. Der Agent prüft zunächst den aktuellen Checkout und die vorhandenen Tests. Die Phasen danach einzeln oder im dokumentierten Serienmodus abarbeiten. Das Vorhandensein eines Prompts bedeutet nicht, dass seine Funktion bereits fertig ist.

## Leitentscheidungen

Auf dem vorhandenen Template-Tooling und dessen Profil `desktop-local` aufbauen: Vite/React/TypeScript im Frontend und Tauri 2/Rust als native Desktop-Laufzeit. Godot ist nur zusätzliches Exportziel. Desktop-only. Normale JSON-/PNG-Dateien in einer lokalen Vault; kein SQL. Bewegungsvorlagen, NPC-Aussehen und Zuordnungen getrennt halten. Vordefinierte Cutout-Teile statt erforderlicher manueller Bone-Einrichtung. PNG-Sheets plus JSON als Standardexport, Godot-Ressourcen als zusätzliche Ausgabe.

Dieses Paket wurde als Download erstellt. Es wurde nicht automatisch in das GitHub-Repository geschrieben und enthält keine nativen Studio-Builds.
