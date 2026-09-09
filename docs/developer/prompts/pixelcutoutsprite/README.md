<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](../index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Phasenübersicht — PixelCutoutSprite Studio

<!-- PYGINDEX:INDEX START -->
## Inhalt

### Seiten
- [P00 — Bestand prüfen und Umsetzung verankern](00.md)
- [P01 — Desktop-Shell und Produktidentität](01.md)
- [P02 — Fachmodelle und JSON-Verträge](02.md)
- [P03 — Vault und sichere Dateispeicherung](03.md)
- [P04 — Projekt-Dashboard, Labels und Dropdown-Filter](04.md)
- [P05 — Bereiche und humanoide Körperprofile](05.md)
- [P06 — Animationsbibliothek und zustandsabhängige Navigation](06.md)
- [P07 — Gemeinsamer Pixel-Rasterer](07.md)
- [P08 — Direkt bedienbarer Dummy-Editor](08.md)
- [P09 — Timeline, Keyframes und deterministisches Sampling](09.md)
- [P10 — Acht Richtungen, Spiegelregeln und Schichten](10.md)
- [P11 — Bewegungspresets und tatsächliche Kartenvorschauen](11.md)
- [P12 — PNG-Inventar und Paketimport](12.md)
- [P13 — Ausstattungseditor, Feinschliff und NPC-Entwürfe](13.md)
- [P14 — Ausrüstung und optionale Eigenbewegung](14.md)
- [P15 — NPC-Dashboard, Mehrfachanimationen und Revisionen](15.md)
- [P16 — Generischer PNG-/JSON-Export](16.md)
- [P17 — Portables Godot-Paket und echter Importtest](17.md)
- [P18 — Recovery, Autosave und Datenintegrität härten](18.md)
- [P19 — Desktop-Usability und Leistung prüfen](19.md)
- [P20 — Native Builds, Tooling und Codespaces](20.md)
- [P21 — Anleitung und nachvollziehbare Beispiel-Vault](21.md)
- [P22 — Gesamtabnahme und überprüfbarer Abschluss](22.md)
- [P23 — Prompt-Integrationsgrenze und technische Basis](23.md)
- [P24 — Gemeinsamer Header und sichere Studio-Umschaltung](24.md)
- [P25 — Vollständige PixelPromptStudio-Oberfläche portieren](25.md)
- [P26 — Native Prompt-Persistenz, Export und Cutout-Handoff](26.md)
- [P27 — Integrierte Studio-Workflows abnehmen und dokumentieren](27.md)
- [Fortsetzungsauftrag — PixelCutoutSprite Studio](FORTSETZEN.md)
- [Übergeordneter Arbeitsauftrag — PixelCutoutSprite Studio](MASTERPROMPT.md)
- [PixelCutoutSprite phase prompts](pixelcutoutsprite.md)
<!-- PYGINDEX:INDEX END -->

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
