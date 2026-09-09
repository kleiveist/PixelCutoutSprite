# Prüfung dieses Planpakets

Aus dem entpackten Paketverzeichnis ausführen:

```sh
python pruefung/validate_package.py
```

Voraussetzung sind Python 3.10 oder neuer sowie das installierte Python-Paket `jsonschema` mit Unterstützung für Draft 2020-12. Der Prüfer benötigt kein Netzwerk und verändert keine Dateien. Fehlt die Bibliothek oder ist eine Prüfung nicht erfolgreich, endet er mit einem Fehlercode statt einem vorgetäuschten Erfolg.

Geprüft werden die JSON-Dateien, acht Schemafamilien, acht JSON-Beispiele, die Referenzen zwischen Phasen/Anforderungen/Tests, lokale Markdown-Links, Teilekataloge, zentrale Manifest-/Szenenbeziehungen, die vier tatsächlich vorhandenen MD-Dateihashes und – sofern vorhanden – `SHA256SUMS.txt`. Vierzehn absichtlich ungültige Varianten müssen zurückgewiesen werden.

`PAKET_MANIFEST.json` enthält das Dateiinventar mit Größe und SHA-256. Es erfasst alle Paketdateien außer sich selbst und der Hashliste. `SHA256SUMS.txt` erfasst alle Paketdateien außer sich selbst, also auch das Manifest. Diese Hashes belegen interne Unverändertheit, keine digitale Herausgebersignatur.

Die 27 Testfälle in `vertraege/tests.json` sind **geplante Abnahmetests für die noch zu implementierende App**, keine in diesem Auftrag bestandenen Anwendungstests. Die Sprite-Beispiele enthalten keine PNG-Dateien; ihre Bildhashes sind ausdrücklich dokumentierte Platzhalter. Der Paketprüfer ersetzt weder produktive Validatoren noch echte Bild- und Desktop-Tests.
