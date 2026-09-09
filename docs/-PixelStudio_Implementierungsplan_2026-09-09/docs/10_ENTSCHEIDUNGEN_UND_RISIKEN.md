# 10 · Entscheidungen, Auslegungen und Risiken

## Auslegungen des Auftrags

Diese Entscheidungen schließen konkrete Lücken im Ausgangstext. Sie sind bewusst sichtbar, damit die Umsetzung nicht still von den Anforderungen abweicht.

| ID | Entscheidung | Begründung und Konsequenz |
|---|---|---|
| ADR-01 | Einheitliche Schreibweise „Vault“ | „Valut/Vallut“ wird als derselbe lokale Arbeitsordner verstanden. |
| ADR-02 | Projektanzeige = aktiver Vault | Keine zweite Projektentität und kein frei eingegebenes Prompt-Projekt. |
| ADR-03 | `.PixelPrompt/basisprofil.json` ist der einzige Basis-Pfad | Genau ein aktives Basisprofil, editierbar durch Revision statt Duplikat. |
| ADR-04 | Globale UI-Einstellungen dürfen lokal in App-Konfiguration liegen | Das Speicherverbot betrifft fachliche Profile/Drafts; Theme und Fensterzustand sind keine Profile. |
| ADR-05 | `.PixelStudio/` für gemeinsame Metadaten/Recovery | Neu vorgeschlagene Zusatzstruktur; kein Ersatz für die geforderte `.PixelPrompt`-Struktur. |
| ADR-06 | Typen erhalten stabile IDs und sichere Ordnerlabels | UI-Slashes dürfen nicht als Dateisystemtrennzeichen wirken. |
| ADR-07 | Drei Extras: Cape / Zubehör / Haare | Zubehör wählt Schwert oder Gürtel; die Beispiel-Dateiliste und drei Slots werden miteinander vereinbart. |
| ADR-08 | Manifest zusätzlich zu PNGs | Ursprüngliche Ausschnittkoordinaten und Ebenen sind aus Dateinamen allein nicht rekonstruierbar. |
| ADR-09 | Teileordner liegt neben der Quelldatei und heißt wie ihr Stamm | Entspricht „Name der PNG-Datei in einem Unterordner“; bei Konflikt kein Überschreiben. |
| ADR-10 | Automatik bleibt korrigierbare Auswahlhilfe | Keine Garantie semantischer Trennung ohne sichtbare Grenzen. Kein Cloud-Dienst. |
| ADR-11 | Flyout bevorzugt links, mit Kollisionskorrektur | Striktes Linksöffnen am linken Fensterrand würde die Bedienbarkeit zerstören. |
| ADR-12 | 15 Pflichtteile, ausdrücklich „nicht vorhanden“ möglich | Verdeckte/bewusst fehlende Teile dürfen nicht durch erfundene oder leere PNGs ersetzt werden. |
| ADR-13 | Abweichende Basisrevision aktualisiert Ausgaben automatisch | Noch nicht erfolgreich neu erzeugte Ausgaben werden klar als veraltet markiert. |
| ADR-14 | Explorer: Ziel anzeigen; neues Fenster separat nativ prüfen | Die dokumentierte Opener-API garantiert nicht überall eine neue Fensterinstanz. Die Windows-Anforderung ist ein echtes Plattform-Gate. |
| ADR-15 | Neue native Mindestgröße 480×360 | Halbierte Fenster wie 720×450 müssen möglich sein; vollständige Bedienbarkeit über Drawer/Scroll. |
| ADR-16 | SpriteStudio ist zunächst ein Kompositionseditor | Keine Rückkehr der ausdrücklich entfernten Timeline-/Animations-/Godot-Basis. |
| ADR-17 | Popup-Schließen speichert Formulare nicht heimlich | X/Escape/Außenklick schließen immer; nur „Speichern“ setzt eine gültige Basis bzw. globale Einstellungen. |
| ADR-18 | PNG-Pflicht, JPEG/WebP als begrenzte zusätzliche Eingaben | Bilddatei-Auswahl bleibt alltagstauglich; neue Decoder werden ausdrücklich getestet. |

