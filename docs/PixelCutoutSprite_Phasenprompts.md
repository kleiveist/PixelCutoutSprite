<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio — vollständiger Prompt-Phasen-Verlauf

> **Architekturkorrektur für diesen Checkout:** Alle funktionalen Phasen und Gates bleiben
> verbindlich. Technische Hinweise auf eine vorhandene Forge2D-/Godot-App werden gemäß
> `docs/developer/decisions/adr-001-tauri-desktop.md` auf Tauri 2, Rust und
> TypeScript/React übertragen. Godot ist nur das Exportziel in P17.

**Stand:** 5. September 2026 · **Umfang:** 23 Implementierungsphasen, Masterauftrag und Fortsetzungsauftrag.

Die Einzeldateien im Dokumentationspaket sind für die Ablage im Repository vorbereitet. Dieser Sammeltext enthält dieselben Aufträge vollständig. Keine Phase ist allein durch diese Planung implementiert.

# Übergeordneter Arbeitsauftrag — PixelCutoutSprite Studio

Diesen Auftrag zu Beginn einer Implementierungssitzung verwenden. Danach die gewünschte Phase P00–P22 anhängen oder den Serienmodus unten wählen.

```text
Arbeite im vorhandenen Repository kleiveist/PixelCutoutSprite an der Tauri-Desktop-App
PixelCutoutSprite Studio. Der tatsächliche Checkout ist das Template-Tooling-Projekt,
nicht Forge2D.

Lies zuerst AGENTS.md, .agent/PLANS.md, docs/index.md und die für die Aufgabe
gültigen Python-/TypeScript-/Rust-Regeln. Lies danach vollständig:
- docs/developer/features/pixelcutoutsprite-studio.md
- docs/developer/plans/pixelcutoutsprite-execplan.md
- den beauftragten Phasenprompt unter docs/developer/prompts/pixelcutoutsprite/

Behandle die Spezifikation als fachlichen Auftrag und ADR-001 als technische
Korrektur der falschen Repository-Annahme im importierten Plan. Das vorhandene
Python-Tooling und sein Profil desktop-local sind der Ausgangspunkt. Baue mit
Vite/React/TypeScript, Tauri 2 und Rust; Godot ist nur Exportziel in P17.
Kein Electron- oder Browserprodukt. Desktop-only. Kein SQL/SQLite. Quellen
bleiben JSON + PNG in normalen Ordnern.
Keine notwendige manuelle Bone-/Skelett-Einrichtung. Trenne Bewegungsvorlagen,
NPC-Aussehen und Animationszuordnungen. Alle strukturierten Filter sind Dropdowns.

Prüfe vor Änderungen den aktuellen Checkout und vorhandene Nutzeränderungen.
Lösche oder überschreibe keine fremde Arbeit. Lies vorhandene Klassen und Tests,
bevor du Ersatz baust. Neue Abhängigkeiten, Schemaänderungen und Abweichungen
brauchen einen begründeten Eintrag mit Folgen und Alternative. Beachte die
vorhandene Installationspolitik; keine ungeprüften Download-/Installationsskripte.

Implementiere die beauftragte Phase wirklich einschließlich Datenhaltung,
Fehlerfällen und Tests. Reine Mock-Oberflächen gelten nicht als fertige Funktion.
Ändere keine Tests bloß, um Fehler zu verstecken. Zuerst fokussierte Prüfungen,
danach die verfügbaren übergreifenden Repository-Gates. Berichte nur tatsächlich
ausgeführte Tests als ausgeführt und nur bestandene Tests als bestanden.

Aktualisiere während der Arbeit den ExecPlan mit Fortschritt, Entscheidungen,
Beobachtungen, Validierung und Wiederaufnahmeinformationen. Phasengates müssen
nachvollziehbar erfüllt sein. Keine automatische Veröffentlichung, keine
unbeauftragten Pushes und keine destruktiven Git-Befehle.

Abschlussformat:
1. Tatsächlich implementierte Ergebnisse und relevante Dateien.
2. Ausgeführte Prüfungen mit Ergebnis; nicht ausgeführte Prüfungen getrennt.
3. Offene Fehler, Einschränkungen oder Blocker.
4. Exakter nächster Schritt und aktualisierter Phasenstatus.
```

## Serienmodus: mehrere oder alle Phasen

```text
Führe die noch nicht abgeschlossenen Phasen P00 bis P22 nacheinander aus.
Beginne bei der ersten Phase, deren Abhängigkeiten erfüllt und deren Gate noch
nicht bestanden ist. Lies ihren vollständigen Prompt und arbeite ihn ab.
Gehe nur bei bestandenem Gate zur nächsten Phase weiter. Belege erhaltene
Funktionen und Tests, statt sie ungeprüft als bereits erledigt anzunehmen.

Sind mehrere Phasen in dieser Sitzung möglich, arbeite in dieser Reihenfolge
weiter. Endet die verfügbare Sitzung oder blockiert ein reales technisches
Problem, hinterlasse den genauen Zustand und den nächsten ausführbaren Schritt
im ExecPlan. Behaupte nicht, später selbstständig im Hintergrund weiterzuarbeiten.
Überspringe keine Abnahme und markiere keine noch offenen Plattformtests als grün.
```

## Verwendung

Die Einzelphasen sind bewusst aufeinander aufgebaut. Für einen kontrollierten Start werden der übergeordnete Auftrag und P00 verwendet. Ein späterer Auftrag kombiniert den gleichen Rahmen mit der nächsten offenen Phase. Im Serienmodus bleiben die einzelnen Gates genauso verbindlich wie bei separater Ausführung.


---

# Fortsetzungsauftrag — PixelCutoutSprite Studio

```text
Setze die Arbeit an PixelCutoutSprite Studio im vorhandenen Repository fort.

Lies AGENTS.md, .agent/PLANS.md, die vollständige Studio-Spezifikation und den
aktuellen ExecPlan. Prüfe Arbeitsbaum, letzte Änderungen und Testprotokolle.
Verlasse dich nicht allein auf eine frühere Chat-Zusammenfassung.

Ermittle die erste noch nicht belegbar abgeschlossene Phase. Lies ihren Prompt
und den MASTERPROMPT. Prüfe ihre Abhängigkeiten im tatsächlichen Code. Setze am
im ExecPlan beschriebenen nächsten Schritt an. Bewahre bestehende Nutzerarbeit.

Wiederhole relevante Tests nach Änderungen. Aktualisiere Fortschritt,
Entscheidungen, Validierung und offene Punkte. Überspringe keine fehlenden
Funktionen durch Demo-Daten oder entfernte Tests. Berichte am Ende den realen
Funktionsstand, die ausgeführten Prüfungen und den exakten nächsten Schritt.
Kein automatischer Push oder Release.
```


---

# P00 — Bestand prüfen und Umsetzung verankern

