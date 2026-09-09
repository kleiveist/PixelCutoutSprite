# 01 · Repository-Analyse

## Untersuchungsumfang und Grenzen

Repository: `kleiveist/PixelCutoutSprite`, Branch `main`, untersuchter Commit `9efa821bc21b0099dc2f0d51895e472fc02b737f` vom 6. September 2026. Recherche am 9. September 2026. Geprüft wurden die Repository-Struktur und gezielt zentrale Frontend-, Routing-, Schema-, Speicher- und Tauri-Dateien. Die Referenzen S01–S23 sind in `11_QUELLEN.md` aufgelöst.

Dies ist eine **gezielte statische Untersuchung**, keine vollständige Sicherheitsprüfung und kein ausgeführter Systemtest. Bei größeren Dateien wurden relevante Anfangsabschnitte gelesen; die Lesebereiche stehen im Quellenverzeichnis. Aussagen der README über abgeschlossene Tests werden als Dokumentation des Repositories behandelt, nicht als eigene Verifikation. Ein lokaler Git-Clone scheiterte an der Netzwerkanbindung der Ausführungsumgebung; die Analyse erfolgte erfolgreich über die GitHub-Verbindung.

## Belegte Ausgangslage

| Befund | Konsequenz für den Umbau | Quelle |
|---|---|---|
| Die README beschreibt eine Tauri-Desktop-App mit React und Rust sowie eine Reihe P00–P27. | Bestehende App weiterentwickeln; keine zweite Anwendung und kein Framework-Neustart. | S01 |
| `frontend/package.json` deklariert React 19, TypeScript, Vite, React Hook Form, Zod, Vitest und Playwright. | Formulare, Validierung und Tests auf dieser Grundlage weiterführen. Kein pauschales Versionsupgrade. | S02 |
| `StudioMode` enthält nur `cutout` und `prompt`; `PromptView` enthält noch `settings`. | `sprite` ergänzen; Prompt-Einstellungen aus allen Navigationsdefinitionen entfernen. | S04 |
| `App.tsx` bindet Projekte, Areas, Animationen, Outfit, NPCs und Export sowie Prompt-Handoff ein. | App-Composition verkleinern und alte Fachabhängigkeiten bewusst lösen. | S03 |
| `AppHeader.tsx` besitzt bereits `app-header`, zwei Studio-Schalter und einen Hilfebutton in `header-actions`. | Dritten Bereich und rechtsbündiges Zahnrad ergänzen, nicht einen zweiten Header einführen. | S05 |
| Die Prompt-Navigationszeile wird in `AppShell.tsx` mit `data-module-navigation="prompt"` gerendert. | Gemeinsame `ModuleNavigationRow` auslagern und in allen drei Bereichen verwenden. | S06 |
| `PromptGeneratorRoot.tsx` besitzt eigene Settings-/Profil-Provider und setzt ein eigenes `data-theme`. | Anzeigeeinstellungen in den globalen Shell-Kontext verlagern; Profile vaultgebunden machen. | S07 |
| `main.tsx` initialisiert Prompt-Storage vor dem Rendern der gesamten App. | Die App muss ohne ausgewählten Vault und bei kaputten alten Prompt-Daten starten können. | S08 |
| Der native Bootstrap öffnet `app_data_dir()/prompt-studio`. | Produktives Schreiben dorthin beenden; nur gesonderter Legacy-Lesezugang für Migration bleibt befristet. | S09 |
| `PromptWorkspaceStorage` liest Settings, Profilbibliothek, Draft und Migration-Backup; es gibt Hilfen für atomische Einzeldateischreibvorgänge. | Bibliotheks-Snapshot durch Dateien pro Vault/Asset ersetzen; Einzeldatei-Atomizität nicht mit Mehrdatei-Transaktion verwechseln. | S10 |
| Der Frontend-Adapter hält Snapshots, hat Schreibwarteschlangen und liest bei Migration `localStorage`. | Neue asynchrone, sitzungsgebundene Repository-Schnittstelle; kein stilles Browser-Persistenz-Fallback. | S11 |
| Der Wizard besitzt bereits `GuidedWizardEngine` und ein konfiguriertes Kern-Flow-Modell. | Bestehende Engine prüfen und gezielt für echte Katalogseiten umbauen, nicht pauschal neu schreiben. | S12, S13 |
| Der Dashboard-Katalog enthält bereits die neun gewünschten Typen. | Typ-IDs erhalten; Dashboard-Datenquelle und Popup-Verhalten ersetzen. Fehlende Pflicht-Untertypen gezielt ergänzen. | S14 |
| Das V2-Draft-Schema verwendet `projectName`, Profilreferenzen und Routen einschließlich `wizard/profile`. | V3-Mapping benötigt Asset-Name, Vault-Kontext und neue persistierte Schritt-IDs. | S16 |
| Die Basiswerte umfassen u. a. Pixeldichte, Stil, Tilegröße, Perspektive, Palette, Alpha-Padding und Licht. | Fachliche Felder nicht bei der UI-Verkleinerung verlieren. Die vollständigen Werte gehören ins Basisprofil-Popup. | S15 |
| `tauri.conf.json` erzwingt `minWidth: 1280` und `minHeight: 720`. Auch der Debug-Acceptance-Parser ist auf mindestens 1280×720 begrenzt. | Native Grenzen, Parser, Tests und CSS gemeinsam anpassen. | S09, S17 |
| Rust nutzt bereits u. a. `image` mit PNG-Feature, SHA-256, UUID, Unicode-Normalisierung und Datei-Locks. | Geeignete Bibliotheken wiederverwenden. Zusätzliche Decoder nur bewusst aktivieren. | S18 |
| Es gibt dedizierte Storage-Module für Pfade, Locks, JSON, Transaktionen und Geräteeinstellungen. | Kandidaten zur Wiederverwendung; ihre Eignung für das neue Vault-Modell erst prüfen. | S19 |

