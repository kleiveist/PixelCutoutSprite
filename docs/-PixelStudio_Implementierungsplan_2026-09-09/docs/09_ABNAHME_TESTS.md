# 09 · Abnahme und Teststrategie

## Status dieses Dokuments

Die folgenden Tests sind **auszuführende Abnahmekriterien**, nicht bereits bestandene App-Tests. Dieses Planpaket wurde separat auf interne Struktur, JSON-Beispiele, Verweise und Vollständigkeit geprüft. Das ersetzt keinen Build oder Test der Anwendung.

## Vorhandene Befehlsanker

Aus README und `frontend/package.json` des untersuchten Commits sind folgende Einstiege belegt (S01/S02). Die Implementierung prüft vor Ausführung die tatsächlich verfügbare Umgebung.

```sh
# Repository-Root
python tools/control.py tauri install --skip-system-deps
python tools/control.py test --suite frontend
python tools/control.py tauri test --cargo

# Gezielte Frontend-Gates
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e

# Native manuelle Sitzung / Linux-Testkandidat
python tools/control.py tauri run --foreground
python tools/control.py tauri build --target linux --bundles deb
python tools/control.py tauri smoke --target linux
```

Installation/Systemabhängigkeiten nur im dafür vorgesehenen Entwicklungsumfeld durchführen. Ein fehlender Browser oder eine fehlende native Bibliothek wird mit konkreter Fehlermeldung dokumentiert. `test:e2e` besitzt im aktuellen npm-Skript einen vorgeschalteten Build. Keine erfundenen neuen `control.py`-Unterbefehle verwenden; weitere Möglichkeiten zuvor über das vorhandene Tooling prüfen.

## Testebenen

Reine Unit-Tests prüfen Namen, Kataloge, Step-Mapping, Maskenoperationen, Bounding-Boxen und Koordinaten. Komponenten-/Browsertests prüfen Formulare, Navigation, Dialoge und Autosave-Anzeigen mit kontrollierten Adaptern. Native Integration prüft echte Dateien, Locks, Journal-Recovery, Decoder, Plattformpfade, Close-Requests und Explorer. Manuelle Qualitätsabnahme ergänzt insbesondere Segmentierung, Canvas-Bedienung und Barrierefreiheit.

## T01 · Shell und Navigation

**Ebene:** Komponenten-/Browsertest.

**Durchführung:** Öffne nacheinander Prompt, Cutout und Sprite, außerdem eine Willkommen-Ansicht ohne lokale Aktionen. Prüfe die Headeraktionen und schalte per Tastatur zwischen Modulen.

**Erwartung:** Genau ein globaler Header, ein Zahnrad neben Hilfe und eine gemeinsame Navigation-Row pro Modul. Keine CSS-Hash-Abhängigkeit. Kein doppelter Prompt-Navigationsbereich.

## T02 · Popup-Dismiss und Fokus

**Ebene:** Komponenten-/Browsertest; native Stichprobe.

**Durchführung:** Prüfe Einstellungen, Basisprofil und Kategorie-Liste jeweils mit X, Escape und Backdrop. Klicke innen, ziehe einen Pointer von innen nach außen, tabbe vorwärts und rückwärts. Öffne den Dialog erneut.

**Erwartung:** Alle vereinbarten Schließwege funktionieren. Inneninteraktion schließt nicht. Fokus bleibt im Modal und kehrt zum Auslöser zurück. Schließen bestätigt keine ungespeicherten Formulardaten.

## T03 · Halbes Fenster und Zoom

**Ebene:** Browser-Layouttest plus native Fensterprüfung.

**Durchführung:** Prüfe 1920×1080, 1440×900, 960×540, 720×450, 640×480 und 480×360 sowie 200 % Zoom. Ändere die Größe mit offenem Dialog, aktivem Pinsel und View-Liste.

**Erwartung:** Keine alte 1280-px-Mindestbarriere. Keine unerreichbaren Buttons oder globale horizontale Überbreite. Drawer/Scroll funktioniert. Resize verändert keine Quellpixelmasken.

## T04 · Vault-Isolation

**Ebene:** Native Dateisystemintegration.