**Abhängigkeiten:** Keine; diese Phase beginnt die Implementierung.
**Spezifikation:** Kapitel 1–3, 18, 22–25
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Prüfe den tatsächlichen Checkout, Branch und Arbeitsbaum. Lies vorhandene Repository-Regeln, `docs/index.md`, Profile und Pfadverträge des Template Tooling, Tauri-Helfer, Tests und CI. Dokumentiere ausdrücklich, welche im importierten Plan genannten Dateien nicht existieren. Verlasse dich nicht darauf, dass der in der Spezifikation genannte Commit aktuell oder diesem Repository zuzuordnen ist.

Erstelle einen Bestandsbericht: Welche Teile sind allgemeines Tooling, welche Spiel-Demo und welche bereits für das Studio brauchbar? Erfasse Desktop-/Touch-/Web-Annahmen, Dokumentationsgeneratoren und Branding. Ordne jede Abweichung dieser Spezifikation zu, ohne unbesehen große Verzeichnisse zu löschen.

Verankere die Spezifikation und den lebenden ExecPlan in der vorhandenen Dokumentation. Halte die Entscheidung „Tauri-Desktop, React/TypeScript, Rust und vorhandenes Python-Tooling“ fest. Godot bleibt geprüftes Exportziel, nicht App-Laufzeit. Prüfe konfigurierte Toolchain-Versionen anhand offizieller Herkunft, bevor Installationsautomation geändert wird. Führe verfügbare bestehende Basisprüfungen aus; ein fehlendes Werkzeug wird als Blocker dokumentiert, nicht als bestandener Test.

Ergänze einen kurzen Architekturentscheid zur Trennung von Bewegungsvorlage, NPC-Aussehen und Animationszuordnung. Erstelle die Anforderungsübersicht RQ-01 bis RQ-40 als Prüfgrundlage. Implementiere in dieser Phase noch keine umfangreiche Editorfunktion.

## Gate dieser Phase

Bestandsbericht und aktuelle Ausgangsrevision sind dokumentiert. Alle 23 Phasen stehen im ExecPlan. Vorhandene Änderungen des Nutzers bleiben erhalten. Ausgeführte und nicht ausgeführte Basistests sind unterscheidbar. Es gibt keinen unbegründeten Framework-Wechsel.

## Erwartetes Ergebnis

Aktualisierte Planungsdokumentation, Bestandsbericht unter docs/developer/, Architekturentscheid und nachvollziehbares Basisprüfprotokoll.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P00 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P01 — Desktop-Shell und Produktidentität

**Abhängigkeiten:** P00
**Spezifikation:** Kapitel 2, 5, 18, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erstelle den fehlenden Produkt-Einstieg kontrolliert als Tauri-2-Desktop-Shell von PixelCutoutSprite Studio. Verwende React-Komponenten und CSS-Grid/Flex innerhalb der gebündelten WebView; die Vite-Seite ist kein separat ausgeliefertes Webprodukt. Implementiere Kopfzeile, Breadcrumb-Bereich, Hauptinhalt, Statusleiste, Dialog-Layer und eine saubere Navigationsschnittstelle. Nicht implementierte Zielseiten bleiben ausdrücklich gekennzeichnete Platzhalter.

Passe Produktname, zentrale Metadaten und betroffene Template-Verweise an. Erhalte den führenden Einstieg python tools/control.py und bestehende grundlegende Prüfverträge. Entferne mobile oder Web-Produktausgaben nur nach Prüfung ihrer Abhängigkeiten. Keine neue Touch-Optimierung und kein Webexport für eine Codespaces-Vorschau.

Richte das Desktop-Theme, skalierbare Bedienelemente, Fokuszustände und das Mindestlayout ein. Trenne UI-DPI von der späteren Pixel-Zeichenfläche. Definiere die Eingabeaktionen für Speichern, Undo/Redo, Dialogsteuerung und Wiedergabe; Textfelder dürfen keine Editoraktionen versehentlich auslösen.

Ergänze Shell- und Navigationstests sowie einen Tauri-Kompositions-Smoke, ohne die Produktionskomponenten durch einen speziellen Testmodus zu umgehen.

## Gate dieser Phase

Die native Anwendung startet in der verfügbaren Desktop-Umgebung. Shell, Navigation und Dialoge funktionieren bei 1440×900 und 1280×720. Headless-Bootstrap-Prüfung besteht. Verbleibende Zielplattformprüfungen sind sichtbar offen; es wird kein getesteter Mehrplattformstatus erfunden.

## Erwartetes Ergebnis

Produktions-Shell, Theme, Navigationsvertrag, aktualisierte Produktkonfiguration und passende Bootstrap-/UI-Basistests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P01 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P02 — Fachmodelle und JSON-Verträge

**Abhängigkeiten:** P00–P01
**Spezifikation:** Kapitel 3, 6, 12–15, 18
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere typisierte Fachmodelle für Vault, Projekt, Bereich, Profilrevision, Bewegungsvorlage, Vorlagenrevision, Assetrevision, Outfit-Entwurf, NPC, Aussehen, Animationszuordnung und Exportmanifest. Die Hierarchie und Referenzen müssen der Spezifikation entsprechen.

Definiere versionierte JSON-Verträge und produktive Validierungsfunktionen. JSON-Schemas dürfen die Verträge dokumentieren; baue keinen umfangreichen eigenen Schema-Interpreter, wenn gezielte Validatoren genügen. IDs sind stabile UUID-Strings, keine Namen oder Zahlen. Unterscheide Schema-Version, Objekt-Revision und unveränderliche freigegebene Revision.

Lege Dateikonventionen, relative Pfadauflösung und reservierte Verwaltungsordner fest. Formuliere Statusübergänge für Entwurf, Freigabe, Ausstattung, NPC-Zuordnung und Export-Aktualität. Eine Vorlage kann mehrere NPCs bedienen. Profile, Vorlagen und Aussehen bleiben getrennt.

Erzeuge vollständige minimale gültige Testdokumente und absichtlich ungültige Gegenbeispiele. Die erklärenden JSON-Ausschnitte der Spezifikation sind keine fertigen Fixtures. Implementiere Referenzprüfung, azyklische Eltern- und Spiegelbeziehungen sowie sinnvolle Zahlenlimits. Unbekannte zukünftige Datenversionen dürfen nicht überschrieben werden.

Führe weder SQL/SQLite noch eine alternative versteckte Datenbank ein. Exportressourcen wie .tres sind kein autoritatives Quellformat.

## Gate dieser Phase

Alle dokumentierten Typen lassen sich aus gültigen JSON-Fixtures lesen und konsistent zurückschreiben. Ungültige Typen, fehlende Referenzen, doppelte IDs, Zyklen und unbekannte Versionen erzeugen klare Fehler. Tests belegen die getrennten Identitäten von Vorlage, Aussehen und Zuordnung.

## Erwartetes Ergebnis

Fachmodelle, Validatoren, Formatdokumentation beziehungsweise Schemas und gültige/ungültige Fixtures unter game/tests/studio/.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P02 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P03 — Vault und sichere Dateispeicherung

**Abhängigkeiten:** P02
**Spezifikation:** Kapitel 13, 14, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die native Auswahl, Initialisierung und Wiederöffnung eines Arbeitsordners. Ein leerer Ordner darf angelegt werden; ein nicht leerer fremder Ordner verlangt eine transparente Initialisierung ohne Überschreiben seiner Dateien. Ein beschädigter Vault ist kein leerer Vault.

