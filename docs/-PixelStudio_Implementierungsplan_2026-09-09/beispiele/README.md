# Dokumentationsbeispiele, kein fertiger Beispiel-Vault

`VaultProjekt1` zeigt die geplanten Dateihüllen und Pfade. Die vier MD-Dateien enthalten eigens formulierten Beispieltext, nicht ein behauptetes Ergebnis des vorhandenen Prompt-Generators. Ihre Hashes sind echt und passen zu den gelieferten Dateien.

Das Beispiel-Promptprofil ist absichtlich `incomplete`: leere Antworten, aktuelle Draft-Revision 2, letzte illustrative Ausgabe aus Revision 1. Der Status `stale` demonstriert, dass unvollständige aktuelle Eingaben die letzte gültige Ausgabe nicht automatisch zu einer frischen Ausgabe machen.

Die Sprite-Beispiele enthalten **keine Bilddateien**. Alle mit 64 Nullen gefüllten Bild-/Masken-Hashes sind ausdrücklich Platzhalter. Crop-Rechtecke, Pivots, Default-Positionen und Szenenreferenzen sind untereinander konsistent, aber weder Pixelinhalt noch Bildhash wurden damit verifiziert. Ein produktiver Loader muss diese Ordner ohne die echten PNGs ablehnen.

Die Beispiele sind nicht als unverändert zu öffnender Demo-Vault gedacht. Die Implementierung erzeugt erst in P38–P41 echte Bilder, Masken und deren Hashes. Die Paketprüfung untersucht nur Schema und Metadaten-Konsistenz dieser Beispiele.

`Geraet/global-settings.json` veranschaulicht die bewusst getrennte lokale UI-Konfiguration. Sie ist kein Beispiel für fachliche Profildaten außerhalb des Vaults.
