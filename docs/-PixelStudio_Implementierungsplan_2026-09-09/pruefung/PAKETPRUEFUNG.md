# Durchgeführte Paketprüfung

**Datum:** 9. September 2026. **Gegenstand:** das vorliegende Planpaket, nicht die Anwendung.

## Tatsächlich ausgeführt

| Prüfung | Ergebnis |
|---|---|
| JSON-Syntax aller JSON-Dateien | Bestanden |
| JSON-Schema-2020-12-Metavalidierung | Acht eigenständige Schemafamilien bestanden |
| Validierung der Dokumentationsbeispiele | Acht JSON-Beispiele bestanden |
| Phasen und Reihenfolge | P28–P43, 16 Prompts, gültige gerichtete Abhängigkeiten |
| Anforderungsabdeckung | 52 Anforderungen mit gültigen Phasen- und Testreferenzen |
| Testkatalog | 27 geplante App-Abnahmetests mit Anforderungsbezug |
| Lokale Markdown-Links | 16 Dateiverweise aufgelöst |
| Typ- und Teilekataloge | Neun Typen; sechs Teilegruppen mit je drei Slots; 15 Pflichtteile |
| Sprite-Metadaten | Crop-Grenzen, Pivotformel, IDs, Parent-Graph und Szenenreferenzen konsistent |
| Negative Paketproben | 14 absichtlich ungültige Varianten korrekt abgelehnt |
| Reale MD-Dateihashes | Vier Ausgabedateien stimmen mit ihren SHA-256-Werten überein |
| Paket-Hashliste | Nach Verpackung erneut gegen alle eingetragenen Dateien geprüft |
| ZIP-Integrität | Nach Erstellung mit vollständigem CRC-Test und Entpackprüfung geprüft |

## Nicht ausgeführt und nicht behauptet

Es wurde kein App-Build, kein Frontend-/Rust-Testsuite-Lauf und kein nativer Desktop-Start des Repositories durchgeführt. Segmentierungsqualität, PNG-Inhalte, UI-Screenshots und Windows-/macOS-/Linux-Funktionsgates sind daher keine Ergebnisse dieser Paketprüfung. Die zugehörigen Arbeiten und die erforderlichen Nachweise stehen im Phasen- und Testplan.

Die Repository-Analyse beruht auf gezielten statischen GitHub-Lesezugriffen am dokumentierten Commit. Es wurde kein Code in das Repository geschrieben und kein Pull Request angelegt.

Die beiliegenden Schemas prüfen Dateihüllen. Vollständige Fachvalidatoren für Kategorieantworten sowie native sichere Dateioperationen bleiben Implementierungsaufgaben. Die Bild-/Masken-Hash-Platzhalter der Sprite-Beispiele sind ausdrücklich kein Nachweis gültiger Bilder.

## Wiederholbarkeit

`python pruefung/validate_package.py` prüft das entpackte Paket erneut. Ein erfolgreicher Lauf nennt die tatsächlichen Mengen; nach Aufnahme des Paketmanifests sind es 22 JSON-Dateien. Eine Änderung an den Paketdateien führt bei unveränderter Hashliste zu einer nachvollziehbaren Hashabweichung.