Setze die vereinbarte Struktur um: globale Daten ausschließlich in .pixelforge-studio, projektbezogene Metadaten unter .project, Bereichsquellen unter .area und später NPC/Animationen in normalen Unterordnern. Gerätebezogene letzte Pfade dürfen separat gespeichert werden, nicht jedoch Projektquellen.

Implementiere JsonStore, Pfad-Resolver, ID-Index, einfache Schreibsperre pro Vault und eine Transaktionsgrundlage. Einzeldateien werden temporär geschrieben und vor Austausch validiert. Mehrteilige Vorgänge erhalten ein wiederherstellbares JSON-Journal. Bereite Dirty-State und Autosave-Schnittstellen vor. Behaupte keine unbelegte plattformübergreifende Atomarität.

Validiere Pfade am Dateisystem, behandle symbolische Links vorsichtig und verhindere Pfadausbruch. Verwende ausschließlich temporäre Testordner für Tests. Öffnen ohne Schreibrecht muss erklärt werden, nicht durch stilles Speichern an einem anderen Ort kaschiert werden.

## Gate dieser Phase

Neu anlegen, schließen und wieder öffnen funktioniert. Nicht leere Fremdordner bleiben unverändert bis zur ausdrücklichen Initialisierung. Ein zweiter Schreiber wird abgefangen. Simulierte Schreibfehler erhalten die letzte gültige Datei. Keine fachlichen Projektquellen landen im globalen Metadatenordner.

## Erwartetes Ergebnis

VaultService, JsonStore, Pfad-/ID-Auflösung, Transaktionsbasis, Lock-Behandlung und Dateisystem-Integrationstests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P03 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P04 — Projekt-Dashboard, Labels und Dropdown-Filter

**Abhängigkeiten:** P03
**Spezifikation:** Kapitel 4, 5, 13, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere das Projekt-Dashboard als Startansicht nach dem Öffnen eines Vaults. Projektkarten zeigen Name, Labels, Status und sinnvolle Änderungsinformation. Erstellen legt gleichzeitig den Projektordner an. Öffnen, Umbenennen, Duplizieren, Archivieren und kontrolliertes Entfernen laufen über Anwendungsdienste.

Implementiere Workspace-Labels für Projekte sowie die Grundlage projektinterner Labels. Unterstütze Name, Farbe, Umbenennen und Entfernen. Label-Löschung darf keine Inhalte löschen. Prüfe alle Referenzen und Namenskollisionen.

Baue eine wiederverwendbare Dropdown-Filterkomponente für Einzel- und Mehrfachauswahl. Jede strukturierte Bedingung einschließlich Sortierung ist ein Dropdown. Textsuche ist getrennt. Verschiedene Felder verknüpfen sich mit UND; die Label-Auswahl unterstützt „mindestens eines“ und „alle“. Leere Auswahl schränkt nicht ein. Sichtbare Tags sind kein Ersatz für das Dropdown.

Speichere Ansichts- und Filterzustand im richtigen Scope. Ergänze Leerzustände, Fehlermeldungen, Tastaturfokus und eine Reset-Aktion. Bearbeitungen dürfen keine direkte, ungeprüfte Dateioperation aus einer Kartenklasse ausführen.

## Gate dieser Phase

Zwei Projekte mit verschiedenen Labels lassen sich anlegen, filtern, öffnen und nach Neustart wiederfinden. Umbenennen erhält IDs. Projektkopie hat neue Identität. Keine Filterbedingung ist nur über Chip, Freitext oder versteckte Checkbox erreichbar. Labelentfernung lässt Projekte bestehen.

## Erwartetes Ergebnis

Projekt-Dashboard, Label-Verwaltung, gemeinsame Dropdown-Komponenten und Tests für CRUD, Referenzen und Filterlogik.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P04 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P05 — Bereiche und humanoide Körperprofile

**Abhängigkeiten:** P04
**Spezifikation:** Kapitel 5, 6, 9, 14
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere frei benennbare Bereiche innerhalb eines Projekts und deren Kartenübersicht. Ein Bereich erhält Objekttyp, Profilversion, Referenzhöhe, acht Richtungen, Standard-Framefläche, Bodenanker und Labels. Version 1 bietet nur das humanoide NPC-Profil produktiv an; andere Objekttypen werden nicht als fertig dargestellt.

Erstelle das versionierte Standardprofil mit 15 anatomischen Slots plus optionalem Haar-Slot: zwei Rumpfteile, Kopf und je drei Teile pro Arm und Bein. Keine Augenebene und kein vom Nutzer anzulegendes Skelett. Liefere feste Befestigungen, Grundpositionen, Slotflächen, Links-/Rechts-Paarungen und Grundreihenfolgen pro Ansicht.

Setze die 80-px-Referenz und die Größenableitung um. Rundungsreste werden kontrolliert korrigiert; die tatsächliche neutrale Gesamthöhe muss dem gewählten Wert entsprechen. Haare und Equipment dürfen über die anatomische Höhe hinausragen. Die vorgeschlagenen Proportionen sind mit einem einfachen Dummy visuell zu prüfen.

Speichere verwendete Profile als unveränderliche Snapshots. Eine Änderung der Größe erzeugt eine neue Version und verändert vorhandene Bewegungen nicht automatisch. Stelle eine Vorschau der berechneten Slotmaße dar.

## Gate dieser Phase

Ein Bereich „NPCs“ mit 80 px lässt sich erzeugen und erneut öffnen. Slots, Elternbeziehungen und acht Ansichtsdefinitionen sind valide. Die neutrale Höhe ist messbar korrekt. Andere Größen bleiben ganzzahlig. Eine neue Profilversion beschädigt keine alte Referenz.

## Erwartetes Ergebnis

Bereichsverwaltung, Profilgenerator/-loader, erstes humanoides Profil, Größenprüfung und referenzierte Profil-Fixtures.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P05 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P06 — Animationsbibliothek und zustandsabhängige Navigation

**Abhängigkeiten:** P05
**Spezifikation:** Kapitel 4, 5, 8, 12
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere im Bereich den Tab Animationen und die Navigation zum späteren NPC-Tab. Bewegungskarten enthalten Name, Typ, Labels, Status, Richtungsabdeckung und Platz für eine echte Vorschau. Erstellen, Duplizieren, Archivieren und Entfernen arbeiten mit stabilen IDs.

Der Dialog für eine neue Animation erfasst Name, Aktionstyp, Frameanzahl, FPS, Loop sowie Framebreite/-höhe und Bodenanker. Profilhöhe wird geerbt und nicht mit der Framefläche verwechselt. Ergänze sinnvolle Vorbelegung aus dem Bereich und klare Grenzprüfungen.

Implementiere das Klickmodell: neue/ungeprüfte Vorlage öffnet Dummy; freigegebene Vorlage öffnet den Ausstattungsfluss. Dummy bleibt per sichtbarem Icon und Rechtsklick-Menü erreichbar. Gibt es mehrere NPC-Zuordnungen, darf nicht willkürlich eine ausgewählt werden. Eine neue Entwurfsänderung macht die bisherige Freigabe nicht rückwirkend ungeschehen.