**Durchführung:** Erzeuge Vault A und B mit jeweils einem Asset namens Kleif und unterschiedlichen Basiswerten. Verzögere einen Save in A und fordere den Wechsel nach B an. Öffne beide nach Neustart.

**Erwartung:** Keine Dateien oder verspäteten Antworten aus A landen in B. Ein blockierter Flush hält den alten Kontext sichtbar. Dateipfade stammen aus der erfassten Sitzung.

## T05 · Keine Fachpersistenz außerhalb des Vaults

**Ebene:** Native Dateisystemtest plus Browser-Storage-Spies.

**Durchführung:** Erfasse App-Data-/Konfigurationszustand vor und nach Profilanlage, Wizard, Masken und Szene. Instrumentiere localStorage/IndexedDB im produktiven Adapterpfad. Wiederhole mit Legacy-Daten.

**Erwartung:** Nur erlaubte globale UI-Daten bzw. letzte Pfade außerhalb des Vaults. Keine neuen Antworten, Profile, Masken oder Szenen dort. Inaktive Legacy-Quelldateien werden nicht weitergeschrieben.

## T06 · Ein Basisprofil

**Ebene:** Repository-/Formulartest.

**Durchführung:** Lege eine Basis an, ändere sie und versuche eine zweite parallele Änderung mit alter Revision. Öffne das Popup mit ungültigen Werten und schließe es über jeden Dismiss-Weg.

**Erwartung:** Ein fester Basis-Pfad, stabile ID, steigende Revision. Veraltetes CAS scheitert. Die Button-Zusammenfassung zeigt gespeicherte Werte; ungespeicherte Werte werden nicht aktiv.

## T07 · Autosave und unvollständige Identität

**Ebene:** Integration mit deterministischer Uhr.

**Durchführung:** Tippe zunächst keinen Namen, später Name/Typ/Untertyp. Erzeuge valide Antworten, mache dann ein Pflichtfeld ungültig und schließe nach Flush. Prüfe kanonische Dateien und Draft-Journal.

**Erwartung:** Keine leeren/undefined-Ordner. Rohzustände bleiben lokal erhalten. Valide Generationen werden nicht durch leere Texte ersetzt. Gespeicherter Draft und aktuelle Ausgabe sind getrennt gekennzeichnet.

## T08 · Crash-sichere Publikation

**Ebene:** Rust-Fault-Injection auf temporären Vaults.

**Durchführung:** Unterbreche Schreiben nach jedem dokumentierten Journal-/Publish-Schritt. Simuliere vollen Datenträger und Rename-Fehler. Starte Recovery, prüfe anschließend Profilsatz bzw. PNG-Set.

**Erwartung:** Entweder eine vollständige alte oder neue lesbare Generation. Keine falsche Erfolgsmeldung, kein gemischtes Set als fertig. Fremde/geänderte Dateien werden nicht überschrieben.

## T09 · Writer und externe Konflikte

**Ebene:** Native Integration.

**Durchführung:** Öffne denselben Vault mit zwei Instanzen. Ändere zusätzlich eine JSON oder generierte MD extern zwischen Lesen und Speichern. Versuche CAS mit alter Revision.

**Erwartung:** Zweiter Writer bleibt read-only oder erhält einen klaren Lockfehler. Externe Änderungen lösen Konflikte aus; kein stiller Last-writer-wins-Verlust. Recovery-Lock nicht blind löschen.

## T10 · Namen und Umbenennung

**Ebene:** Property-/Dateisystemtests.

**Durchführung:** Prüfe Kleif, Umlaute, kombinierte Unicode-Zeichen, Groß-/Kleinschreibung, lange Namen, abschließende Punkte, Gerätenamen und unerlaubte Pfadtrennzeichen. Ändere Name sowie Typ/Untertyp eines bestehenden Profils.

**Erwartung:** Sichere vorhersehbare Pfade, stabile IDs, keine Kollision/Überschreibung. Alle selbst verwalteten Dateinamen und Referenzen wandern konsistent. Unbekannte Nachbardateien bleiben bestehen.

## T11 · Legacy-Übernahme

**Ebene:** Konvertertest plus native Integration.

