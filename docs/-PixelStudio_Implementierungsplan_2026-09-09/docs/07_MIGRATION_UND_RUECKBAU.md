# 07 · Migration, Bestandsschutz und Rückbau

## Zwei unterschiedliche Aufgaben

Der alte Cutout-Fachcode soll aus dem produktiven Programm entfernt werden. Vorhandene Nutzer-Vaults, Originalbilder, Exporte und App-Data-Altbestände dürfen dabei nicht gelöscht werden. Das Repository ist nicht identisch mit dem Datenträger des Nutzers. Ein Coding-Agent erhält deshalb keine pauschale Anweisung, lokale Vault-Ordner rekursiv zu entfernen.

Die Migration von Prompt-Profilen ist ein kontrollierter Einmalvorgang. Alte Cutout-Animationen werden nicht heimlich in das neue Maskenformat umgedeutet: Dafür fehlen häufig Schnittmasken und passende Koordinaten. Alte Daten bleiben außerhalb des neuen Funktionsumfangs lesbar auf dem Datenträger; Original-PNGs können als neue Bildquellen verwendet werden.

## Vorbereitungen

P28 dokumentiert den aktuellen Branch, den Ausgangscommit, bestehende Testbefehle und den Arbeitsbaum. Uncommittete Änderungen des Nutzers werden nicht zurückgesetzt. Ein abgeschlossener Planungs-/Baseline-Commit oder ein normaler Git-Branch genügt für die Code-Rückkehr; kein automatisches Release, Tag oder Push ist erforderlich.

Ein neu geöffnetes Verzeichnis wird zunächst untersucht. Ein normaler benutzergewählter Ordner kann als neuer Vault verwendet werden. Vorhandene alte Vault-Metadaten werden erkannt und nicht mit einer neuen Version überschrieben. Die neuen `.PixelStudio`- und `.PixelPrompt`-Ablagen werden neben bestehenden Nutzerdaten angelegt, sofern Pfad- und Schreibprüfung dies zulassen.

## Prompt-Migration

**Inventarisieren:** Der Legacy-Leseadapter erfasst die tatsächlich vorhandenen nativen Prompt-App-Data-Dateien und gegebenenfalls erreichbare V1-/V2-Browser-Schlüssel. Dateinamen werden aus dem aktuellen Code ermittelt, nicht geraten. Die Quelle wird nicht verändert. Ein bloßer Start der neuen App migriert nichts automatisch in einen zufälligen Vault.

**Zuordnen:** Der Nutzer wählt einen Ziel-Vault und sieht Anzahl, Namen, Kategorien, Entwürfe, Basisprofile und mögliche Konflikte. Alte `projectName`-Werte werden als Herkunftsmetadaten erhalten; sie dürfen nicht automatisch zur zweiten Projektverwaltung werden. Assetnamen kommen aus dem jeweiligen Assetprofil. Fehlt ein eindeutiger Assetname, ist ein sichtbarer Migrationsvorschlag mit stabiler ID erforderlich.

**Eine Basis wählen:** Existieren mehrere unterschiedliche alte Basisprofile, darf nur eines die aktive Basis des Ziel-Vaults werden. Profile mit inkompatiblen Basiswerten werden nicht still umgerechnet. Die Vorschau bietet Zuordnung in getrennte Vaults oder eine ausdrückliche, nachvollziehbare Übernahme auf die Zielbasis mit Darstellung der geänderten Werte. Vorhandene Kategorieprofil-/Override-Effekte werden feldweise aufgelöst und als Konflikt behandelt, wenn sie der einen Vault-Basis widersprechen. Unentscheidbare Datensätze bleiben unbearbeitet im Legacy-Bestand.

**Sichern und umwandeln:** Vor bestätigter Übernahme entsteht im Ziel-Vault ein lokales Herkunftsbackup unter `.PixelStudio/migration/<migrationId>/`. Es enthält nur die für diese bestätigte Migration ausgewählten Daten und ein Mapping-/Hash-Protokoll. Die Quell-App-Data bleibt zunächst unangetastet. Globale Anzeigeeinstellungen können gesondert in die neue Gerätekonfiguration übernommen werden; Profil-IDs und Antworten nicht.