Setze Statusübergänge und unveränderliche Freigaberevisionen zunächst anhand vollständiger Test-Fixtures um. Noch nicht vorhandene Editoren bleiben eindeutig als Zwischenstand erkennbar. Ersetze ihre Platzhalter in den folgenden Phasen. Filter einschließlich Richtung, Status, Profil und Sortierung sind Dropdowns.

## Gate dieser Phase

Neue Karte, Freigabe-Fixture, zusätzliche Entwurfsänderung und mehrere NPC-Referenzen führen jeweils zum richtigen Ziel. Duplizieren erzeugt neue Vorlagenidentität. Ungültige Timingwerte werden abgefangen. Kein toter Rechtsklick-only-Zugang.

## Erwartetes Ergebnis

Animationsdashboard, Erstelldialog, Freigabe-/Routinglogik, Kontextaktionen und Navigations-/Status-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P06 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P07 — Gemeinsamer Pixel-Rasterer

**Abhängigkeiten:** P05–P06
**Spezifikation:** Kapitel 7, 9, 11, 16, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den zentralen Rendervertrag unabhängig von der Editoroberfläche: Profil, aufgelöste Pose, Asset-Bilder, Fitting und Ziel-Framefläche ergeben ein RGBA-Bild. Verwende für die Referenz Godot Image und keine UI-Screenshot-Ausgabe.

Baue starre Eltern-/Kind-Transformationen, Richtungsschichten, Sichtbarkeit und kontrolliertes Source-over-Compositing. Definiere die Reihenfolge von Profil, Bewegung, NPC-Anpassung, lokalem Override und Pivot. Runde nicht jede Hierarchiestufe einzeln. Dokumentiere Pixelzentren, Rundung negativer Werte und Randbehandlung.

Implementiere schnelle Wege für unveränderte beziehungsweise ganzzahlig versetzte Teile. Für Drehungen verwende inverses Nearest-Sampling in einer begrenzten Zielregion. Keine Weichzeichnung und keine Mesh-Verformung. Berechne Clipping-Hinweise. Dummy-Bilder können aus kleinen eigenen Testformen erzeugt werden.

Erzeuge Golden-Fixtures für Überdeckung, Drehpunkt, halbtransparente Ebenen, negative Koordinaten, Spiegelung und Abschneiden. Vorschau und Export sollen später denselben Compositor aufrufen. Miss schon jetzt einen 128×128-Beispielframe, ohne aus einer Einzelmessung ein allgemeines Leistungsversprechen abzuleiten.

## Gate dieser Phase

Bekannte Eingaben erzeugen die erwarteten RGBA-Pixel. Wiederholungen sind gleich. Elternbewegung und Fitting kombinieren sich korrekt. Kein unkontrolliertes Antialiasing und kein Export von Editorhilfen. Langsame Stellen sind gemessen und dokumentiert.

## Erwartetes Ergebnis

Rendervertrag, PixelCompositor, Transformations-/Compositing-Helfer, Clipping-Prüfung und Golden-Image-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P07 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P08 — Direkt bedienbarer Dummy-Editor

**Abhängigkeiten:** P07
**Spezifikation:** Kapitel 6, 7, 18, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Ersetze den Dummy-Platzhalter durch den echten Editor. Zeige Raster, Framegrenze, Bodenlinie, neutralen 16-Slot-Dummy und eindeutig erkennbare Griffe. Links stehen Teile und Ebenen, rechts ihre Eigenschaften. Slotnamen, Konturen und Fokus ergänzen Farben.

Implementiere Auswahl, Mehrfachauswahl, Verschieben, Drehen, numerische Eingaben, Sichtbarkeit, Sperren, Rasterfang und ein optionales Winkelraster. Befestigte Teile folgen dem Profil. Es gibt keinen vorherigen Bone-Aufbauschritt und keine notwendigen Skeleton2D-/Bone2D-Komponenten.

Trenne eine Poseänderung von einer Profiländerung. Arbeite über rückgängig machbare Commands; ein Drag ergibt eine Undo-Aktion. Speichern, Dirty-State und Fehleranzeige benutzen die Dienste aus P03. Stelle zunächst eine ausgewählte Pose beziehungsweise einen ausgewählten Keyframe dar; die vollständige Timeline folgt in P09.

Verwende den Referenz-Rasterer für die Dummy-Darstellung. Editorgriffe und Hilfslinien liegen separat darüber. Ergänze Zoom, Pan und eine 1:1-Kontrolle. Behalte Breadcrumb und den klaren Hinweis bei, dass hier eine wiederverwendbare Bewegungsvorlage bearbeitet wird.

## Gate dieser Phase

Alle Körperteile lassen sich ohne Rig-Einrichtung sinnvoll auswählen und bewegen. Untergeordnete Teile bleiben befestigt. Undo/Redo und erneutes Öffnen erhalten die Pose. Hilfen erscheinen nie in einem gerenderten Nutzbild. Textfelder lösen keine ungewollten Editor-Kürzel aus.

## Erwartetes Ergebnis

Dummy-Editor, Transformationswerkzeuge, Inspector, Command-Basis und Interaktions-/Persistenztests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P08 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P09 — Timeline, Keyframes und deterministisches Sampling

**Abhängigkeiten:** P08
**Spezifikation:** Kapitel 7, 8, 14, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die Timeline mit Spuren, Keyframes, Scrubbing, Abspielkopf, Play/Pause, Frame-Schritten, Kopieren/Einfügen, Duplizieren, Bereichsauswahl und klarer Auto-Key-Einstellung. Die Timeline bearbeitet Daten, nicht nur den momentanen UI-Zustand.

Implementiere AnimationSampler als reine Funktion von Daten, Richtung und Sampleindex. Unterstütze Halten, lineare und die freigegebenen Easing-Interpolationen. Sichtbarkeit, Varianten und Schichtwechsel sind diskret. Drehwinkel verwenden einen dokumentierten Interpolationsweg.

Trenne Frameanzahl, FPS, Framefläche und Figurenhöhe. Für N Frames werden genau 0 bis N−1 ausgegeben. Der Loop interpoliert zum gedachten Anfang bei N, ohne ein zusätzliches Abschlussbild zu exportieren. Vorschautempo ändert gespeicherte FPS nicht.

Beim Verlängern oder Verkürzen einer Animation zeige Retiming-/Abschneidefolgen an; belegte Keys verschwinden nicht still. Ergänze die Anzeige benachbarter Posen als Orientierung. Verwende denselben Sampler für Vorschau und spätere Exporte. Halte die UI bei längeren Clips bedienbar.

## Gate dieser Phase

Vier Schlüsselposen erzeugen einen zwölfteiligen Loop mit erwarteter Dauer. Samplewerte sind unabhängig vom vorherigen Abspielverlauf. Ende/Anfang, 0/1/mehrere Keys, Winkelsprung und Retiming sind getestet. Undo/Redo stellt Timeline und Pose wieder her.

## Erwartetes Ergebnis