**Durchführung:** Verwende V1-/V2-Fixtures mit mehreren Basisprofilen, Kategorie-Overrides, Drafts, fehlenden Namen, gleichen Namen und beschädigten Einträgen. Führe Preview, bestätigte Migration, Abbruch und Wiederholung aus.

**Erwartung:** Preview bleibt schreibfrei. Inkompatible Basen erfordern sichtbare Zuordnung/Entscheidung. Quelle bleibt unverändert, Ziel wiederlesbar und Wiederholung idempotent. Keine erfolgreiche Gesamtmeldung bei ungelösten Einträgen.

## T12 · Dateimanager

**Ebene:** Native Windows-/macOS-/Linux-Prüfung.

**Durchführung:** Öffne aus Ausgabe die aktuelle MD, aus Profil die JSON und den Zielordner. Prüfe ungültiges/fremdes Ziel. Auf Windows dokumentiere Fensterzahl und ausgewählte Datei vor/nach Aktion.

**Erwartung:** Richtiges Ziel im System-Dateimanager, keine fremden Pfade. Eine neue Explorer-Fensterinstanz ist nur bestanden, wenn nativ beobachtet; Plugin-Mocks beweisen das nicht.

## T13 · Pfad- und Dateisicherheit

**Ebene:** Rust-Sicherheits-/Decoder-Tests.

**Durchführung:** Prüfe Traversal, absolute Pfade, manipulierte Manifestpfade, Symlinks/Junctions und Austausch von Elternpfaden. Füttere zu große Bildheader, kaputte PNGs und unbekannte Schema-Versionen.

**Erwartung:** Kein Zugriff außerhalb der Sitzung, begrenzte Allokation und typisierte Fehler. Daten unbekannter Versionen werden nicht mit Defaults überschrieben. Keine globale CSP-/Capability-Abschaltung.

## T14 · Scan, Watcher und externe Änderungen

**Ebene:** Integration.

**Durchführung:** Lege/lösche/benenne Profile im Dateimanager um, füge eine kaputte JSON und doppelte Profil-ID hinzu. Starte ohne Index und aktualisiere manuell. Wechsle danach den Vault.

**Erwartung:** Index kann rekonstruiert werden, Fehler einzelner Dateien sind isoliert. Doppelte IDs werden als Konflikt erkannt. Alte Watcher verändern den neuen Vault nicht.

## T15 · Typen und Ablage

**Ebene:** Daten-/Browserintegration.

**Durchführung:** Erzeuge für jeden der neun Typen mindestens ein Profil mit einem geforderten Untertyp. Prüfe Typ-IDs, sichere Ordnerlabels, Icons, Anzahl und Namen.

**Erwartung:** Alle Typen und Beispiele erreichbar. Vorhandene zusätzliche Untertypen werden nicht unbegründet entfernt. Dashboard zählt ein Profil und nicht dessen vier oder mehr MD-Dateien.

## T16 · Wizard-Roundtrip

**Ebene:** Komponenten-/Browser-/Native-Roundtrip.

**Durchführung:** Durchlaufe jede Kategorie anhand des P28-Frageninventars. Gehe zurück, wechsle Seiten, ändere Typ mit inkompatiblen Antworten, lade neu und starte die App neu.

**Erwartung:** Name oben, echte einzelne Katalogseiten, kein Basis-Schritt. Alle vorgesehenen Fragen erreichbar. Werte und stabile Step-ID bleiben erhalten; inkompatible Daten werden nicht still umgedeutet.

## T17 · Dashboard-Popup und Laden

**Ebene:** Browserintegration mit echtem Repository-Adaptertest.

**Durchführung:** Öffne eine Kategorie mit mehreren Untertypen und gleichartigen Namen. Suche, lade ein bestimmtes Profil, prüfe Antworten, Kategorie und Schritt. Wiederhole mit kaputtem Profil.

**Erwartung:** Geladen wird der vollständige Dateizustand der gewählten ID. Popup schließt korrekt. Fehler ändern die bestehende Sitzung nicht. Kein bloßes Einfügen des fertigen Prompttexts.

## T18 · Ausgaben und entfernte Aktionen