**Prüfen und veröffentlichen:** Die neue Einzeldateistruktur wird vorbereitet, fachlich validiert, aus dem Zielpfad wieder gelesen und erst dann bestätigt. Bereits vorhandene Zielprofile werden nicht anhand gleicher Namen überschrieben. Ein Migrationsschlüssel aus Quellidentität und Hash verhindert Duplikate beim erneuten Start desselben Vorgangs. Eine unterbrochene Migration ist wiederaufnehmbar.

**Abschließen:** Nach erfolgreicher Übernahme schreibt die neue App keine Fachinhalte mehr in die alten App-Data-Dateien. Die Dateien bleiben als inaktive Altbestände bestehen, bis ein Nutzer sie außerhalb des normalen Workflows bewusst entfernt. Der Legacy-Leseweg wird getrennt vom produktiven Speichermodul gehalten; keine automatische Rückmigration und kein Dual-Write.

## Rückbau-Matrix

| Bereich | Zielentscheidung |
|---|---|
| Alte Cutout-Projekte/Areas | Produktive UI, DTOs und Commands entfernen; kein neuer Pflicht-Unterbau für Prompt oder Masken |
| Animationen, Timeline, Directions, Dummy-Editor | Fachcode, Router-Anbindung und zugehörige produktive Commands entfernen |
| Outfit-/Inventar-/NPC-Bindings | Alte Fachmodelle entfernen; DataFolderToolbar ist keine umbenannte alte Area-Inventarliste |
| Godot-/NPC-Export und alte Jobs | Aus dem neuen produktiven Funktionsumfang entfernen |
| Prompt-Handoff in eine Cutout-Area | Aufheben; der gemeinsame Vault ersetzt den früheren Übergabemechanismus |
| Prompt-Settings-Seite | Entfernen; allgemeine Darstellung lebt im globalen Dialog |
| App-Data-Profilbibliothek | Produktive Schreibseite entfernen; nur expliziter Legacy-Leseadapter bleibt vorübergehend |
| Allgemeine Safe-Path-, Lock-, JSON- und Recovery-Hilfen | Prüfen, extrahieren, auf neues Layout testen; bei alter Fachkopplung ersetzen |
| Toolchain, CI und `tools/` | Bewahren; nur produktbezogene Testlisten und Metadaten nachvollziehbar aktualisieren |
| Historische Akzeptanzberichte | Als historische Nachweise kennzeichnen, nicht fälschlich als aktuelle Release-Abnahme führen |
| Nutzer-Vaults und Originale | Unverändert erhalten; keine rekursive Säuberung |
| Prompt-Herkunft/Lizenzen | Behalten, solange entsprechender Quellcode weiterverwendet wird |

## Rückbau muss sichtbar nachweisbar sein

P37 führt einen dokumentierten Import-/Command-Graph ein: Welche alten Komponenten sind noch vom produktiven Einstieg erreichbar? Welche registrierten Rust-Commands sind überflüssig? Der Abschluss verlangt nicht nur entfernte Menüpunkte, sondern auch keine produktiven alten Area-/NPC-/Motion-Abhängigkeiten im neuen Cutout-/Sprite-Modul.

Alte Tests werden nicht wahllos gelöscht. Allgemeine Sicherheits-, Pfad-, Lock- und Recovery-Tests bleiben bzw. werden auf den neuen Service übertragen. Tests bewusst abgeschaffter Funktionen werden mit ihrer Anforderungs-ID als abgelöst dokumentiert. Neue Regressionstests beweisen, dass entfernte Routen und Commands nicht mehr aufrufbar sind.

## Rückkehr und Datenverträglichkeit

Ein Code-Rollback wird über Git vorgenommen. Neue V3-Profile oder Sprite-Manifeste werden dabei nicht auf V2 zurückgeschrieben. Die alte App darf die neuen Formate nicht unbemerkt verändern. Für Abnahmetests werden Kopien von Test-Vaults verwendet, keine einzigen produktiven Originale. Migrations- und Transaktionsjournale sind zu dokumentieren, damit eine Recovery nicht vom Gedächtnis einer bestimmten App-Instanz abhängt.