Timeline, AnimationSampler, Abspielsteuerung, Auto-Key, Retiming-Dialog und Zeit-/Interpolations-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P09 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P10 — Acht Richtungen, Spiegelregeln und Schichten

**Abhängigkeiten:** P09
**Spezifikation:** Kapitel 6, 9, 12, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die acht benannten Richtungen n/ne/e/se/s/sw/w/nw vollständig. Jede Richtung ist explizit, gespiegelt oder fehlend. Der Editor zeigt Herkunft und Abdeckung und erlaubt, eine gespiegelte Richtung als eigenständige Kopie weiterzubearbeiten.

Unterstütze fünf Ausgangsansichten und drei kontrollierte Ableitungen, ohne acht eigenständige Ansichten zu verbieten. Verhindere Spiegelzyklen. Front und Rückseite dürfen nicht aus einer horizontalen Spiegelung verwechselt werden.

Trenne Pose-Spiegelung, Asset-Spiegelung und Gesamtbild-Spiegelung. Die Profilpaarung definiert anatomische Links-/Rechts-Zuordnung. Assets werden für Zielslot und Zielrichtung gewählt; nicht spiegelbares Equipment darf nicht still die Hand wechseln. Fehlende passende Grafik liefert einen sichtbaren Fehler oder einen ausdrücklich bestätigten Fallback.

Verwende richtungsabhängige Grundschichten und diskrete Schichtwechsel. Verdeckte Teile müssen von fehlenden Teilen unterscheidbar sein. Lege eine eigene asymmetrische Fixture mit einseitigem Handschuh oder Accessoire an und prüfe den vollständigen Richtungsumlauf.

## Gate dieser Phase

Alle acht Richtungen werden korrekt ausgewertet. Doppelte Spiegelung stellt den Ausgangszustand wieder her. Anatomische Asymmetrie, Zielschichten und fehlende Quellen sind getestet. Freigabe kann eine unbemerkte Lücke in der geforderten Richtungsabdeckung nicht übergehen.

## Erwartetes Ergebnis

DirectionResolver, Richtungseditor, Spiegel-/Schichtwerkzeuge, Abdeckungsprüfung und Acht-Richtungs-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P10 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P11 — Bewegungspresets und tatsächliche Kartenvorschauen

**Abhängigkeiten:** P10
**Spezifikation:** Kapitel 5, 8, 9, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erstelle editierbare Startvorlagen für Stillstehen, Gehen, Sprinten, Springen und eine neutrale Interaktions-/Angriffsbewegung. Baue sie aus wenigen sichtbaren Posen beziehungsweise erklärten Hilfskanälen auf. Keine versteckte KI-Erzeugung, keine notwendige Skelettbibliothek und keine Behauptung universell fertiger Kunstqualität.

Gehen und Sprinten sollen sich nachvollziehbar in Timing und Pose unterscheiden. Ein besonders schneller Sprint kann als Variante aus derselben Grundlage entstehen. Setze Standard-Fortbewegung auf „auf der Stelle“ und behandle empfohlene Geschwindigkeit nur als Metadatum.

Für Springen trenne Bodenursprung, Körper-Höhenkanal und Schatten. Zeige den Unterschied zwischen gebackener Sprunghöhe und extern gesteuerter Höhe. Hilfskanäle wie Wippen oder Nachschwingen bleiben sichtbar, deterministisch und in normale Keys umwandelbar.

Verbinde die Animationskarten mit tatsächlichen gespeicherten Vorschauen. Spiele nur sichtbare beziehungsweise aktivierte Karten ab; respektiere reduzierte Bewegung. Cache-Invalidierung reagiert auf Änderungen. Ergänze eine erste geführte Vorlagen-Freigabe mit Prüfung aller Richtungen.

## Gate dieser Phase

Jedes Preset lässt sich bearbeiten und freigeben. Acht Richtungen und Timing sind vorhanden. Ein Sprung verschiebt nicht den Bodenanker und clippt nicht unbemerkt. Kartenvorschauen stimmen mit dem Editor überein. Es gibt keinen dauerhaften Voll-Render aller Bibliothekskarten.

## Erwartetes Ergebnis

Mitgelieferte Bewegungsdaten, Hilfskanäle, PreviewCache, echte Kartenvorschauen und erste vollständige Bewegungs-Demo.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P11 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P12 — PNG-Inventar und Paketimport

**Abhängigkeiten:** P11
**Spezifikation:** Kapitel 10, 13, 14, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere das bereichsbezogene Inventar mit PNG-Einzelbildern und regelmäßig gerasterten Sprite-Sheets. Biete Dateidialog und Drag-and-drop an. Kopiere Quellen kontrolliert in die Vault, statt dauerhaft auf externe Downloadpfade zu verweisen.

Definiere und implementiere die JSON-Begleitdatei für Asset-Pakete. Slot, Richtung, Variante, Profil, Ausschnitt, Maße und Pivot müssen vor dem Import geprüft werden. Unterstütze die Dateinamenskonvention nur als sichtbaren Zuordnungsvorschlag. Mehrdeutige Namen bleiben unzugeordnet.

Prüfe Dateigröße, dekodierte Größe, Alpha, Pixelmaße, Ausschnittgrenzen und Pfade. Größenabweichungen erhalten erklärte Optionen; keine stille Skalierung oder automatische Zerlegung eines ganzen NPC-Bildes. Quellbilder bleiben unverändert, abgeleitete Bilder sind Cache.

Ergänze Asset-IDs, Inhalts-Hashes, neue Revisionen und Verwendungsnachweise. Das Entfernen verwendeter Bilder erklärt seine Folgen. Filter für Slot, Richtung, Art, Profil, Labels und Verwendung sind Dropdowns. Erstelle eigene einfache Import-Fixtures und Gegenbeispiele.

## Gate dieser Phase

Ein korrekt beschriebenes Paket wird vollständig und reproduzierbar zugeordnet. Falsche Maße, ungültige Ausschnitte, übergroße Dateien und Pfadausbruch werden abgefangen. Externe Originale bleiben unverändert. Inventar bleibt nach Neustart vollständig verfügbar.

## Erwartetes Ergebnis

AssetRepository, PNG-/Sheet-Importer, Paketvertrag, Inventaroberfläche, Verwendungssuche und Importtests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P12 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P13 — Ausstattungseditor, Feinschliff und NPC-Entwürfe

**Abhängigkeiten:** P12
**Spezifikation:** Kapitel 4, 7, 11, 12
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die drei sichtbaren Modi Inventar, Anziehen und Feinschliff innerhalb eines zusammenhängenden Editors. Eine freigegebene Bewegung führt hierher. Vorhandenen kompatiblen NPC auswählen oder neuen Outfit-Entwurf beginnen; nicht ungefragt irgendeine bestehende Figur verwenden.

Ordne ein Paket automatisch nach bestätigten Slot-Metadaten zu. Zeige fehlende Teile deutlich. Im Feinschliff sind pro Richtung Bild, Pivot, lokaler Offset, starre Korrekturdrehung und Schichtlage einstellbar. Der Dummy bleibt als regelbare schwache Kontur sichtbar und wird nicht mitexportiert.