## Höchste technische Risiken

**R1 – Datenverlust beim Wechsel.** Ein Timer kann noch den alten Entwurf halten, während die App bereits den neuen Vault anzeigt. Gegenmaßnahme: sitzungsgebundene Aufträge, Flush-Gate, Revisionen und Tests mit künstlich verzögerten Antworten. Eigentümer: P30/P32; Releaseblocker.

**R2 – Scheinsicherheit durch Autosave.** Ein Memory-Cache kann erfolgreich geändert worden sein, während der Datenträger voll ist. Gegenmaßnahme: unterschiedliche Zustände für dirty/pending/durable/current-output; keine Erfolgsmeldung ohne Backend-Commit. Eigentümer: P30/P32/P40; Releaseblocker.

**R3 – Unzulässige Dateipfade.** Namen, Manifeste, Symlinks und Rennen können aus dem Vault herausführen. Gegenmaßnahme: Backend-Scope, verzeichnisgebundene Zugriffe, Größenlimits, Konfliktprüfungen und Testfälle auf den Zielplattformen. Eigentümer: P30/P36/P40/P41; Releaseblocker.

**R4 – Automatische Masken schlechter als erwartet.** Gleiche Farben, schwache Konturen, viele Einzelinseln und undurchsichtiger Hintergrund erschweren Segmentierung. Gegenmaßnahme: transparente Baseline, Positiv-/Negativseeds, Handkorrektur, sichtbar unsichere Ergebnisse und diverser Fixture-Satz. Eigentümer: P39; Abnahme anhand tatsächlicher Beispielbilder, nicht nur eines transparenten Musterbildes.

**R5 – Zu großer Rückbau.** Blindes Entfernen des gesamten Rust-Cores würde benötigte Datei- und Sicherheitsfunktionen zerstören. Gegenmaßnahme: Abhängigkeitsmatrix und Extraktion in P28/P30 vor P37. Bewahrt wird nicht die alte Fachbasis, sondern nur geprüfte allgemeine Infrastruktur.

**R6 – Unrichtige Rekonstruktion.** Crop-Offsets, Pivot-Bezug oder Links-/Rechts-Konventionen können verwechselt werden. Gegenmaßnahme: normative Koordinatenformel, feste IDs, asymmetrische Testbilder und nicht zentrierte Pivots. Eigentümer: P40/P41.

**R7 – Neue Generation überschreibt bearbeitete Szene.** Gegenmaßnahme: Generation-IDs, stabile Part-IDs und expliziter Reconcile-Dialog; kein stilles Reset. Eigentümer: P41/P42.

**R8 – Bestehende Browser- oder native Tests decken reale Desktop-Probleme nicht ab.** Dateidialog, Explorer, Fensterminimum, native Close-Requests und WebView-Verhalten werden in separaten nativen Gates geprüft. Ein Playwright-Mock ist dafür kein Beweis. Eigentümer: P43.

**R9 – Verdeckter Fortbestand der zentralen Bibliothek.** Gegenmaßnahme: Negativtests auf App-Data-Schreibzugriffe und Suche nach produktiver Nutzung von V2-Collections, `activeBaseProfileId` in globalen Settings und alten Write-Commands. Eigentümer: P31/P32/P43.

**R10 – Überkomplexe Zusatzwünsche.** Timeline, generative Bildmodelle, Cloud-Sync, Game-Engine-Export und neue Projektverwaltung bleiben außerhalb dieser Umsetzung. Die geforderte Grundfunktion soll nicht zugunsten neuer Nebensysteme verschoben werden.

## Nicht als bewiesen zu behandeln

Die technische Qualität der vorhandenen allgemeinen Storage-Helfer, eine perfekte automatische Körperteilerkennung, native Windows-/macOS-Ergebnisse und zugesicherte Laufzeiten wurden für diesen Plan nicht ausgeführt geprüft. Die Implementierungsphasen müssen dafür belastbare Berichte liefern. Eine fehlende Plattformumgebung wird im Bericht genannt und darf keinen grünen Cross-Platform-Status erzeugen.
