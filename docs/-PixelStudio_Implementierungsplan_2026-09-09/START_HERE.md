# PixelStudio – Implementierungsplan
## Vault-zentrierter Umbau · Stand 9. September 2026

Dieses Paket übersetzt die Anforderungen in einen umsetzbaren Umbau des Repositories **kleiveist/PixelCutoutSprite**. Es enthält einen Plan und Arbeits-Prompts, **keine bereits umgebaute Anwendung**. Das Repository wurde über GitHub gezielt statisch untersucht; es wurde nicht verändert. Ein lokaler Build oder ein Lauf der Anwendung wurde für diesen Plan nicht ausgeführt.

**Untersuchter main-Stand:** `9efa821bc21b0099dc2f0d51895e472fc02b737f`, Commit „test: verify integrated studio workflows“, 6. September 2026. Die im Repository dokumentierte Reihe P00–P27 wird mit **P28–P43** fortgesetzt. Vor der Umsetzung den dann aktuellen Stand mit dieser Referenz vergleichen, nicht blind zurücksetzen.

### Ziel

Eine gemeinsame Desktop-App mit drei gleichberechtigten Bereichen: **PixelPromptStudio**, **PixelCutoutSprite** und **PixelSpriteStudio**. Fachliche Daten liegen ausschließlich im ausgewählten Vault. Globale Anzeigeeinstellungen liegen getrennt davon. Die bisherige Cutout-Fachanwendung wird ersetzt, nicht nur hinter einer neuen Startseite versteckt.

### So werden die Prompts eingesetzt

Das Paket in das Arbeits-Repository beispielsweise unter `docs/rebuild-plan/` kopieren. Zuerst `prompts/00_MASTER_PROMPT.md` an den Coding-Agenten geben. Anschließend die Phasen **P28 bis P43 in aufsteigender Reihenfolge**, jeweils mit dem passenden Prompt, bearbeiten lassen. Jeder Phasen-Prompt setzt die Paketdateien als lesbaren Kontext voraus. Nicht alle Phasen ungeprüft in einem einzigen Lauf umsetzen.

Nach jeder Phase den verlangten Abschlussbericht, die Tests und die Abnahmekriterien prüfen. Nicht ausgeführte Tests müssen als solche stehen bleiben. Die nächste Phase beginnt erst nach ihrem Eingangstor. P28 legt den tatsächlichen Baseline-Bericht und die projektspezifische Abbildung der bestehenden Schemas an.

### Wegweiser

| Datei/Bereich | Inhalt |
|---|---|
| `docs/01_REPO_ANALYSE.md` | Belegte Ausgangslage und konkrete Umbau-Anker |
| `docs/02_ANFORDERUNGEN.md` | Anforderungsmatrix mit IDs und Phasenzuordnung |
| `docs/03_ZIELARCHITEKTUR.md` | Modulgrenzen, Zustände, Sicherheit, Verantwortlichkeiten |
| `docs/04_DATENVERTRAEGE.md` | Ordner, Dateien, Autosave, Konsistenz und Versionierung |
| `docs/05_UI_UND_WORKFLOWS.md` | Navigation, Dialoge, Wizard, Dateiwerkzeuge, Responsive-Verhalten |
| `docs/06_SEGMENTIERUNG_UND_SPRITES.md` | Auswahlalgorithmus, Überlappungen, PNGs und Zusammensetzen |
| `docs/07_MIGRATION_UND_RUECKBAU.md` | Bestandsschutz und vollständiger fachlicher Rückbau |
| `docs/08_PHASENPLAN.md` | Reihenfolge, Abhängigkeiten und Eingangstore |
| `docs/09_ABNAHME_TESTS.md` | Konkrete Prüffälle und Release-Gates |
| `docs/10_ENTSCHEIDUNGEN_UND_RISIKEN.md` | Aufgelöste Unklarheiten und technische Risiken |
| `docs/11_QUELLEN.md` | Commit-feste Repository-Quellen und Primärdokumentation |
| `docs/12_DATEI_AENDERUNGSMATRIX.md` | Bestehende Datei-Anker und vorgeschlagene neue Dateien |
| `prompts/` | Master-Prompt und 16 einzeln ausführbare Phasen-Prompts |
| `vertraege/` | JSON-Schemas und feste Kataloge |
| `beispiele/` | Dokumentationsbeispiele für Profile, Ausgaben und Sprite-Metadaten |
| `pruefung/` | Paketprüfung; keine vorgetäuschten App-Testergebnisse |

### Besonders wichtige Entscheidungen

„Vault“ ersetzt das bisherige separate Prompt-Projekt. Pro Vault gibt es genau eine aktive Datei `basisprofil.json`. Der Wizard enthält keinen Basisprofil-Editor. Seine Antworten und alle Ausgabevarianten werden automatisch im Vault gespeichert. App-Data und Browser-Storage sind kein Ausweichspeicher für Fachinhalte.

Die 15 Körperteile behalten exakt die gewünschte Nummerierung. Die drei optionalen Extra-Slots heißen **Cape, Zubehör, Haare**. Zubehör ist wahlweise **Schwert oder Gürtel-Accessoire**. So bleibt die bisher genannte Datei `17_belt_accessory.png` möglich, ohne eine vierte Extra-Kategorie einzuführen. Diese Auslegung ist im Entscheidungsprotokoll ausdrücklich gekennzeichnet.

Zum automatischen Zusammenbauen gehört `sprite.parts.json`: Ein Dateiname enthält keine ursprüngliche Schnittposition. Die Datei speichert deshalb Ausschnitt, Platzierung und Ebenen-Vorgaben. Die automatische Auswahl ist eine lokale Auswahlhilfe mit manueller Korrektur, keine Zusage fehlerfreier Körperteilerkennung.

**Verbindlichkeit:** Die Anforderungen und Entscheidungen im Paket bilden die Zielvorgabe. Neue Dateipfade und neue Schemas sind als Zielentwurf zu verstehen; ihre Implementierung ist Aufgabe der Phasen. Die referenzierten vorhandenen V2-Detailvalidatoren werden weiterverwendet bzw. kontrolliert angepasst, nicht durch die vereinfachten Dokumentationsbeispiele ersetzt.