**Ebene:** Generator-/UI-Integration.

**Durchführung:** Vergleiche jede registrierte Stil-/Sprachkombination mit dem unveränderten fachlichen Generatorinventar. Prüfe alle vier Dateitypen, Hashes und UI-Inhalt. Suche produktive Export-/Copy-/JSON-Export-/Handoff-Buttons.

**Erwartung:** Varianten bleiben vollständig und konsistent, Dateien entstehen automatisch. Keine verbotenen Aktionsbuttons/Settings-Fallbacks. Normaler Text bleibt auswählbar.

## T19 · Basisrevision und Regenerierung

**Ebene:** Integration mit Fehlerunterbrechung.

**Durchführung:** Ändere eine Basis mit mehreren fertigen und unvollständigen Profilen. Unterbreche die Regenerierung eines Profils, starte neu und lasse fortsetzen.

**Erwartung:** Betroffene Ausgaben werden erkennbar stale. Nur erfolgreich publizierte neue Basisrevisionen sind fresh. Unvollständige Profile bleiben Entwürfe; andere Vaults unverändert.

## T20 · Tatsächlicher Rückbau

**Ebene:** Import-/Command-Graph plus Regression.

**Durchführung:** Prüfe produktive Router, Imports und native Handler auf alte Projekt-/Area-/Motion-/NPC-/Godot-Funktionen. Öffne eine Kopie eines alten Vaults und vergleiche Dateihashes.

**Erwartung:** Nicht nur Menüs, sondern auch produktive alte Fachcommands/-abhängigkeiten entfernt. Neue Cutout-Willkommen-Seite funktioniert. Alte Nutzerdateien und unabhängiges Tooling unverändert.

## T21 · Gemeinsame Datei-Toolbar

**Ebene:** Komponenten-/Native-Integration.

**Durchführung:** Nutze dieselbe Toolbar in beiden Bildmodulen. Navigiere mit Klick und Tastatur durch kleine/große Verzeichnisse, wähle Bild und Manifestordner, schalte Dateien/View um.

**Erwartung:** Gemeinsamer Implementierungskern, begrenztes Listing, korrekte sitzungsgebundene Auswahl. Keine Verwechslung technischer Masken-/Quellordner mit Originalen. Registerwechsel verliert keinen Editorzustand.

## T22 · Manuelle Masken und Koordinaten

**Ebene:** Canvas-/Domänentests.

**Durchführung:** Prüfe sechs Gruppen und drei Untereinträge, Flyout am linken Rand, Quelle mit asymmetrischer Geometrie, Zoom/DPI/Resize, Pinsel bis zum Bildrand und Wiederöffnung.

**Erwartung:** Feste anatomische Seiten/Datei-IDs. Masken in Quellpixeln, aktive/bestätigte Anzeige korrekt und zugänglich. Undo/Redo und bestätigte Zustände bleiben konsistent.

## T23 · Assistierte Auswahl und Überlappung

**Ebene:** Algorithmusfixtures plus manuelle Qualitätsabnahme.

**Durchführung:** Nutze transparente und opake Bilder, mehrere Farben, gleiche Arm-/Torso-Farbe, dünne Konturen und eine Hand mit Anschlusszugabe. Korrigiere positiv/negativ; breche Jobs ab und editiere während einer Antwort.

**Erwartung:** Sichtbarer Hintergrund wird in eindeutigen Fällen entfernt. Schwierige Grenzen sind korrigierbar. Anschlusszugaben bleiben erhalten, Nachbarmasken unverändert und veraltete Resultate werden verworfen. Laufzeit/Qualität ehrlich protokolliert.

## T24 · PNG-Set und Manifest

**Ebene:** Native Pixel-/Dateisystemtests.

**Durchführung:** Erzeuge alle Standardteile, optionale Varianten und not_present-Fälle. Prüfe RGB/Alpha, Bounding-Box, Pivotformel, Hashes, Wiedererzeugen mit entferntem Extra und unveränderte Original-/Fremddateien.

**Erwartung:** Exakte Dateinamen, keine Leer-PNGs, vollständige Manifestgeneration. PNG-Ausschnitte erhalten Quellpixel. Recovery lässt keinen halbfertigen Satz als fertig erscheinen. Schnittprojekt wiederöffnbar.