## Architekturproblem, nicht nur Oberflächenarbeit

Die neue Anforderung berührt vier Ebenen gleichzeitig: Navigation, fachliche Modelle, Persistenz und Bildverarbeitung. Nur Exportbuttons zu entfernen würde den bisherigen App-Data-Speicher bestehen lassen. Nur eine neue Cutout-Startseite würde den alten Projekt-/Area-/Animations-Unterbau nicht entfernen. Nur Dateinamen zu standardisieren würde die automatische räumliche Rekonstruktion nicht ermöglichen.

Die erste Umsetzung muss daher eine Bestands- und Abhängigkeitsmatrix erzeugen. Allgemeine Sicherheits- und Dateisystemlogik darf nach Prüfung weiterleben. Die alte Fachlogik für Projekte/Areas, Motion-Templates, Dummy-Animation, Outfits, NPC-Bindings und Godot-Export gehört dagegen nicht in das neue Produkt.

## Konkret zu bewahrende Bausteine

Bewahrt werden sollen die bestehende Tauri-/React-Toolchain, die neun Typ-IDs, geeignete reine Prompt-Generatorfunktionen, Kategorie-Fragen und deren Validierung, Lizenz-/Herkunftshinweise sowie geeignete allgemeine Dateipfad-, Lock- und Recovery-Konzepte. Der Plan behauptet nicht, dass alle bisherigen Komponenten unverändert wiederverwendbar sind.

Die Hashed-CSS-Klassen aus dem Nutzertext, beispielsweise `_categoryCard_1aq9h_118` und `_navigationRow_106rb_1`, sind keine stabilen API-Verträge. Maßgeblich werden Komponenten, Rollen, zugängliche Namen und `data-module-navigation` bzw. gezielte Test-IDs. CSS-Module bleiben zulässig.
