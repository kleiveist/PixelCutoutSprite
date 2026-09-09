# Vertragshüllen und Kataloge

Die acht `*.schema.json`-Dateien sind eigenständige JSON-Schema-2020-12-Entwürfe. Sie fixieren die neuen Dokumentfamilien und strukturieren die Umsetzung. Die Typ- und Teilekataloge sind die gemeinsamen Register für UI, Pfade, Export und Import.

**Wichtig:** JSON-Schema-Hüllen ersetzen keine vollständige Fachvalidierung. `answers` wird zusätzlich gegen die vorhandenen bzw. in P28 aktualisierten Kategorievalidatoren geprüft. Sichere relative Pfade brauchen zusätzliche native kanonisierte/handlegebundene Prüfungen. Eindeutige Part-IDs, die gegenseitige Exklusivität von Gürtel/Schwert, Quellgrenzen, Pivotformel, Pflichtteilabdeckung, Dateihashes und Szenenreferenzen werden semantisch geprüft.

Neue Schemafamilien sind absichtlich versioniert. Base-/Prompt-Werte sind als V3-Nachfolger des vorhandenen V2-Modells gedacht; alte V2-Decoder bleiben ausschließlich für die Migration. Neue, weitere Ausgabevarianten werden über ein explizit versioniertes Generatorregister ergänzt und nicht durch stille Schema-Aufweichung akzeptiert.

Der beiliegende Prüfer validiert die Beispieldateien und zentrale semantische Invarianten. Er ist eine Paketprüfung und noch keine produktive TypeScript-/Rust-Implementierung dieser Verträge. Die Implementierung muss positive und negative Tests in beiden Laufzeitgrenzen besitzen.