Verwende exakt die Transformationsreihenfolge des Compositors. Änderungen werden über Commands und Autosave gespeichert. Ein unbenannter Entwurf liegt unter .area/drafts und bleibt nach Schließen verfügbar. „Als NPC speichern“ erfragt Name und Labels und erzeugt NPC, Standard-Aussehen und erste Animationszuordnung mit stabilen IDs.

Zeige laufende Animation und Frame-Schritte. Stelle den Bearbeitungsumfang sichtbar dar: Vorlage, gemeinsames NPC-Aussehen oder lokale Zuordnung. Biete den Rücksprung zum Dummy für Bewegungsfehler, statt Sprite-Offsets als Ersatz für alle falschen Posen zu missbrauchen.

## Gate dieser Phase

Ein importiertes Paket kann angezogen, feinjustiert und als benannter NPC gespeichert werden. Kontur und Auswahlgriffe bleiben aus der Ausgabe. Entwurfswiederaufnahme, Undo/Redo, lokale Koordinaten und Richtungskorrekturen sind getestet. Die erste NPC-Zuordnung referenziert die Vorlage, nicht eine unverbundene Kopie.

## Erwartetes Ergebnis

Ausstattungseditor, AppearanceService, Outfit-Entwürfe, erste NPC-Erzeugung und Fitting-/Workflowtests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P13 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P14 — Ausrüstung und optionale Eigenbewegung

**Abhängigkeiten:** P13
**Spezifikation:** Kapitel 9, 11, 14, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erweitere das Aussehen um Rüstung, Accessoires und zusätzliche Equipmentstücke. Ein Objekt kann mehrere starre Teile an verschiedenen Slots enthalten. Die 16 Grundslots des humanoiden Profils bleiben unverändert; Equipment wird nicht zu neuer Pflichtanatomie.

Implementiere getrennt enabled, follow_mode und own_motion_enabled. Ein sichtbares Teil ohne Eigenbewegung folgt weiterhin seinem Körper-Slot. Nur die Regler/Spuren für seine eigene Bewegung sind grau deaktiviert. Ein ausgeschaltetes Teil erscheint weder in Vorschau noch Export, behält aber seine gespeicherten Einstellungen.

Unterstütze richtungsabhängige Bilder, Pivots und Schichten sowie kontrollierte eigene Transformationsspuren beziehungsweise die vorhandenen deterministischen Hilfskanäle. Unsichtbare oder deaktivierte Spuren dürfen keine Phantom-Bewegung erzeugen. Mitführen am Figurenursprung ist eine ausdrücklich gewählte Alternative.

Zeige bei großflächigen Kleidungsstücken, dass starre Bilder nicht automatisch über mehrere Gelenke deformiert werden. Teste ein segmentiertes Oberteil, einen mitgeführten Handschuh und ein Accessoire mit eingeschaltetem Nachschwingen. Überprüfe Asymmetrie und Überdeckungen in allen Richtungen.

## Gate dieser Phase

Die drei Zustände „ausgeblendet“, „mitgeführt ohne Eigenbewegung“ und „mit eigener Bewegung“ unterscheiden sich korrekt. Ausschalten löscht keine Werte. Ausstattung sitzt in allen Richtungen anatomisch richtig. Keine Mesh-/Skinning-Abhängigkeit wird eingeführt.

## Erwartetes Ergebnis

Equipment-Modelle, Ausstattungskomponenten, optionale Spuren, deaktivierte Bedienzustände und entsprechende Render-/Verhaltenstests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P14 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P15 — NPC-Dashboard, Mehrfachanimationen und Revisionen

**Abhängigkeiten:** P14
**Spezifikation:** Kapitel 3–5, 12–14
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den Tab NPCs und die NPC-Detailansicht mit allen Bewegungen einer Figur. Zeige Namen, Labels, Richtungsabdeckung, benötigte/fehlende Aktionen und Exportstatus. Alle strukturierten Filter bleiben Dropdowns. Der Wechsel zwischen Animationen und NPCs erhält den sinnvollen Bereichskontext.

Ergänze „Vorhandenem NPC weitere Bewegung zuordnen“. Die Figur wird über ihre ID gewählt. Verwende ihr bestehendes Aussehen und eine festgehaltene freigegebene Vorlagenrevision. Erzeuge je action_key höchstens eine aktive Zuordnung; Varianten erhalten ausdrückliche neue Schlüssel.

Implementiere lokale Fitting-/Bewegungskorrekturen ausschließlich für eine Zuordnung. Gemeinsames Aussehen und Vorlage bleiben davon unberührt. Ein Editierhinweis erklärt den Umfang. Eine neue Vorlagenrevision wird zur Übernahme angeboten, nicht automatisch aufgezwungen. Prüfe Kompatibilität und lokale Overrides vor dem Update.

Implementiere Duplizieren und kontrolliertes Umbenennen eines NPCs samt Ordnerstruktur und Referenzen. Ein zweiter NPC darf dieselbe Vorlagenrevision und unveränderliche Assets weiterverwenden. Bereite die korrekte Aktualitätsberechnung anhand effektiv genutzter Quellen vor.

## Gate dieser Phase

Dorfbewohner 01 besitzt Gehen, Sprinten und Springen in einem NPC-Ordner. Ein zweiter NPC teilt die Laufvorlage, nicht die Identität. Lokale Änderungen bleiben lokal. Alte Revision beibehalten und neue übernehmen funktionieren. Umbenennen und Wiederöffnen beschädigen keine Zuordnungen.

## Erwartetes Ergebnis

NPC-Dashboard/-Details, BindingService, Revision-Übernahme, lokale Overrides, Duplizier-/Umbenennungslogik und Mehrfachanimations-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P15 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P16 — Generischer PNG-/JSON-Export

**Abhängigkeiten:** P15
**Spezifikation:** Kapitel 13–16, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den Standardexport aus dem gemeinsamen Sampler und Referenz-Compositor. Ausgabe sind PNG-Sheets plus vollständige JSON-Metadaten. Optional können zusätzlich einzelne PNG-Frames in richtungsgetrennten Ordnern erzeugt werden. Autoritative Quellen bleiben unabhängig davon erhalten.

Baue einen regelmäßigen Atlas mit festen Frameflächen, Bodenankern und expliziten Rechtecken. Keine stille Rotation oder Randbeschneidung. Begrenze Seiten und Gesamtspeicher; erzeuge bei Bedarf mehrere Seiten. Validiere Padding-/Extrusionsoptionen, falls vorhanden.

Implementiere Exportprofile, Quellen-Fingerabdruck, Build-Verzeichnis, Abschlussprüfung und erst danach current.json. Ein abgebrochener Job darf den letzten guten Build nicht ersetzen. Unterstütze Fortschritt, Abbruch und verständliche Meldungen zu fehlenden Quellen, fehlenden Richtungen oder Clipping.

Ein kompletter NPC-Export prüft gemeinsame Framegröße und Bodenanker. Biete transparentes Padding statt ungefragter Skalierung an. Dokumentiere FPS, Loop, Sprungmodus und alle Richtungen. Testexport mit fehlenden Teilen ist nur ausdrücklich und markiert zulässig. Bau deterministische Fixture-Exporte und vergleiche dekodierte Pixel.

