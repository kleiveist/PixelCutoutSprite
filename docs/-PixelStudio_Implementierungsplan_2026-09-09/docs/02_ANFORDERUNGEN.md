# 02 · Anforderungsmatrix

Alle Punkte sind Zielanforderungen, keine Behauptung bereits erfolgter Implementierung. Die Test-IDs werden in `09_ABNAHME_TESTS.md` erklärt. Die Typ- und Teilekataloge liegen zusätzlich als JSON im Paket. Die Widerspruchsauflösungen stehen in `10_ENTSCHEIDUNGEN_UND_RISIKEN.md`.

| ID | Anforderung | Umsetzungsphasen | Abnahme |
|---|---|---|---|
| R-G01 | Globaler Einstellungsbutton rechts neben Hilfe; keine Prompt-Settings-Seite | P29, P31, P35 | T01, T02 |
| R-G02 | Alle Popups schließen per X, Escape und echtem Außenklick | P29, P33, P35 | T02 |
| R-G03 | Eine einheitliche Navigation-Row in jedem Bereich, auch ohne Aktionen | P29, P37, P41 | T01, T03 |
| R-G04 | Responsive-Reflow auch bei halbiertem Fenster und kleinen nativen Grenzen | P29, P36, P43 | T03 |
| R-G05 | Eine gemeinsame App mit Prompt, Cutout und neuem SpriteStudio | P29, P37, P41 | T01, T24 |
| R-G06 | Tastatur, Fokus, beschriftete Icons und nicht ausschließlich Farbcodierung | P29, P38, P42, P43 | T02, T03, T26 |
| R-G07 | Offline/lokal ohne Cloud-Upload und Modelldownload | P30, P39, P43 | T27 |
| R-G08 | Stabile Komponenten-/Datenselektoren statt festgeschriebener CSS-Hashes | P29, P35 | T01 |
| R-D01 | Aktiver Vault ist einziger fachlicher Arbeitskontext | P30, P32 | T04, T05 |
| R-D02 | Keine produktiven Profile/Drafts/Szenen in App-Data oder Browser-Storage | P31, P32, P42 | T05 |
| R-D03 | Genau ein aktives Basisprofil pro Vault | P32, P33 | T06 |
| R-D04 | Automatisches Sichern auch unvollständiger/noch unbenannter Eingaben | P32, P34, P38 | T07, T16 |
| R-D05 | Crash-sichere Dateisätze, ehrlicher Save-Status und Writer-Konflikte | P30, P32, P40, P43 | T08, T09 |
| R-D06 | Sichere Namen, Unicode, Kollisionen und transaktionale Umbenennung | P30, P32, P40 | T10 |
| R-D07 | Kontrollierte Legacy-Migration ohne stilles Löschen oder Mehrbasis-Übernahme | P28, P31, P32 | T11 |
| R-D08 | MD-/JSON-Ziel im System-Dateimanager; Windows-Neufenster gesondert prüfen | P35, P43 | T12 |
| R-D09 | Backend-Scope, Größenlimits und Schutz vor Path-Escape | P30, P36, P40, P41 | T13 |
| R-D10 | Externe Dateiereignisse, Wiederöffnung und recoverbarer Scan | P32, P36, P43 | T14 |
| R-P01 | Neun Typen mit den gewünschten Untertypbeispielen und Icons | P28, P34, P35 | T15 |
| R-P02 | .PixelPrompt/Typ/Untertyp/Name mit benannten MDs und Profil-JSON | P32, P35 | T07, T15 |
| R-P03 | Profile-Seite zeigt nur Vault und großen Basisprofil-Button mit Popup/Zusammenfassung | P33 | T06 |
| R-P04 | Name steht oberhalb des geführten Abfragekatalogs | P34 | T16 |
| R-P05 | Fragen Seite für Seite statt vollständigem Langformular | P34 | T16 |
| R-P06 | Kein Basisprofil-Schritt oder Basisprofil-Editor im Wizard | P33, P34 | T16 |
| R-P07 | Dashboard-Karten zeigen Typen, Profilzahlen und vorhandene Namen | P35 | T17 |
| R-P08 | Kategorie-Popup mit vollständigem Profil-Laden in den Wizard | P35 | T17 |
| R-P09 | Ausgabe zeigt alle bisherigen Varianten und speichert sie automatisch | P28, P32, P35 | T18 |
| R-P10 | Keine Export-/Kopier-/Download-/JSON-Exportbuttons im Prompt-Ablauf | P35 | T18 |
| R-P11 | Profil-JSON enthält vollständigen Wizard-Zustand und Step-IDs | P32, P34 | T16, T17 |
| R-P12 | Änderung der einen Basis markiert und regeneriert abhängige Ausgaben | P32, P33 | T19 |
| R-C01 | Bisherige Cutout-Fachbasis einschließlich alter Commands tatsächlich entfernen | P28, P30, P37 | T20 |
| R-C02 | Neue Cutout-Willkommen-Seite statt alter Start-/Projektstrecke | P37 | T20 |
| R-C03 | Gemeinsame DataFolderToolbar links in Cutout | P36, P38 | T21 |
| R-C04 | Bilddateiklick lädt den neuen Editor mit validierter Quelle | P38 | T21, T22 |
| R-C05 | Sechs Icon-Gruppen mit jeweils drei Untereinträgen und nutzbarem Flyout | P38 | T22 |
| R-C06 | Grobauswahl automatisch an sichtbaren Teil anpassen, korrigierbar | P39 | T23 |
| R-C07 | Aktive Markierung kräftiger, bestätigte Bereiche blasser | P38 | T22, T26 |
| R-C08 | Unabhängige überlappende Masken und Anschlusszugaben | P38, P39 | T23 |
| R-C09 | Exakte PNG-Dateinamen 01–15 und optional 16–18 gemäß Register | P40 | T24 |
| R-C10 | Teileordner nach Stammname der Quelle, sichere lokale Ablage | P40 | T10, T24 |
| R-C11 | Extras optional; drei Slots einschließlich aufgelöstem Zubehör-Widerspruch | P28, P38, P40 | T22, T24 |
| R-C12 | Undo/Redo, Abbruch und keine Übernahme veralteter Segmentierungsantworten | P38, P39 | T23 |
| R-C13 | Originalbilder unverändert; Ausschnitte erhalten Pixel/Alpha | P38, P40 | T24 |
| R-C14 | Schnittprojekt und Masken lokal wiederöffnen | P38, P40 | T24 |
| R-S01 | Neuer Abschnitt PixelSpriteStudio mit eigener Studioansicht | P29, P41 | T01, T25 |
| R-S02 | Dieselbe DataFolderToolbar plus View-Register | P36, P41, P42 | T21, T25 |
| R-S03 | Richtigen Teileordner anklicken und automatisch laden | P41 | T25 |
| R-S04 | View bestimmt Z-Reihenfolge, Sichtbarkeit und Sperren | P42 | T25 |
| R-S05 | Szenenänderungen ausschließlich lokal im Vault autosaven | P42 | T05, T25 |
| R-S06 | Manifest enthält Crop/Position/Pivot für korrekte Zusammenstellung | P40, P41 | T24, T25 |
| R-S07 | Neue Teilegeneration setzt eine bearbeitete Szene nicht still zurück | P41, P42 | T25 |
| R-S08 | Ohne Manifest keine erfundene räumliche Autoanordnung | P41 | T25 |

## Nicht Bestandteil dieses Umbaus

Kein zweites Programm, keine zweite frei angelegte Projektverwaltung, keine zentrale Profil-Datenbank, keine Cloud-Synchronisierung, kein verpflichtendes KI-Modell, keine neue Timeline/Animation/Godot-Strecke und kein generatives Ergänzen unsichtbarer Teile. Das Entfernen alter Cutout-Funktionen schließt die Wahrung vorhandener Nutzerdateien ausdrücklich ein.
