<!-- AUTO-GENERATED:backlink START -->

[← Back](pixelcutoutsprite.md)
<!-- AUTO-GENERATED:backlink END -->

# Phasenübersicht — PixelCutoutSprite Studio

Zuerst den [übergeordneten Arbeitsauftrag](MASTERPROMPT.md), den
[lebenden ExecPlan](../../plans/pixelcutoutsprite-execplan.md) und für P23–P27 den
[PixelPromptStudio-Integrationsplan](../../plans/prompt-studio-integration.md) lesen. Die
[Fortsetzungsvorlage](FORTSETZEN.md) ist für eine spätere Sitzung vorgesehen.

## Abgeschlossene Basisserie

P00–P22 sind implementiert und durch die [P22-Gesamtabnahme](../../acceptance/final-acceptance.md)
abgeschlossen. Die Prompt-Dateien bleiben als historischer Auftrags- und Gate-Nachweis erhalten;
sie sind keine offene Aufgabenliste.

| Phase        | Inhalt                                                | Status        |
| ------------ | ----------------------------------------------------- | ------------- |
| [P00](00.md) | Bestand prüfen und Umsetzung verankern                | Abgeschlossen |
| [P01](01.md) | Desktop-Shell und Produktidentität                    | Abgeschlossen |
| [P02](02.md) | Fachmodelle und JSON-Verträge                         | Abgeschlossen |
| [P03](03.md) | Vault und sichere Dateispeicherung                    | Abgeschlossen |
| [P04](04.md) | Projekt-Dashboard, Labels und Dropdown-Filter         | Abgeschlossen |
| [P05](05.md) | Bereiche und humanoide Körperprofile                  | Abgeschlossen |
| [P06](06.md) | Animationsbibliothek und zustandsabhängige Navigation | Abgeschlossen |
| [P07](07.md) | Gemeinsamer Pixel-Rasterer                            | Abgeschlossen |
| [P08](08.md) | Direkt bedienbarer Dummy-Editor                       | Abgeschlossen |
| [P09](09.md) | Timeline, Keyframes und deterministisches Sampling    | Abgeschlossen |
| [P10](10.md) | Acht Richtungen, Spiegelregeln und Schichten          | Abgeschlossen |
| [P11](11.md) | Bewegungspresets und tatsächliche Kartenvorschauen    | Abgeschlossen |
| [P12](12.md) | PNG-Inventar und Paketimport                          | Abgeschlossen |
| [P13](13.md) | Ausstattungseditor, Feinschliff und NPC-Entwürfe      | Abgeschlossen |
| [P14](14.md) | Ausrüstung und optionale Eigenbewegung                | Abgeschlossen |
| [P15](15.md) | NPC-Dashboard, Mehrfachanimationen und Revisionen     | Abgeschlossen |
| [P16](16.md) | Generischer PNG-/JSON-Export                          | Abgeschlossen |
| [P17](17.md) | Portables Godot-Paket und echter Importtest           | Abgeschlossen |
| [P18](18.md) | Recovery, Autosave und Datenintegrität härten         | Abgeschlossen |
| [P19](19.md) | Desktop-Usability und Leistung prüfen                 | Abgeschlossen |
| [P20](20.md) | Native Builds, Tooling und Codespaces                 | Abgeschlossen |
| [P21](21.md) | Anleitung und nachvollziehbare Beispiel-Vault         | Abgeschlossen |
| [P22](22.md) | Gesamtabnahme und überprüfbarer Abschluss             | Abgeschlossen |

## PixelPromptStudio-Erweiterung

| Phase        | Inhalt                                                  | Abhängigkeiten | Status                        |
| ------------ | ------------------------------------------------------- | -------------- | ----------------------------- |
| [P23](23.md) | Prompt-Integrationsgrenze und technische Basis          | P00–P22        | Abgeschlossen; Gate bestanden |
| [P24](24.md) | Gemeinsamer Header und sichere Studio-Umschaltung       | P23            | Abgeschlossen; Gate bestanden |
| [P25](25.md) | Vollständige PixelPromptStudio-Oberfläche portieren     | P24            | Abgeschlossen; Gate bestanden |
| [P26](26.md) | Native Prompt-Persistenz, Export und Cutout-Handoff     | P25            | Abgeschlossen; Gate bestanden |
| [P27](27.md) | Integrierte Studio-Workflows abnehmen und dokumentieren | P23–P26        | Abgeschlossen; Gate bestanden |

P23–P27 sind durch die
[P27-Integrationsabnahme](../../acceptance/prompt-studio-integration.md) abgeschlossen. Maßgeblich
bleiben die tatsächlich ausgeführten Nachweise im lebenden ExecPlan, nicht die bloße Existenz der
Prompt-Dateien.