## Gate dieser Phase

Ein NPC exportiert mehrere Aktionen mit je acht Richtungen. Alle Rechtecke liegen in der korrekten PNG-Seite, Framezahl/FPS/Anker stimmen. Einzelbilder fehlen standardmäßig und erscheinen nur auf Wunsch. Abbruch erhält den alten Build. Effektive Quelländerungen ändern die Aktualität, bloße Wiederholung nicht.

## Erwartetes Ergebnis

ExportService, AtlasBuilder, generischer Manifestvertrag, Exportdialog/-profile, Fingerabdruck und Export-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P16 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P17 — Portables Godot-Paket und echter Importtest

**Abhängigkeiten:** P16
**Spezifikation:** Kapitel 16–17
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere als zusätzliche Ausgabe SpriteFrames-Ressourcen und optional eine AnimatedSprite2D-Szene. Nutze PNG-Sheets über AtlasTexture-Rechtecke. Namen folgen action_direction, beispielsweise walk_s und sprint_ne. FPS und Loop übernehmen die generischen Daten.

Erzeuge portable Ressourcenpfade innerhalb des Pakets. Es dürfen weder absolute Rechnerpfade noch Referenzen in die ursprüngliche Vault entstehen. Verwende keine unbeabsichtigt eingebetteten ImageTexture-Bilddaten als Ersatz für PNG-Verweise. Escape Namen und Ressourcen-Text korrekt; führe keinen Nutzer-Scriptcode aus.

Die optionale Szene besitzt ihren Ursprung am Boden, einen konsistenten Sprite-Offset und Nearest-Filter. Sie enthält keine erzwungene Spielsteuerung, keine Kollision und kein Skelett. Der Sprungmodus ist erklärt, damit ein Zielspiel Höhe nicht doppelt anwendet.

Erzeuge automatisiert ein frisches temporäres Godot-Projekt, kopiere das Paket hinein, lasse Bilder importieren und lade die Ressourcen. Prüfe Animationsnamen, Framezahl, Rechtecke, FPS und Szene. Wiederhole den Test nach Verschieben in ein anders benanntes Unterverzeichnis. Benenne die tatsächlich getestete Godot-Version.

## Gate dieser Phase

Der frische Godot-Import gelingt ohne alte .godot-Caches und ohne Zugriff auf die Vault. Alle erwarteten Aktionen/Richtungen sind vorhanden. Das verschobene Paket funktioniert. Es gibt keine Behauptung über ungeprüfte andere Godot-Versionen.

## Erwartetes Ergebnis

GodotExporter, generierte Beispielressourcen, frischer Projekt-Importtest und kurze Engine-Einbindungsanleitung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P17 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P18 — Recovery, Autosave und Datenintegrität härten

**Abhängigkeiten:** P17; Speicherung aus P03 und Commands aus P08 bestehen bereits.
**Spezifikation:** Kapitel 12–14, 19, 21
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Prüfe jetzt die gesamte reale Bearbeitungskette gegen Speicher- und Wiederherstellungsfehler. Ergänze die bestehenden Dienste, statt eine zweite Speicherschicht einzuführen. Autosave, manuelles Speichern, Navigation, Undo/Redo, Freigaben und Exporte müssen zusammen konsistent bleiben.

Injiziere Abbrüche zwischen den Schritten mehrteiliger Änderungen: Projekt-/NPC-Umbenennen, Asset-Import, neue Freigaberevision und Export-Abschluss. Offene Journale müssen beim Neustart nachvollziehbar fortsetzbar oder rückrollbar sein. Simuliere fehlende Rechte, belegte Dateien und fehlgeschlagene Writes ausschließlich in Test-Vaults.

Teste zwei App-Instanzen und den Umgang mit verwaisten Locks. Externe Dateiveränderungen müssen einen Konflikt auslösen, statt überschrieben zu werden. Formatmigrationen erhalten versionierte Ausgangsfixtures und Backups. Zukünftige unbekannte Schema-Versionen bleiben geschützt.

Prüfe die Speicherorte: globale Daten unter .pixelforge-studio, projektbezogene Backups/Journale im Projekt, Quellen im zuständigen Bereich/NPC. Kontrolliere Lösch-/Trash-Aktionen, Referenzen und Cache-Wiederaufbau. Ein kopierter Vault muss ohne ursprüngliche Vollpfade funktionieren.

## Gate dieser Phase

Die beschriebenen Fehlerfälle erhalten den letzten gültigen Stand oder stellen ihn kontrolliert wieder her. Keine stille Datenverlustmeldung und keine ungeprüfte Mehrdatei-Atomaritätsbehauptung. Kopieren und Öffnen der Vault funktionieren. Offene Grenzen werden konkret dokumentiert.

## Erwartetes Ergebnis

Gehärtete Speicherdienste, Migration-/Konfliktbehandlung, Fehler-Injektionstests und Recovery-Dokumentation.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P18 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P19 — Desktop-Usability und Leistung prüfen

**Abhängigkeiten:** P18
**Spezifikation:** Kapitel 5, 7, 20–21
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Führe einen vollständigen Desktop-Durchlauf mit echten erzeugten Daten aus. Prüfe 1440×900, das Mindestlayout 1280×720 und verfügbare DPI-Skalierungen. Panels, Timeline, Dialoge und Dropdowns dürfen keine zentralen Aktionen abschneiden. Die Pixel-Zeichenfläche darf nicht durch allgemeine UI-Skalierung weich werden.

Prüfe Fokus, Tab-Reihenfolge, Tastaturkürzel, Texteingaben, Rechtsklick-Alternativen, Tooltips und Statusmeldungen. Kontrolliere ausdrücklich, dass jede strukturierte Filterbedingung über ein Dropdown erreichbar ist. Reduzierte Bewegung deaktiviert unnötige Kartenanimationen.

Miss Vorschau, Rasterer, Import, Export und große Übersichten auf einem benannten Referenzgerät. Verwende einen Testbestand mit vielen Projekt-/Asset-Metadaten und begrenzten gleichzeitig sichtbaren Previews. Cachebudget und Freigabe unbenutzter Bilddaten werden geprüft. Optimiere gemessene Engpässe, ohne den Referenz-Rasterer semantisch zu verändern.

Prüfe Offline-Verhalten und Abbruch langer Jobs. Trenne funktionale Fehler von nicht erreichten Leistungszielen. Neue Beschleunigungsabhängigkeiten brauchen einen dokumentierten Entscheid und müssen dieselben Golden-Pixel erzeugen.

## Gate dieser Phase

Der gesamte Workflow ist mit Maus und Tastatur durchführbar. Keine nur farblich oder per Rechtsklick versteckten Pflichtinformationen. Messungen und Referenzgerät sind protokolliert. Cache bleibt begrenzt, lange Jobs reagieren. Keine erfundenen FPS- oder Plattformresultate.

## Erwartetes Ergebnis