## T25 · Zusammensetzung, View und Szene

**Ebene:** Canvas-/Native-Roundtrip.

**Durchführung:** Klicke einen korrekten Teileordner, prüfe Originalpositionen, nicht mittige Pivots und Zeichenfolge. Ändere Ebenen, Sichtbarkeit, Sperre und Transformationen. Starte neu und ersetze danach das Teilemanifest.

**Erwartung:** Autoanordnung stimmt mit Metadaten überein. Szene bleibt gespeichert und nicht destruktiv. Neue Generation verlangt kontrollierten Abgleich. Ohne Manifest keine erfundenen Crop-Offsets. Halbtransparente Überlappung folgt dokumentiertem Source-over.

## T26 · Barrierefreie Kernbedienung

**Ebene:** Automatisierte Prüfung plus manueller Tastaturdurchlauf.

**Durchführung:** Durchlaufe Header, Modals, Wizard, Dateibaum, Teilwahl, Canvas-Werkzeugwechsel und View ohne Maus. Prüfe sichtbaren Fokus, Namen, 200 % Zoom und alternative Masken-/Statuskennzeichnung.

**Erwartung:** Kernaktionen sind erreichbar und verständlich, kein Fokusverlust hinter Dialogen, keine ausschließlich farbige Bedeutungsübertragung. Physisches Zeichnen per Pointer ist von der Tastaturbedienung der übrigen UI getrennt dokumentiert.

## T27 · Offline und vollständiger Desktop-Roundtrip

**Ebene:** Native End-to-End-/Build-Abnahme.

**Durchführung:** Führe den gesamten neuen Workflow mit gesperrtem Netz aus: Vault, Basis, Prompt, Cutout, Sprite, Close, Reopen. Erstelle verfügbare native Testpakete über das Repository-Tooling.

**Erwartung:** Kein Cloud-/Modellabruf. Echte Dateien und Änderungen überleben Neustart. Native Pakete/Plattformen werden nur mit realen Log-/Testnachweisen als bestanden bezeichnet.

## Release-Gates

Datenverlust, fachliches Speichern außerhalb des Vaults, Pfadflucht, gemischte als fertig bestätigte Dateigeneration, falsche Originalpositionen und fehlende Hauptabläufe sind Releaseblocker. Ein offener Windows-Neufenster-Nachweis ist als nicht erfüllter Plattformpunkt zu führen und darf nicht durch einen allgemein erfolgreichen Opener-Test verschwinden.

Frontend-Gates und Rust-Integration müssen grün sein. Native Plattformnachweise werden getrennt geführt. Unverfügbare Windows-/macOS-Umgebungen führen zu „nicht geprüft“, nicht zu einer Cross-Platform-Freigabe. Mindestens ein echter nativer End-to-End-Roundtrip ist erforderlich, bevor die Desktop-App insgesamt als abgenommen gelten kann.

## Nachweisformat

Jeder Phasenbericht enthält Datum, Commit, Betriebssystem, Toolversionen, Testbefehl, Exit-Code, Testnamen, Log-/Screenshotpfade, Anforderungen und offene Punkte. Abgeschaffte alte Fachtests werden mit Begründung auf die neue Anforderungsmatrix abgebildet. Allgemeine Sicherheitstests bleiben bestehen. Reports dürfen keine persönlichen Prompttexte, absoluten privaten Nutzerdatenpfade oder originale Benutzerbilder ungefragt in CI-Artefakte übernehmen.

## Testdaten

Nutze synthetische, kontrollierte Pixel-/Maskenfixtures sowie explizit freigegebene Beispielbilder. Vergleiche bei Einzelteilen Quellpixel und Alpha exakt. Eine Gleichheit des gesamten rekonstruierten Bilds ist nur für den beschriebenen vollständig deckenden Fixture-Fall vorgeschrieben; bei halbtransparenten Überlappungen gilt die separat definierte Source-over-Erwartung. Dokumentationsbeispiele ohne echte PNGs aus diesem Paket beweisen keine Pixelkorrektheit.