Usability-Korrekturen, Benchmark-/Profilingbericht, optimierte begrenzte Caches und Desktop-Abnahmeprotokoll.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P19 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P20 — Native Builds, Tooling und Codespaces

**Abhängigkeiten:** P19
**Spezifikation:** Kapitel 2, 18, 21–22
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Integriere die Studio-Tests und Buildabläufe in das vorhandene Python-Tooling und die CI. Erhalte nachvollziehbare style-/check-Gates und die vorhandene Installationspolitik. Aktualisiere Produktmetadaten und Desktop-Exportkonfigurationen konsistent, ohne Sicherheitsprüfungen einfach abzuschalten.

Erzeuge native Testartefakte für Windows, Linux und macOS mit der festgelegten Godot-Version und passenden offiziellen Exportvorlagen. Prüfe je zugesicherter Plattform Start, Dateidialog und einen kleinen Speichern-/Export-Durchlauf. Endnutzer benötigen keinen zusätzlichen Python-Prozess und keinen Godot-Editor für die Benutzung der exportierten Studio-App.

Dokumentiere Signierung/Notarisierung, soweit relevant, als eigenen Freigabeschritt. Erfinde keine Signatur und speichere keine Zertifikate oder Geheimnisse im Repository. Veröffentlichung, Tagging und Push bleiben explizit beauftragte Aktionen, nicht automatische Nebenwirkungen dieser Phase.

Ergänze bei Bedarf eine Codespaces-/Devcontainer-Konfiguration für Codearbeit und Headless-Tests. Kein Webexport und keine mobile Studio-Ausgabe. Erkläre, dass Portweiterleitung keine native GUI-Vorschau ersetzt. Prüfe welche Tests dort tatsächlich laufen können.

## Gate dieser Phase

Vorhandene und neue Gates sind in Tooling/CI eingebunden. Für jede Plattform gibt es ein tatsächliches Testresultat oder einen offen benannten Blocker; ungeprüfte Plattformen gelten nicht als abgenommen. Artefakte enthalten keine Nutzer-Vault oder Geheimnisse. Codespaces-Dokumentation verspricht keine nicht vorhandene Desktop-Vorschau.

## Erwartetes Ergebnis

Desktop-Buildkonfigurationen, CI-/Tooling-Erweiterungen, Testartefakte soweit erzeugbar, Plattformmatrix und Entwicklungsanleitung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P20 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P21 — Anleitung und nachvollziehbare Beispiel-Vault

**Abhängigkeiten:** P20
**Spezifikation:** Kapitel 4, 10–17, 21–24
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erstelle eine kleine eigene, rechtlich unproblematische Beispiel-Vault: ein Spielprojekt, ein 80-px-NPC-Bereich, freigegebene Bewegungen, zwei unterschiedlich ausgestattete NPCs und mehrere Aktionen je Figur. Nutze selbst erzeugte einfache Pixelteile oder eindeutig freigegebene Quellen mit Herkunftsnotiz.

Die Beispiel-Vault muss den realen Produktionsworkflow verwenden und erneut geöffnet werden können. Sie ist kein UI-Mock. Zeige Wiederverwendung einer Vorlage, lokale Fittingkorrektur, Equipment ohne Eigenbewegung und ein vollständiges Godot-Paket.

Schreibe eine deutsche Schritt-für-Schritt-Anleitung vom leeren Ordner bis zur Spieleinbindung. Erkläre Projekt/Bereich/Vorlage/NPC/Zuordnung, Figurenhöhe gegenüber Framefläche, Freigaben, Spiegelgrenzen, Speicherstruktur, Recovery und den Unterschied zwischen Quelle und Export. Keine Aussagen über Funktionen, die tatsächlich noch nicht fertig sind.

Aktualisiere README und Dokumentationsindex über die vorhandenen Mechanismen. Ergänze bekannte Einschränkungen, tatsächliche Plattform-/Godot-Versionen und einen kurzen Fehlerbericht-Leitfaden ohne private Daten. Prüfe, dass Nutzer die exportierte App verwenden können, ohne das Entwickler-Tooling zu installieren.

## Gate dieser Phase

Die Beispiel-Vault lässt sich in einer sauberen Umgebung öffnen und exportieren. Eine Person kann der Anleitung ohne versteckte Schritte folgen. Screenshots, falls erstellt, stammen aus dem tatsächlichen Studio. Alle dokumentierten Funktionen und getesteten Versionen stimmen mit dem implementierten Stand überein.

## Erwartetes Ergebnis

Beispiel-Vault beziehungsweise reproduzierbarer Generator, deutsche Nutzeranleitung, aktualisierte Einstiegseiten und Einschränkungsübersicht.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P21 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

# P22 — Gesamtabnahme und überprüfbarer Abschluss

**Abhängigkeiten:** P00–P21 mit dokumentierten Gates.
**Spezifikation:** Kapitel 1–25, insbesondere 21–23
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

## Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im vorhandenen Tooling-Template als Tauri-Desktop-App; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Arbeite RQ-01 bis RQ-40 sowie die Ende-zu-Ende-Szenarien A bis J einzeln durch. Verweise pro Anforderung auf implementierte Komponenten und tatsächliche Tests oder manuelle Belege. Eine vorhandene Datei allein ist kein Funktionsnachweis.

Prüfe die gesamte Kette: Vault öffnen, Projekt und Bereich anlegen, Dummy animieren, acht Richtungen freigeben, PNGs importieren, anziehen, feinjustieren, NPC benennen, weitere Bewegung zuordnen, neu öffnen und als PNG/JSON/Godot exportieren. Wiederhole den Godot-Import in einem frischen Projekt.

Kontrolliere die Negativanforderungen: kein SQL/SQLite für die Studio-Daten, keine fachlichen Projektquellen im globalen Metadatenordner, kein erforderlicher Bone-/Skeleton-Aufbau, kein mobiles/webbasiertes Studio und keine Python-Pflicht für Endnutzer. Prüfe unveränderte ursprüngliche Quelldateien und intakte Revisionsreferenzen.

Führe die verfügbaren vollständigen Repository-Gates und Plattformprüfungen aus. Behebe echte Fehler oder dokumentiere konkrete Blocker. Setze nur tatsächlich bestandene Phasen auf abgeschlossen. Veröffentliche keinen Release und pushe keine Änderungen ohne gesonderten Auftrag.

Schließe den ExecPlan mit tatsächlichen Ergebnissen, Prüfungen, verbleibenden Grenzen und einem klaren nächsten fachlichen Schritt. Spätere Körperprofile oder KI-Funktionen werden nicht nachträglich zum Pflichtumfang erklärt.

## Gate dieser Phase

Alle Muss-Anforderungen haben nachvollziehbare Belege oder ausdrücklich offene, nicht als erledigt markierte Einträge. Keine unbelegten Test-, Leistungs- oder Plattformbehauptungen. Der dokumentierte Funktionsstand stimmt mit Anwendung, Daten und Exporten überein.

## Erwartetes Ergebnis

Abnahmematrix, abschließendes Testprotokoll, aktueller ExecPlan und ehrlicher Implementierungsabschluss ohne automatische Veröffentlichung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P22 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.
