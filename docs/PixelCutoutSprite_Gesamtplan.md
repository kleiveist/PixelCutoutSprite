<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio — vollständiger Gesamtplan

> **Architekturkorrektur für diesen Checkout:** Die fachliche Spezifikation bleibt gültig,
> aber die darin importierte Forge2D-/Godot-App-Annahme wurde durch
> `docs/developer/decisions/adr-001-tauri-desktop.md` ersetzt. Das Studio wird auf dem
> vorhandenen Template Tooling als Tauri-2-Desktop-App mit Rust und TypeScript/React gebaut;
> Godot bleibt nur zusätzliches Exportziel.

> **Historischer Abschluss:** Diese Ein-Datei-Fassung bewahrt den initialen Planungsstand für
> P00–P22. Die Basisserie ist seit dem 6. September 2026 vollständig abgeschlossen; Aussagen im
> eingebetteten Ausgangsplan wie „noch nicht implementiert“ sind keine Beschreibung des heutigen
> Repository-Stands. Die ebenfalls abgeschlossene Erweiterungsserie P23–P27 und ihre Abnahme
> stehen im
> [PixelPromptStudio-Integrationsplan](developer/plans/prompt-studio-integration.md) und im
> [aktuellen Phasenindex](developer/prompts/pixelcutoutsprite/README.md).

**Version 1.0 · Stand: 5. September 2026**
**Für:** `kleiveist/PixelCutoutSprite`
**Inhalt:** historische Studiodefinition, technische Datenstruktur, Abnahmen, 23 abgeschlossene
Umsetzungsprompts und initialer Fortschrittsplan.

Dies ist die erhaltene vollständige Ein-Datei-Fassung der ursprünglichen Planung. Ihr eingebetteter
Status wird nicht rückwirkend umgeschrieben; der aktuelle Implementierungsstand steht im lebenden
ExecPlan. Das zusätzlich bereitgestellte ZIP enthielt die Spezifikation und jeden ursprünglichen
Prompt einzeln an den vorgesehenen Repository-Pfaden.

## Aufbau dieser Datei

**Teil I** definiert das Produkt einschließlich aller besprochenen Arbeitsabläufe.
**Teil II** enthält den übergeordneten Auftrag, die Fortsetzungsvorlage und jeden der 23 Phasenprompts vollständig.
**Teil III** liefert den anfänglichen lebenden ExecPlan für die Umsetzung.
**Anhang** dokumentiert die lokale Prüfung der Planungsdateien.

Für die Umsetzung zuerst den Masterauftrag aus Teil II und anschließend P00 verwenden. Die Phasen können einzeln oder nacheinander bearbeitet werden; ihre Abnahmekriterien bleiben in beiden Fällen verbindlich.

---

# Teil I — Produktspezifikation

## PixelCutoutSprite Studio — Produktspezifikation und technische Planung

**Version:** 1.0 · **Stand:** 5. September 2026 · **Sprache:** Deutsch
**Repository:** `kleiveist/PixelCutoutSprite`
**Status:** Planungsdokument. Die beschriebenen Studio-Funktionen sind damit nicht implementiert oder getestet.
**Verbindlichkeit:** Nutzeranforderungen werden als Muss-Anforderungen behandelt. Ergänzende Entscheidungen sind hier als Planungsfestlegungen dokumentiert und können durch einen begründeten Architekturentscheid geändert werden.

### Inhaltsverzeichnis

1. Produktziel und feste Grenzen
2. Repository-Befund und Technologieentscheidung
3. Begriffe und fachliches Datenmodell
4. Vollständiger Arbeitsablauf
5. Navigation, Dashboards und Filter
6. Bereiche, Größen und Körpervorlagen
7. Dummy-Editor und Cutout-Verfahren
8. Timeline, Keyframes und Bewegungswiedergabe
9. Acht Richtungen und Zeichenreihenfolge
10. Inventar und Sprite-Import
11. Anziehen, Feinschliff und Ausrüstung
12. NPCs, Animationszuordnung und Freigaben
13. Arbeitsordner und physische Dateistruktur
14. Datenverträge und Versionsregeln
15. JSON-Beispiele
16. Render- und Exportpipeline
17. Godot-Export und Einbindung in Spiele
18. Softwarearchitektur und Repository-Struktur
19. Speichern, Wiederherstellung und Sicherheit
20. Desktop-Bedienung und Qualitätsziele
21. Tests und Abnahmeszenarien
22. Lieferumfang, Meilensteine und Risiken
23. Rückverfolgbarkeit der Anforderungen
24. Umsetzung mit den Phasenprompts
25. Quellen und Recherchegrenzen

---

### 1. Produktziel und feste Grenzen

PixelCutoutSprite Studio wird eine **lokale Desktop-Anwendung zum Erstellen wiederverwendbarer Pixelart-Animationen**, zunächst für humanoide Figuren in RPGs mit acht Blick- und Bewegungsrichtungen.

Das zentrale Verfahren lautet:

> Einen vorgegebenen, gut erkennbaren Dummy durch wenige Posen animieren. Danach passende Pixel-Sprites auf seine Körperteile setzen. Dieselbe Bewegung mit unterschiedlichen NPCs und Ausrüstungen wiederverwenden. Das Ergebnis als fertige Sprite-Animation exportieren.

Ein Nutzer soll **weder jeden Zwischenframe zeichnen noch ein eigenes Skelett konstruieren** müssen. Er muss jedoch die Ausgangs-Sprites bereitstellen und Bewegungen beziehungsweise wichtige Posen gestalten. Aus einem beliebigen einzelnen Frontbild werden nicht automatisch perfekte Ansichten in acht Richtungen erzeugt.

#### 1.1 Verbindlicher Umfang

| Thema | Festlegung |
|---|---|
| Plattform | Desktop: Windows, Linux und macOS. Keine mobile oder Web-Ausgabe des Studios. |
| Erste Seite | Projekt-Dashboard des geöffneten Arbeitsordners. Ohne geöffneten Ordner erscheint zuerst dessen Auswahl. |
| Hierarchie | Arbeitsordner → Projekt → Bereich → Animationen beziehungsweise NPCs. |
| Organisation | Eigene Labels, Kategorien/Bereiche, Suche und sortierbare Übersichten. Alle strukturierten Filter sind Dropdown-Menüs. |
| Animationsverfahren | Vorkonfiguriertes Cutout-System aus starren Sprite-Teilen, Keyframes und berechneten Zwischenzuständen. |
| Nicht vorgesehen | Manuelles Bone-Rigging, Skinning, Gewichte, Mesh-Verformung oder eine notwendige IK-Einrichtung. |
| Erstes Körperprofil | Humanoider NPC: zwei Rumpfteile, Kopf, optional Haare, je drei Teile pro Arm und Bein. Keine Augenebene in Version 1. |
| Aussehen | PNG-Inventar, automatische Zuordnung nach Metadaten, Anziehen und pixelgenauer Feinschliff. |
| Zubehör | Rüstung, Accessoires und Equipment als zusätzliche Ebenen; Mitführen, eigene Bewegung und Sichtbarkeit sind getrennt. |
| Datenhaltung | Gewöhnliche Ordner, JSON und PNG. **Kein SQL, insbesondere kein SQLite.** |
| Arbeitsordner | Ein wählbarer lokaler Ordner, der beim ersten Anlegen leer sein darf und möglichst leer sein soll. |
| Globale Metadaten | Ausschließlich globale Workspace-Daten unter `.pixelforge-studio/`. |
| Spielausgabe | Standard: PNG-Sprite-Sheets plus JSON; zusätzlich Godot-Ressourcen. Einzelne PNG-Frames optional. |
| Spätere Erweiterungen | Andere Körperprofile, Monster mit anderen Körperformen, Bäume und weitere Objekte. Nicht Teil der ersten vollständigen Version. |

#### 1.2 Begriffliche und gestalterische Festlegungen

Der Repository- und Produktname bleibt **PixelCutoutSprite**; die Oberfläche kann „PixelCutoutSprite Studio“ anzeigen. Der gewünschte globale Datenordner heißt dauerhaft `.pixelforge-studio`. Unterschiedliche Schreibweisen dieses Ordners werden nicht parallel eingeführt.

Das vom Nutzer „Wallet“ genannte Ordnersystem wird in der Oberfläche **„Arbeitsordner (Vault)“** genannt. Gemeint ist ein lokaler Datenordner, kein Finanz- oder Kryptosystem.

„Homepage“, „Page“ und „Dashboard“ bezeichnen Ansichten innerhalb der Desktop-App. Es wird kein Browser-Produkt vorausgesetzt. Der „Sprite-Editor“ ist in Version 1 ein **Zuordnungs- und Platzierungseditor**, kein vollständiges Zeichenprogramm mit Pinseln.

### 2. Repository-Befund und Technologieentscheidung

#### 2.1 Gelesener Ausgangsstand

Das Repository wurde über die GitHub-Verbindung gelesen. Der während der Prüfung gelieferte Baum verweist auf Commit `9a927ee895218357fc72fa1f506621335dc11a72`. Der Baum und die einzeln gelesenen Dateien wurden nicht lokal ausgeführt; vor Beginn der Umsetzung ist der dann aktuelle Checkout erneut zu prüfen.

Gelesen wurden insbesondere `README.md`, `AGENTS.md`, `.agent/PLANS.md`, `config/toolchain.toml` und `game/project.godot`. Der vorhandene Stand beschreibt ein **Forge2D-Godot-Template mit repository-lokalem Python-Tooling**, nicht bereits das hier geplante Studio. Der Projekteinstieg liegt unter `game/`; der zentrale Tooling-Einstieg ist `python tools/control.py`. Die Konfiguration nennt Godot `4.7.2`, Python mindestens `3.11` und Desktop-Exporte. [R1–R5]

Godot 4.7.2 ist zum Recherchestand auch im offiziellen Godot-Archiv als stabile Veröffentlichung vom 18. August 2026 aufgeführt. Diese Angabe ist geprüft, ersetzt aber nicht die Versionsprüfung auf dem Entwicklungsrechner. [S1]

#### 2.2 Architekturentscheidung ADR-001

**Auf dem vorhandenen Godot-Template aufbauen. Kein zusätzlicher Tauri-, Electron-, React- oder Web-Stack.**

| Teil | Entscheidung |
|---|---|
| Desktop-Laufzeit | Godot 4, zunächst die im Repository festgelegte Version 4.7.2. |
| Oberfläche | Godot `Control`- und `Container`-basierte Ansichten mit eigenem Studio-Theme. |
| Anwendungscode | Typisiertes GDScript gemäß den vorhandenen Repository-Regeln. |
| Fachliche Logik | Vom Szenenbaum möglichst unabhängige Modelle und Services. |
| Pixelbilder | Godot `Image` für Laden, Pixelverarbeitung und PNG-Ausgabe; Darstellung über Texturen. |
| Dateien | `FileAccess`, `DirAccess`, JSON und kontrollierte Pfadauflösung. |
| Tooling | Vorhandenes Python-Tooling erweitern; Python ist keine zusätzliche Laufzeitvoraussetzung für Endnutzer der exportierten App. |
| Tests | Vorhandene Python- und Godot-Tests ergänzen, Headless-Tests für fachliche Logik und Export. |
| Neue Abhängigkeiten | Nur mit dokumentiertem Nutzen, Lizenzprüfung und Alternative. In Version 1 zunächst keine neuen notwendigen Laufzeit-Add-ons. |

Godot stellt GUI-Bausteine, Dateizugriff, JSON-Verarbeitung und Bildausgabe bereit. Die eigentliche Studio-Logik und die zuverlässige Speicherung müssen trotzdem implementiert werden. Die Entscheidung vermeidet einen Framework-Wechsel und nutzt das bestehende Tooling. [S2–S7]

#### 2.3 Desktop und Codespaces sauber unterscheiden

Codespaces kann für Quellcodearbeit, Tooling und geeignete Headless-Tests verwendet werden. Portweiterleitung macht einen Webdienst erreichbar, nicht automatisch eine native Godot-Desktop-Oberfläche. **Die Studio-GUI wird nativ auf einem Desktop geprüft.** Ein optional eingerichteter Remote-Desktop wäre nur eine Entwicklungsumgebung, kein Produktziel. Es wird kein Webexport hinzugefügt, nur um eine Codespaces-Vorschau zu erhalten. [S8, S9]

Die vorhandenen Spiel-/Touch-Baselines werden in Phase 00 geprüft. Unbenutzte spielbezogene Oberflächen oder mobile Exportziele werden kontrolliert abgelöst, nicht blind gelöscht. Bestehende Prüfungen werden fachlich angepasst und nicht bloß deaktiviert.

### 3. Begriffe und fachliches Datenmodell

#### 3.1 Die fünf zentralen Objekte

| Objekt | Bedeutung | Beispiel |
|---|---|---|
| Projekt | Ein Spiel oder ein zusammengehöriger Asset-Bestand. | „Mein RPG“ |
| Bereich | Ein organisatorischer Teil des Projekts mit Körperprofil und Größenvorgaben. | „NPCs – Menschen 80 px“ |
| Bewegungsvorlage | Eine vom Aussehen unabhängige Dummy-Animation. | „Gehen“, „Sprinten“, „Springen“ |
| NPC/Charakter | Eine benannte Figur mit zugeordneten Körper-Sprites und Ausrüstung. | „Dorfbewohner 01“ |
| Animationszuordnung | Verbindung zwischen einem NPC und einer bestimmten freigegebenen Bewegungsvorlage. | „Dorfbewohner 01 / Gehen“ |

Zusätzlich gibt es **Körperprofile**, **Assets**, **Labels**, **Outfit-Entwürfe**, **Exportprofile** und **Exportstände**.

#### 3.2 Die entscheidende Trennung

```text
Bereich „NPCs“
├── Bewegungsvorlagen
│   ├── Gehen
│   ├── Sprinten
│   └── Springen
└── NPCs
    ├── Dorfbewohner 01
    │   ├── Aussehen
    │   ├── Gehen      → referenziert Bewegungsvorlage „Gehen“
    │   └── Springen   → referenziert Bewegungsvorlage „Springen“
    └── Händlerin 01
        ├── Aussehen
        ├── Gehen      → referenziert dieselbe Bewegungsvorlage „Gehen“
        └── Sprinten   → referenziert Bewegungsvorlage „Sprinten“
```

Eine Bewegungsvorlage ist **nicht** dasselbe wie ein NPC und nicht dasselbe wie sein fertiger PNG-Export. Die Zuordnung verbindet diese Ebenen. Diese Trennung verhindert, dass jede Figur ihren eigenen, unabhängig zu pflegenden Laufzyklus benötigt.

#### 3.3 Beziehungen und Identität

Ein Projekt enthält mehrere Bereiche. Ein Bereich enthält mehrere Körperprofil-Versionen, Bewegungsvorlagen, Assets und NPCs. Ein NPC gehört in Version 1 genau einem Bereich an. Er besitzt ein Standard-Aussehen und beliebig viele Animationszuordnungen. Eine Zuordnung referenziert genau eine freigegebene Vorlagenrevision und ein Aussehen.

Alle referenzierbaren Objekte besitzen stabile String-IDs. Namen dienen der Anzeige und dürfen geändert werden. Referenzen erfolgen **niemals nur über Dateinamen oder sichtbare Namen**. Ein NPC mit demselben Namen in einem anderen Projekt ist keine identische Figur.

Bereiche und Labels haben verschiedene Aufgaben: Ein Bereich bestimmt Zugehörigkeit und Kompatibilität; Labels beschreiben zusätzliche Eigenschaften. Ein Label „Dorfbewohner“ erzeugt keinen neuen Ordner.

### 4. Vollständiger Arbeitsablauf

#### 4.1 Erster nutzbarer Durchlauf

1. App öffnen und einen leeren Arbeitsordner wählen. Die App initialisiert die globalen Metadaten nach ausdrücklicher Ordnerauswahl.
2. Im Projekt-Dashboard „Neues Projekt“ wählen, „Mein RPG“ benennen und Labels zuordnen.
3. Im Projekt einen Bereich „NPCs“ anlegen. Profil „Humanoid“, Referenzhöhe `80 px`, acht Richtungen und passende Standard-Framegröße wählen.
4. Den Bereich öffnen. Der Tab **Animationen** zeigt zunächst eine leere Liste und „Animation erstellen“.
5. „Gehen“ anlegen. Frameanzahl, Bildrate, Schleife und Framefläche festlegen. Der erste Klick öffnet den Dummy-Editor.
6. Vier wichtige Laufposen einstellen oder ein mitgeliefertes Bewegungspreset als Ausgangspunkt nutzen. Das Studio berechnet die angeforderten Zwischenzustände.
7. Alle acht Richtungen prüfen, einschließlich erlaubter Spiegelungen. Mit „Dummy freigeben“ eine unveränderliche Vorlagenrevision veröffentlichen.
8. Zur Animationsübersicht zurückkehren. Der normale Klick auf „Gehen“ öffnet jetzt die Ausstattung, nicht automatisch wieder den Dummy-Editor.
9. „Neuen NPC ausstatten“ wählen. PNG-Teile in das Inventar importieren, Zuordnung bestätigen und dem Dummy zuweisen.
10. Im Tab **Feinschliff** Positionen, Drehpunkte und Überdeckungen korrigieren. Die Dummy-Kontur bleibt als Orientierung sichtbar.
11. Den Entwurf als „Dorfbewohner 01“ speichern. Der NPC und seine Zuordnung „Gehen“ werden angelegt.
12. Die freigegebene Vorlage „Sprinten“ öffnen, „Vorhandenen NPC verwenden“ wählen und Dorfbewohner 01 auswählen. Sein Aussehen wird wiederverwendet.
13. Im Tab **NPCs** Dorfbewohner 01 öffnen. Gehen, Sprinten und später Springen erscheinen gesammelt.
14. Vorschau und Vollständigkeitsprüfung ausführen. PNG-Sheets plus Metadaten beziehungsweise ein Godot-Paket exportieren.
15. Die App schließen und denselben Arbeitsordner erneut öffnen. Quellen, Zuordnungen und Bearbeitungsstände sind weiterhin vorhanden.

#### 4.2 Nichtlineares Arbeiten

Jeder Schritt bleibt wieder aufrufbar. Ein Nutzer darf zuerst PNGs importieren, dann den Dummy animieren oder einen vorhandenen NPC um eine neue Bewegung erweitern. Der geführte Ablauf ist eine Hilfe, keine starre Einbahnstraße.

Unbenannte Outfit-Arbeit wird als Entwurf im jeweiligen Bereich gespeichert. Erst „Als NPC speichern“ verlangt einen Namen. Dadurch geht Arbeit nicht verloren, wenn die Benennung erst am Ende erfolgt.

### 5. Navigation, Dashboards und Filter

#### 5.1 Ansichten und Klickverhalten

| Ansicht | Hauptinhalt | Normaler Klick | Weitere Aktionen |
|---|---|---|---|
| Arbeitsordner-Auswahl | Öffnen, anlegen, zuletzt verwendet. | Öffnet einen validierten Vault. | Pfad anzeigen, ungültigen Verlaufseintrag entfernen. |
| Projekt-Dashboard | Projektkarten mit Name, Labels und letzter Änderung. | Öffnet das Projekt. | Erstellen, umbenennen, duplizieren, archivieren, Labels. |
| Projekt-Bereiche | Karten für NPCs oder andere selbst benannte Bereiche. | Öffnet den Bereich. | Bereich erstellen, Profil/Größe ansehen, bearbeiten. |
| Bereich / Animationen | Anklickbare Bewegungskarten mit Miniatur/Vorschau. | Entwurf: Dummy. Freigegeben: Ausstattung/Zuordnung. | Dummy bearbeiten, duplizieren, Revisionen, Labels, entfernen. |
| Dummy-Editor | Raster, Dummy, Eigenschaften, Timeline. | Wählt Teile oder Frames. | Freigeben, Vorschau, Richtung, Zurück. |
| Ausstattungseditor | Inventar, Anziehen, Feinschliff, laufende Vorschau. | Wählt Assets beziehungsweise Körperteile. | NPC wählen/speichern, Dummy öffnen, prüfen. |
| Bereich / NPCs | Benannte Figuren, Animationsanzahl und Bereitschaft. | Öffnet die NPC-Detailansicht. | Aussehen ändern, Animation hinzufügen, exportieren. |
| NPC-Details | Alle Bewegungen eines NPCs und deren Status. | Öffnet die betreffende Zuordnung. | Gesamtvorschau, Einzel-/Gesamtexport. |

Oben steht eine Breadcrumb-Leiste, beispielsweise:

```text
Arbeitsordner / Mein RPG / NPCs / Gehen / Dummy
Arbeitsordner / Mein RPG / NPCs / Dorfbewohner 01 / Gehen / Feinschliff
```

Der Editor zeigt außerdem immer den **Bearbeitungsumfang**: „Vorlage für mehrere NPCs“, „Aussehen dieses NPCs“ oder „Nur diese Animationszuordnung“. So werden versehentliche globale Änderungen vermieden.

#### 5.2 Karten und Vorschauen

Animationskarten sind echte Schaltflächen mit Fokuszustand und Bedienung per Tastatur. Eine Karte enthält Namen, Bewegungstyp, Labels, Freigabestatus, Richtungsabdeckung und eine kleine gerenderte Vorschau.

Die Vorschau zeigt die tatsächliche Bewegung des gespeicherten Dummys oder des gewählten NPCs, keine beliebige Beispielanimation. Sie spielt nur bei Hover, Fokus oder expliziter Aktivierung. Nicht sichtbare Karten werden nicht dauerhaft animiert. Bei „Bewegungen reduzieren“ bleiben Vorschauen statisch.

Die direkte Aktion „Dummy bearbeiten“ erhält ein sichtbares Icon mit Tooltip. Dieselbe Funktion steht im Rechtsklick-Menü. Rechtsklick ist niemals der einzige Zugang.

#### 5.3 Regeln für Filter und Labels

**Jede strukturierte Filterbedingung wird über ein Dropdown gesetzt.** Dazu gehören Status, Labels, Bereich, Profil, Größe, Richtung, Asset-Typ, Vollständigkeit, Archivzustand und Sortierung.

Mehrfachauswahl erscheint als Dropdown mit markierbaren Einträgen. Aktive Labels dürfen neben dem Filter angezeigt werden, sind aber nicht als alleiniger Filtermechanismus vorgesehen. Eine separate Textsuche ist zulässig und klar als Suche bezeichnet.

Verschiedene Filterfelder werden mit UND verknüpft. Innerhalb eines Label-Dropdowns lässt sich „mindestens eines“ oder „alle ausgewählten“ wählen; Standard ist „mindestens eines“. Leere Auswahl bedeutet keine Einschränkung. „Filter zurücksetzen“ ist stets erreichbar.

| Übersicht | Dropdown-Filter |
|---|---|
| Projekte | Labels, aktiv/archiviert, Sortierung. |
| Bereiche | Objekttyp, Körperprofil, Referenzhöhe, Labels, Sortierung. |
| Animationen | Bewegungstyp, Entwurf/freigegeben, Richtungsabdeckung, Profilversion, Labels, Sortierung. |
| Inventar | Slot, Richtung, Typ, Profilkompatibilität, Labels, zugeordnet/nicht zugeordnet. |
| NPCs | Labels, vollständig/unvollständig, benötigte Bewegung, Exportstatus, Sortierung. |

Label-Verwaltung unterstützt Erstellen, Umbenennen, Farbe und Entfernen. Farbe ist nur Zusatzinformation; Name und Status bleiben textlich sichtbar. Workspace-Labels organisieren Projekte; Projekt-Labels organisieren Bereiche, Vorlagen, NPCs und Assets. Das Löschen eines Labels entfernt keine Projekte oder Bilder. Alle betroffenen Referenzen werden konsistent aktualisiert.

### 6. Bereiche, Größen und Körpervorlagen

#### 6.1 Einstellungen beim Anlegen eines Bereichs

Ein Bereich speichert Namen, Objekttyp, Körperprofil-Version, Referenzhöhe, Richtungsmodell, Standard-Framegröße, gemeinsamen Bodenanker und Labels.

**Planungsstandard:** humanoide RPG-Figur, orthografische/leicht von oben dargestellte Acht-Richtungs-Ansicht, `80 px` anatomische Referenzhöhe. Die Referenzhöhe misst die neutrale Figur vom Kopf bis zur Fußsohle, ohne überstehende Haare oder Ausrüstung.

Die Körpergröße allein bestimmt nicht sinnvoll jede Proportion. Deshalb liefert ein **versioniertes Proportionsprofil** die Größenverhältnisse, Slot-Rechtecke, Grundpositionen und Befestigungspunkte. Die Eingabe „80 px“ skaliert dieses Profil deterministisch. Anschließend wird die tatsächlich berechnete Größe angezeigt.

#### 6.2 Humanoides Standardprofil: 16 Slots

| Gruppe | Slots | Anzahl |
|---|---|---:|
| Rumpf | `torso_upper`, `torso_lower` | 2 |
| Kopf | `head` | 1 |
| Haare | `hair` — optional, standardmäßig vorhanden | 1 |
| Linker Arm | `upper_arm_l`, `forearm_l`, `hand_l` | 3 |
| Rechter Arm | `upper_arm_r`, `forearm_r`, `hand_r` | 3 |
| Linkes Bein | `thigh_l`, `shin_l`, `foot_l` | 3 |
| Rechtes Bein | `thigh_r`, `shin_r`, `foot_r` | 3 |
| **Summe** | **15 anatomische Slots plus 1 Haar-Slot** | **16** |

Rüstung und Accessoires sind zusätzliche Anbauteile, keine weiteren Pflichtteile dieses anatomischen Profils. Augen und ein Gesichtssystem werden in Version 1 nicht angelegt.

#### 6.3 Beispiel für das 80-px-Profil

Diese Maße sind ein **zu erprobender Startentwurf**, kein künstlerisch garantiert passendes Universalprofil. Die neutralen vertikalen Ausdehnungen können zunächst so aufgeteilt werden:

| Teil | Beispiel-Spritefläche | Vertikaler Abschnitt der neutralen Figur |
|---|---:|---|
| Kopf | 18 × 16 px | −80 bis −64 |
| Oberer Rumpf | 24 × 20 px | −64 bis −44 |
| Unterer Rumpf | 20 × 10 px | −44 bis −34 |
| Oberschenkel, je Seite | 10 × 16 px | −34 bis −18 |
| Unterschenkel, je Seite | 8 × 14 px | −18 bis −4 |
| Fuß, je Seite | 12 × 4 px | −4 bis 0 |
| Oberarm, je Seite | 8 × 14 px | Profilabhängig an der Schulter. |
| Unterarm, je Seite | 7 × 12 px | Profilabhängig am Oberarm. |
| Hand, je Seite | 8 × 6 px | Profilabhängig am Unterarm. |
| Haare | 20 × 20 px | Dürfen über die anatomische Höhe hinausragen. |

Der Boden liegt bei `y = 0`, positive Y-Werte zeigen nach unten. Kleine Gelenküberdeckungen werden im Profil festgelegt, ohne die gemessene Gesamthöhe unkontrolliert zu vergrößern. Die verschiedenen Ansichten bekommen eigene Grundpositionen und Schichtreihenfolgen; ein Seitenprofil ist nicht nur ein zusammengedrücktes Frontprofil.

Für diese Referenzgröße wird `128 × 128 px` als anfängliche Framefläche mit Bodenanker `(64, 108)` vorgeschlagen. Dieser Rand ist kein Versprechen, dass jede Sprunghöhe oder Ausrüstung hineinpasst. Der Editor prüft die tatsächlichen Bildgrenzen.

#### 6.4 Größenregeln und Änderungen

Intern wird zunächst mit dem Faktor `H / 80` aus dem Basispreset gerechnet. Slotgrößen werden auf ganze Pixel begrenzt, mindestens ein Pixel groß. Das Profil korrigiert Rundungsreste gezielt, sodass die anatomische Gesamthöhe wieder exakt `H` erreicht. Einfach alle Teilhöhen unabhängig runden und addieren ist nicht ausreichend.

Vorhandene Pixelgrafiken werden bei einer Größenänderung nicht stillschweigend skaliert. Der Import bietet unverändert übernehmen, transparent auffüllen, eine passende Variante auswählen oder bewusst neu skalieren an. Skalierung wird als sichtbare, bestätigte Bearbeitung behandelt.

Nach der ersten Verwendung wird ein Profil nicht stillschweigend überschrieben. Eine andere Größe oder Körperstruktur erzeugt eine neue Profilversion beziehungsweise einen neuen Bereich. Bestehende Vorlagen und NPCs behalten ihre bisherige Profilreferenz. Ein späterer Migrationsassistent muss Auswirkungen und Vorschau anzeigen.

#### 6.5 Vorgegebene Befestigungsstruktur

Der virtuelle Figurenursprung ist kein zusätzliches Körper-Sprite. Das erste Profil bringt diese starre Befestigungsstruktur mit:

```text
root (virtueller Boden-/Figurenursprung)
└── torso_lower
    ├── torso_upper
    │   ├── head
    │   │   └── hair (optional)
    │   ├── upper_arm_l → forearm_l → hand_l
    │   └── upper_arm_r → forearm_r → hand_r
    ├── thigh_l → shin_l → foot_l
    └── thigh_r → shin_r → foot_r
```

Die Grundmatrizen legen fest, wo die jeweiligen lokalen Drehpunkte sitzen. Ein separater Schatten folgt dem Bodenursprung, nicht dem vertikalen Sprungversatz des Körpers. Ein Nutzer kann mit dem vorgegebenen Profil sofort Posen bearbeiten; eine freie Neukonstruktion dieser Struktur ist kein notwendiger Schritt des Workflows.

### 7. Dummy-Editor und Cutout-Verfahren

#### 7.1 Was der Nutzer tatsächlich bearbeitet

Der Dummy besteht aus starren, deutlich unterscheidbaren Teilen. Er besitzt kein Gesicht und keine dekorativen Details. Jeder Slot hat einen Namen, einen Mittelpunkt beziehungsweise Drehpunkt und definierte Befestigungspunkte. Auswahl wird durch Kontur, Griffpunkte und Text hervorgehoben, nicht nur durch Farbe.

Die Profilvorlage bringt alle Befestigungen bereits mit. Der Nutzer verschiebt und dreht Teile, ohne zunächst einen Rig-Editor bedienen zu müssen. Zusammenhängende Teile können gemeinsam verschoben werden. Unterarme bleiben beispielsweise an ihren Oberarmen befestigt.

**Technische Ehrlichkeit:** Bewegliche Teile benötigen Bezugspunkte und Beziehungen. Die interne starre Transformationshierarchie ähnelt mathematisch einem Gelenkmodell. Sie ist hier aber kein vom Nutzer zu konstruierendes Bone-Rig. Es werden weder `Skeleton2D` noch `Bone2D`, Gewichte, Skinning oder Mesh-Verformung für das Kernverfahren eingesetzt.

#### 7.2 Anordnung der Oberfläche

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb · Animation · Richtung ▼ · Speichern · Dummy freigeben       │
├────────────────┬──────────────────────────────────┬────────────────────┤
│ Körperteile    │                                  │ Eigenschaften      │
│ Sichtbarkeit   │  Raster + Dummy + Griffpunkte     │ Position X/Y       │
│ Sperren        │  Bodenlinie + Framegrenze         │ Drehung / Drehpunkt│
│ Ebenen         │  optionale Vergleichsposen        │ Interpolation      │
│                │                                  │ Bearbeitungsumfang │
├────────────────┴──────────────────────────────────┴────────────────────┤
│ Timeline: Spuren · Keyframes · Abspielkopf · Play/Pause · FPS · Frames   │
└────────────────────────────────────────────────────────────────────────┘
```

Der Rastermaßstab ist vergrößerbar. 1:1-Vorschau und vergrößerte Bearbeitung können nebeneinander angezeigt werden. Hilfslinien, Dummy-Kontur und Auswahlgriffe werden nie mitexportiert.

#### 7.3 Bearbeitungswerkzeuge

Erforderlich sind Einzel- und Mehrfachauswahl, Verschieben, Drehen, Rasterfang, Sperren, Sichtbarkeit, Kopieren/Einfügen von Posen, Zurücksetzen auf Grundpose, Spiegeln mit Vorschau und Undo/Redo.

Eine Mausbewegung wird als eine rückgängig machbare Änderung zusammengefasst, nicht als Hunderte einzelne Pixeländerungen. Numerische Eingaben erlauben reproduzierbare Werte. Beim Draggen zeigt der Inspector die tatsächlichen Werte.

Ein sichtbarer Auto-Key-Schalter entscheidet, ob eine Änderung am aktuellen Frame einen Keyframe anlegt. Ohne Auto-Key verändert eine Pose-Bearbeitung nur einen bereits ausgewählten Keyframe; andernfalls muss der Nutzer einen Keyframe anlegen. Änderungen an der Körpervorlage erfolgen ausschließlich im separaten Profilbereich, nicht versehentlich durch einen Drag im Animationseditor.

#### 7.4 Pixelgenauigkeit und ihre Grenzen

Die Vorschau und der Export verwenden dieselbe fachliche Auswertung und dieselbe Referenz-Rasterung. Nearest-Neighbor-Sampling, ein transparentes Zielbild und ganzzahlige Ausgabepositionen sind der Standard. Godot bietet einen Nearest-Texturfilter; der Filter allein ersetzt jedoch nicht die korrekte Rasterung. [S10]

Beliebige Rotationen können auch ohne Unschärfe Treppenkanten, veränderte Silhouetten oder zeitliches Flimmern erzeugen. **Pixelrasterfang garantiert kein handgezeichnetes Ergebnis.** Dafür sind drei Hilfen vorgesehen: optionales Winkelraster, pro Richtung passende Teil-Sprites und alternative Sprite-Varianten für problematische Posen.

Es gibt keine automatische Weichzeichnung, keine dauerhaft aktivierte nicht-ganzzahlige Skalierung und keine Mesh-Verformung als versteckten Standard.

### 8. Timeline, Keyframes und Bewegungswiedergabe

#### 8.1 Vier verschiedene Größen

| Begriff | Bedeutung |
|---|---|
| Figurenhöhe | Anatomische Größe des Dummys, im Bereich/Profil festgelegt. |
| Framefläche | Breite und Höhe eines Ausgabebildes, beim Anlegen der Animation festgelegt; Standard aus dem Bereich. |
| Frameanzahl | Anzahl der ausgegebenen Bilder eines Durchlaufs. |
| Bildrate/FPS | Wie viele Animationsbilder pro Sekunde abgespielt werden. |

Diese Größen werden in der Oberfläche nicht unter dem unklaren Begriff „Framehöhe“ vermischt. Ein Dialog „Neue Animation“ zeigt alle vier Werte, die Figurenhöhe allerdings nur als geerbte Profilinformation.

**Beispiel:** 80-px-Figur, 128 × 128-px-Frame, zwölf Frames und zwölf FPS ergeben einen einsekündigen Durchlauf. Vier gesetzte Schlüsselposen können zur Berechnung dieser zwölf Ausgabeframes genügen. Das sind zwölf gerenderte Bilder, aber nicht zwölf neu gezeichnete Figuren.

#### 8.2 Daten einer Bewegung

Eine Vorlage speichert Namen, Bewegungstyp, Körperprofil-Referenz, Framefläche, Bodenanker, Frameanzahl, FPS, Schleifenmodus, Richtungsdefinitionen und Spuren. Eine Spur adressiert einen stabilen Slot oder einen ausdrücklich definierten Zusatzkanal.

Erlaubte Kerneigenschaften in Version 1 sind Verschiebung, Drehung, Sichtbarkeit, diskrete Sprite-Varianten und optionale Schichtwechsel. Nicht-ganzzahlige Skalierung ist nicht Bestandteil der Standardbewegung. Körpergröße wird über das Profil bestimmt, nicht über wechselnde Track-Skalierung.

Keyframes liegen an ganzzahligen Frameindizes. Die Standardinterpolation für Bewegungswerte ist linear; Halten und ausgewählte Ease-in/Ease-out-Kurven sind verfügbar. Sichtbarkeit, Varianten und Schichtreihenfolgen sind diskret und werden nicht gemischt. Drehwinkel verwenden standardmäßig den kürzesten Weg; bewusst größere Drehungen benötigen eine explizite Einstellung.

#### 8.3 Zeitmodell und Schleifen

Die Auswertung ist eine reine Funktion: **gespeicherte Daten + Richtung + Sampleindex → Pose**. Die exportierten Bilder hängen nicht davon ab, wie schnell der Rechner zuvor die Vorschau abgespielt hat.

Für `N` gleich lange Frames bei `fps` gilt `Dauer = N / fps`; exportiert werden die Indizes `0` bis `N−1`. Bei einer Schleife wird der erste Zustand für die Interpolation gedanklich bei `N` fortgesetzt, aber nicht als zusätzliches identisches Abschlussbild exportiert.

Der interne Timeline-Zoom verändert weder Samplezahl noch Zeit. Eine Vorschau bei halber Geschwindigkeit ist nur ein Wiedergabefaktor und verändert die gespeicherte FPS-Einstellung nicht. Längeres Halten wird in Version 1 mit entsprechend gesetzten Posen beziehungsweise identischen Samples abgebildet; variable Einzelbilddauern sind eine spätere Erweiterung, kein versteckter zweiter Zeitstandard.

#### 8.4 Funktionsumfang der Timeline

Spuren ein-/ausklappen, Abspielkopf scrubben, einzelne Frames vor/zurück, Keyframes hinzufügen/verschieben/löschen, Pose duplizieren, Mehrfachauswahl, Bereich kopieren, Schleife anzeigen und vorherige/nächste Pose als transparente Orientierung darstellen.

Beim Ändern der Frameanzahl wird nicht unbemerkt abgeschnitten. Der Dialog bietet „Zeitlich verteilen“ oder „Frames am Ende ergänzen/entfernen“ und zeigt betroffene Keys. Entfernen von belegten Frames erfordert eine bestätigte Vorschau. Jede Zeitänderung ist rückgängig machbar.

#### 8.5 Bewegungspresets und prozedurale Hilfen

Die erste vollständige Version enthält editierbare Startpresets für **Stillstehen, Gehen, Sprinten, Springen und eine neutrale Interaktions-/Angriffsbewegung**. Sie sind Hilfen, keine Zusicherung universell fertiger Animationen für jedes Design. Ein besonders schneller Sprint kann auf dem Sprintpreset mit geändertem Timing und optionalen Effekten beruhen; es muss nicht eine dritte unabhängige Laufvorlage entstehen.

Optionale Hilfskanäle erzeugen Rumpfwippen, einfaches Nachschwingen oder eine Sprunghöhenkurve. Sie müssen in der Timeline sichtbar, abschaltbar und in normale Keyframes umwandelbar sein. Physik mit zufälligen oder nicht reproduzierbaren Ergebnissen gehört nicht in den Standardexport.

Die Figur läuft standardmäßig auf der Stelle. Eine Vorschau kann einen scrollenden Boden verwenden. Empfohlene Bewegungsgeschwindigkeit in Pixeln pro Sekunde ist Metadatum, keine automatisch eingebaute Spielsteuerung. Das Zielspiel entscheidet über tatsächliche Fortbewegung und Kollision.

#### 8.6 Springen

Bodenposition, sichtbare Körperhöhe und Schatten sind getrennte Kanäle. Eine positive Sprunghöhe verschiebt den Körper nach oben; der Schatten bleibt am Bodenanker. Schatten ist eine abschaltbare Zusatzebene, keine anatomische Körperkomponente.

Der Exportmodus legt ausdrücklich fest: Sprunghöhe **im Bild enthalten** oder **nur als Kurve/Metadatum ausgeben**. Das Zielspiel darf denselben Höhenversatz nicht zusätzlich anwenden, wenn er bereits in den Frames steckt. Die Vorschau prüft Kopf, Haare und Ausrüstung auf Überschreiten der Framefläche.

### 9. Acht Richtungen und Zeichenreihenfolge

#### 9.1 Einheitliche Richtungsnamen

Die Daten verwenden `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`. In der Oberfläche stehen zusätzlich Pfeile und deutsche Beschriftungen. In der festgelegten Ansicht bedeutet Süden die Frontansicht und Norden die Rückansicht; positive Bildschirm-Y-Werte zeigen nach unten.

Jede Richtung ist entweder **explizit bearbeitet**, **aus einer Quelle gespiegelt** oder **fehlend**. Diese Zustände sind sichtbar. Eine Richtung darf nur eine eindeutige Quelle besitzen; zyklische Spiegelreferenzen sind ungültig.

#### 9.2 Arbeitsersparnis durch fünf Ausgangsansichten

Ein Profil kann `n`, `ne`, `e`, `se` und `s` als Quellen verwenden. `nw`, `w` und `sw` werden bei geeigneten Figuren daraus abgeleitet. Es bleiben acht nutzbare Richtungen, obwohl weniger Ausgangsposen bearbeitet werden.

Das ist eine Option und keine Pflicht. Bei asymmetrischen Figuren oder Equipment müssen einzelne Gegenrichtungen explizit gestaltet werden können. Front- und Rückansicht sowie echte perspektivische Unterschiede entstehen nicht durch horizontales Spiegeln.

#### 9.3 Pose spiegeln und Bild spiegeln sind nicht dasselbe

Die Anwendung unterscheidet:

- **Pose spiegeln:** Transformationswerte werden über eine vom Profil definierte Links-/Rechts-Paarung übertragen. Danach werden die Assets der Zielrichtung gewählt.
- **Sprite spiegeln:** Ein einzelnes Bild wird nur gespiegelt, wenn die Asset-Metadaten dies erlauben.
- **Fertiges Gesamtbild spiegeln:** Nur als bewusst gewählte Abkürzung für geeignete symmetrische Figuren, nicht als unvermeidliche Exportregel.

Anatomische Slots behalten eine definierte Identität. Ausrüstung an der linken Hand darf nicht unbemerkt die Hand wechseln. Eine asymmetrische Testfigur mit nur einem farbig markierten Handschuh beziehungsweise einem einseitigen Accessoire ist Pflicht-Testmaterial. Doppelte Spiegelung muss den Ausgangszustand wiederherstellen.

#### 9.4 Vordergrund, Hintergrund und Verdeckung

Das Profil enthält eine gültige Grundreihenfolge der Teile pro Richtung. Rückwärtige Arme oder Beine müssen hinter dem Körper liegen können; vordere davor. Ein zusätzliches Accessoire besitzt ebenfalls einen klaren Einfügepunkt in dieser Reihenfolge.

Für bewegungsabhängige Änderungen sind diskrete Reihenfolge-Keys möglich. Gleichrangige Einträge werden stabil nach einer definierten Tie-Break-Regel sortiert. Eine Zielrichtung verwendet ihre eigene Grundreihenfolge; das simple Umkehren der gesamten Liste ist nicht automatisch korrekt.

Haare sind fachlich ein optionaler Slot. Ein Asset darf zusätzliche vordere/hintere Darstellungsstücke besitzen, ohne die Pflichtanatomie um einen weiteren Kopf zu erweitern.

### 10. Inventar und Sprite-Import

#### 10.1 Umfang des Inventars

Das Inventar enthält die Ausgangsbilder des jeweiligen Bereichs. Körperprofil und Größe sind dadurch eindeutig. Eine Projektansicht kann mehrere Inventare gesammelt anzeigen; eine Übernahme in einen anderen Bereich ist aber eine ausdrückliche Import-/Kopieraktion mit Kompatibilitätsprüfung.

Unterstützt werden zunächst transparente PNG-Einzelbilder sowie PNG-Sheets mit regelmäßigem Raster. Der Sheet-Import benötigt Zellgröße, Abstand, Rand und Zuordnung. Automatische Erkennung ist nur eine Vorschlagsfunktion.

#### 10.2 Vorkonfiguration der Slots

Die zuverlässigste automatische Zuordnung erfolgt durch eine kleine JSON-Begleitdatei eines Asset-Pakets. Sie nennt Profilversion, Slot, Richtung, Variante, Ausschnitt, Bildgröße und Drehpunkt.

Als zweite Möglichkeit wird eine Dateinamenskonvention angeboten, beispielsweise `forearm_l__se__base.png`. Der Import zeigt erkannte Zuordnungen vor dem Bestätigen. Mehrdeutige Namen bleiben unzugeordnet, statt heimlich einem Slot zugewiesen zu werden.

Ein beliebiges zusammengesetztes NPC-Bild wird nicht automatisch in korrekte Oberarme, Unterarme und Hände zerlegt. Die benötigten Teile müssen im Paket vorliegen oder vorher in einem Zeichenwerkzeug getrennt werden.

#### 10.3 Importprüfung

Vor der endgültigen Übernahme werden Dateiformat, tatsächliche Bildabmessungen, Alpha, Dateigröße, zulässige Ausschnitte, Profilkompatibilität und doppelte Inhalte geprüft. Transparente Ränder bleiben standardmäßig erhalten, weil sie für Pivots und Zuordnung relevant sein können.

Quellbilder werden in den Arbeitsordner kopiert. Dauerhafte Referenzen auf einen beliebigen Download-Ordner werden vermieden. Für Originaltreue bleibt das importierte Original unverändert; abgeleitete Ausschnitte können im Cache liegen. Ein Asset hat eine ID und einen Inhalts-Hash. Eine neue Bildversion ist eine neue Revision, nicht eine unsichtbare Änderung aller bisherigen Exporte.

#### 10.4 Inventarbedienung

PNG-Dateien lassen sich per Dialog oder Drag-and-drop übernehmen. Rasterkarten zeigen Bild, Slot, Richtung, Profil, Labels und Verwendungsanzahl. Filter sind Dropdowns. „In Vorlage einsetzen“ weist kompatible Slots zu; „Nur importieren“ legt die Bilder ohne Ausstattung ab.

Beim Entfernen eines verwendeten Assets werden die referenzierenden NPCs beziehungsweise Zuordnungen angezeigt. Standard ist Archivieren oder Abbrechen, nicht ein unbemerktes Erzeugen kaputter Animationen.

### 11. Anziehen, Feinschliff und Ausrüstung

#### 11.1 Drei klar getrennte Arbeitsmodi

**Inventar** verwaltet importierte Bilder. **Anziehen** weist ein Körper-/Ausrüstungspaket Slots zu. **Feinschliff** korrigiert dessen exakte Lage am Dummy.

Diese Modi erscheinen als oben sichtbare Tabs oder Schaltflächen. Die aktuelle Figur und ihre Vorschau bleiben erhalten; ein Tabwechsel setzt keine Arbeit zurück.

Im Modus Anziehen können ein vollständiges Asset-Paket oder einzelne Teile ausgewählt werden. Die Anwendung setzt kompatible Sprites zunächst mit den hinterlegten Pivots an die passenden Profilpunkte. Fehlende Slots werden mit neutralen Platzhaltern und einer verständlichen Liste angezeigt.

#### 11.2 Platzierung und Transformationen

Der Feinschliff speichert pro Slot und Richtung Bildwahl, Pivot, lokalen Offset, optionale starre Drehkorrektur, Sichtbarkeit und Schichtkorrektur. Die Dummy-Kontur kann stufenlos von unsichtbar bis deutlich sichtbar eingestellt werden; Standard ist eine schwache Umrandung.

Die Transformationsreihenfolge wird einheitlich definiert:

```text
Slot-Weltmatrix = Elternmatrix × Profil-Grundmatrix × Animationsdelta
Bildmatrix      = Slot-Weltmatrix × NPC-Anpassung × Zuordnungs-Korrektur × Pivotversatz
```

Die Anpassungen erfolgen im lokalen Koordinatensystem des jeweiligen Slots. Ein Offset in einem gedrehten Unterarm bewegt sich daher mit dem Unterarm. Hilfen zeigen lokale Achsen und Drehpunkte an. Das Raster wird erst anhand des fertigen, zusammengesetzten Zustands angewendet; wiederholtes Runden jeder Elternstufe würde Fehler aufaddieren.

#### 11.3 Korrekturen an der richtigen Stelle

| Beobachtung | Richtige Änderung |
|---|---|
| Der nackte Dummy bewegt einen Arm falsch. | Bewegungsvorlage im Dummy-Editor korrigieren. |
| Ein Sprite sitzt in jeder Bewegung zu weit links. | NPC-Aussehen im Feinschliff korrigieren. |
| Dasselbe Outfit passt nur beim Sprint an einer Stelle nicht. | Lokale Korrektur der NPC-Animationszuordnung. |
| Ein einzelnes gedrehtes Teil sieht pixelig ungünstig aus. | Alternative Sprite-Variante oder diskreten Bildwechsel verwenden. |
| Ein Accessoire liegt bei einer Richtung vor statt hinter dem Kopf. | Richtungsabhängige Schichtregel korrigieren. |

Eine laufende Vorschau, Frame-Schritte und Dummy-/Sprite-Vergleich unterstützen diese Unterscheidung. Das UI zeigt vor jedem Speichern, welcher Umfang verändert wird.

#### 11.4 Rüstung, Accessoires und Equipment

Ein Ausrüstungseintrag kann aus einem oder mehreren starren Stücken bestehen. Jedes Stück besitzt einen Anheftungs-Slot, Richtungsgrafiken, Pivot und Schichtposition. Ein Kleidungsstück, das mehrere bewegliche Körperbereiche abdeckt, muss entsprechend segmentiert sein oder als bewusst starres Teil gestaltet werden. Die App verbiegt nicht automatisch ein großes Rüstungs-PNG.

Drei Einstellungen werden getrennt gespeichert:

| Einstellung | Bedeutung |
|---|---|
| `enabled` | Teil ist sichtbar und darf exportiert werden; ausgeschaltet bleibt es gespeichert, wird aber nicht gerendert. |
| `follow_mode` | Teil folgt seinem Körper-Slot oder dem Figurenursprung. Standard ist Mitführen am Körperteil. |
| `own_motion_enabled` | Zusätzliche eigene Bewegung ist aktiv, beispielsweise ein kontrolliertes Nachschwingen. |

**Keine Eigenbewegung bedeutet nicht „bleibt im Raum stehen“.** Ein statischer Handschuh folgt trotzdem seiner Hand. Seine eigenen Bewegungsregler werden grau dargestellt, während Slot und Asset weiterhin auswählbar bleiben. Ein ausgeblendetes Teil wird dagegen auch aus dem Export ausgeschlossen.

Equipment wird nicht als zusätzlicher Pflichtknochen oder anatomischer Pflichtslot angelegt. Aktivieren eigener Bewegung blendet lediglich passende Zusatzspuren ein. Diese werden deterministisch ausgewertet und können wieder abgeschaltet werden, ohne die gespeicherten Werte zu verlieren.

### 12. NPCs, Animationszuordnung und Freigaben

#### 12.1 Freigabe der Dummy-Bewegung

Eine neue Vorlage startet als Entwurf. „Dummy freigeben“ prüft Profilreferenzen, Tracks, Frameeinstellungen und Richtungsabdeckung. Die Aktion erzeugt eine unveränderliche Revision und markiert sie als freigegeben. Ein späterer Bearbeitungsstand ist ein neuer Entwurf, keine stille Änderung der alten Revision.

Eine bereits freigegebene Karte bleibt beim normalen Klick im Ausstattungsfluss, auch wenn zusätzlich ein neuer Entwurf existiert. Ein Badge weist auf unveröffentlichte Änderungen hin. Das Editier-Icon öffnet den Entwurf.

#### 12.2 Zustandsmodell

| Objekt | Gespeicherter Arbeitszustand | Abgeleitete Zustände |
|---|---|---|
| Bewegungsvorlage | Entwurf, freigegebene Revisionen, archiviert. | Neuere Entwurfsänderung vorhanden, Richtungen fehlen. |
| Outfit-Entwurf | In Bearbeitung, einem NPC zugewiesen. | Pflichtteile fehlen, inkompatible Bilder. |
| NPC | Entwurf, geprüft, archiviert. | Welche benötigten Bewegungen vollständig sind. |
| Animationszuordnung | Entwurf oder geprüft. | Neue Vorlagenrevision verfügbar, Export veraltet, Fehler. |
| Export | Unveränderlicher Build mit Quell-Fingerabdruck. | Aktuell oder nicht mehr aktuell. |

„Exportiert“ und „vollständig“ sind keine dauerhaften Wahrheiten: Werden Quellen geändert, muss der Exportstatus neu berechnet werden. „Neue Vorlagenrevision verfügbar“ bedeutet umgekehrt nicht, dass ein alter, bewusst festgehaltener Export automatisch kaputt ist.

#### 12.3 Klick auf eine fertige Bewegung

Ist die Ansicht bereits auf einen NPC gefiltert, öffnet der Klick dessen Zuordnung. Sonst erscheint eine kompakte Auswahl: „Neuen NPC ausstatten“ oder ein vorhandener NPC aus demselben kompatiblen Bereich.

Eine Bewegungsvorlage kann mehrere NPCs bedienen. Deshalb darf der Klick auf ihre Karte nicht willkürlich einen beliebigen NPC auswählen. Die zuletzt benutzte Auswahl darf angeboten werden, bleibt aber sichtbar.

#### 12.4 NPC speichern und weitere Bewegungen hinzufügen

Beim ersten Speichern werden Name, Labels und optionale Beschreibung erfragt. Der neue NPC bekommt eine stabile ID und einen physischen Ordner. Das aktive Outfit und die aktive Bewegung werden zugeordnet.

Für eine weitere Bewegung wird ausdrücklich derselbe NPC über seine ID gewählt. Die Anwendung verwendet dessen Aussehen und erstellt nur die fehlende Animationszuordnung. Ein gleicher Textname allein führt nicht zu einem automatischen Zusammenführen zweier Figuren.

Das NPC-Dashboard zeigt die Summe der zugeordneten Bewegungen, fehlende erforderliche Bewegungen, Richtungsabdeckung und Exportstatus. In der Detailansicht lässt sich zwischen allen Bewegungen und Richtungen wechseln.

#### 12.5 Änderungen und Wiederverwendung

Änderungen des NPC-Aussehens wirken grundsätzlich auf seine zugeordneten Bewegungen, soweit dort kein lokaler Override hinterlegt ist. Vor einer breiten Änderung wird die Zahl der betroffenen Zuordnungen angezeigt. Raster-Caches und Export-Fingerabdrücke werden entsprechend ungültig.

Eine neue Vorlagenrevision wird nicht automatisch auf alle NPCs angewendet. Der Nutzer kann bestehende Revision beibehalten, eine neue Version mit Vergleich übernehmen oder die Vorlage abzweigen. Vor einem Update werden lokale Korrekturen auf noch gültige Slot-IDs und Richtungen geprüft.

Duplizieren eines NPCs erzeugt neue NPC- und Zuordnungs-IDs, darf aber unveränderliche Assets und Vorlagenrevisionen innerhalb desselben Bereichs weiter referenzieren. Projektübergreifendes Kopieren muss seine Abhängigkeiten vollständig mitnehmen und IDs nötigenfalls abbilden.

### 13. Arbeitsordner und physische Dateistruktur

#### 13.1 Grundsatz

Der Arbeitsordner ist unabhängig vom Programm-Installationsordner und vom GitHub-Checkout. Die App darf in ihren Installationsdateien keine Nutzerprojekte speichern. Ein vollständig kopierter Vault muss sich auf einem anderen unterstützten Desktop wieder öffnen lassen.

Die gewünschte sichtbare Fachstruktur bleibt erhalten:

```text
Arbeitsordner / Projekt / Bereich / NPC / Animation
```

Hilfsdaten für Vorlagen, Inventar und Profile werden auf der jeweils passenden Ebene abgelegt. Sie werden nicht in einen globalen Ordner verlagert.

#### 13.2 Verbindlicher Strukturvorschlag

Die kurzen ID-Suffixe im folgenden Baum sind nur lesbare Darstellungen; JSON-Dateien enthalten vollständige stabile IDs.

```text
Mein-Arbeitsordner/
├── .pixelforge-studio/
│   ├── vault.json                   # Format, Vault-ID, globale Einstellungen
│   ├── labels.json                  # Workspace-Labels für Projekte
│   ├── ui.json                      # globale Ansichtseinstellungen
│   └── runtime/                     # globaler Schreib-Lock, keine Projektquellen
│
├── mein-rpg--p123/
│   ├── .project/
│   │   ├── project.json             # Projektname, ID, Status, Labels
│   │   ├── labels.json              # Labels innerhalb dieses Projekts
│   │   ├── cache/                   # neu aufbaubare Projektindizes/Vorschaudaten
│   │   ├── transactions/            # Wiederherstellungsprotokolle
│   │   ├── backups/                 # versionierte Sicherungen vor Änderungen
│   │   └── trash/                   # entfernte Objekte dieses Projekts
│   │
│   └── npcs--a123/
│       ├── .area/
│       │   ├── area.json            # Profil, Größe, Richtungen, Standardfläche
│       │   ├── profiles/
│       │   │   └── humanoid--h123/
│       │   │       └── r0001.json   # unveränderlicher Profil-Snapshot
│       │   ├── assets/
│       │   │   └── asset--s123/
│       │   │       ├── asset.json
│       │   │       └── r0001/
│       │   │           └── source.png
│       │   ├── templates/
│       │   │   └── walk--t123/
│       │   │       ├── template.json
│       │   │       ├── draft.json
│       │   │       └── revisions/
│       │   │           └── r0001.json
│       │   └── drafts/
│       │       └── outfit--d123.json
│       │
│       └── dorfbewohner-01--c123/
│           ├── character.json      # NPC-Identität, Labels, benötigte Aktionen
│           ├── appearances/
│           │   └── default.json    # Sprite-Zuordnung und Feinschliff
│           ├── walk--b123/
│           │   ├── binding.json    # Vorlagenrevision + NPC + lokale Korrekturen
│           │   └── exports/
│           │       ├── current.json
│           │       └── build-<hash>/
│           │           ├── sheet-0.png
│           │           ├── animation.json
│           │           ├── walk.tres        # bei Godot-Einzelexport
│           │           └── frames/          # nur bei angefordertem Einzelbildexport
│           │               └── s/
│           │                   └── 0000.png
│           ├── sprint--b456/
│           │   └── binding.json
│           ├── jump--b789/
│           │   └── binding.json
│           └── _exports/
│               └── build-<hash>/   # optionales, eigenständig kopierbares NPC-Paket
│                   ├── character.json
│                   ├── sprite_frames.tres
│                   ├── character.tscn
│                   └── animations/
│                       ├── walk/
│                       │   ├── sheet-0.png
│                       │   └── animation.json
│                       └── sprint/
│                           ├── sheet-0.png
│                           └── animation.json
│
├── zweites-spiel--p456/
│   └── ...
└── .trash/                         # nur vollständig entfernte Projekte
```

Unter `.pixelforge-studio` liegen **keine NPC-Bilder, Bewegungstracks oder projektbezogenen Backups**. Das globale Verzeichnis darf eine neu erzeugbare Übersicht der Projekte enthalten, ist aber kein Ersatz für deren eigene Daten.

#### 13.3 Benennung und Referenzen

Ordnernamen bestehen aus einem bereinigten Anzeigenamen und einem ID-Suffix. Unzulässige Betriebssystemzeichen, reservierte Namen, abschließende Punkte/Leerzeichen und kollidierende Groß-/Kleinschreibung werden geprüft. Bei einer Kollision wird das ID-Suffix verlängert. Vom Nutzer eingegebene Namen werden nicht direkt als Pfade verwendet.

Normale Objekt-Namen sollen innerhalb derselben Geschwisterebene eindeutig sein. IDs bleiben trotzdem notwendig. Umbenennen aktualisiert Metadaten und, falls der lesbare Ordnername angepasst wird, den Ordner über eine kontrollierte Dateitransaktion. Zuordnungen bleiben wegen der IDs intakt.

Verweise innerhalb des Vaults werden über IDs aufgelöst. Gespeicherte Asset-Unterpfade sind relativ zu ihrem zuständigen Bereich. Absolute Maschinenpfade sind in portablen Projektquellen und Exporten verboten.

#### 13.4 Was dauerhaft gespeichert wird

Autoritativ sind JSON-Quellen, Profil-Snapshots, importierte PNGs und die verwendeten Revisionen. Vorschau-Bilder, Suchindizes und fertig gerenderte Exporte sind abgeleitete Daten und müssen neu erzeugbar sein.

Ein JSON-Verzeichnisbaum ist kein Anlass, zusätzlich SQLite oder eine andere versteckte Datenbank einzubauen. Listen und Suchen arbeiten zunächst mit einem neu aufbaubaren In-Memory-Index; ein optionaler JSON-Cache ist ausschließlich eine Beschleunigung.

### 14. Datenverträge und Versionsregeln

#### 14.1 Gemeinsame Regeln

Jede autoritative JSON-Datei enthält `schema_version`, `kind` und eine stabile Objekt-ID beziehungsweise eine eindeutig zugeordnete Revision. Veränderliche Objekte enthalten eine monotone `revision`, Zeitstempel und Elternreferenz. Zeitstempel sind UTC-Zeichenketten; sie bestimmen nicht allein die fachliche Identität oder Export-Aktualität.

IDs werden als UUID-Strings erzeugt und verglichen, nicht als Fließkommazahlen. Ganzzahlige Felder werden beim Einlesen ausdrücklich validiert. Vektoren sind kleine Zahlenarrays oder Objekte nach festem Schema. Unbekannte zukünftige Schema-Versionen werden nicht mit einer alten Version überschrieben.

In Version 1 verwenden alle nicht ausdrücklich optionalen Referenzen gültige IDs. Verwaiste Referenzen erzeugen eine Reparaturmeldung und blockieren betroffene Exporte. Sie werden nicht stillschweigend durch irgendein ähnlich benanntes Objekt ersetzt.

#### 14.2 Vertragsübersicht

| Dokument | Pflichtinhalte und Invarianten |
|---|---|
| `vault.json` | Vault-ID, Formatkennung, Schema-Version, Erstellungszeit; keine eingebetteten Projektassets. |
| `project.json` | Projekt-ID, Anzeigename, Status, Workspace-Label-IDs. Zugehörige Bereiche werden anhand ihrer Manifeste gefunden. |
| `area.json` | Bereichs-ID, Projekt-ID, Name, Objekttyp, Standard-Profilreferenz, Höhe, Richtungsmodell, Standard-Framefläche, Bodenanker. |
| Profilrevision | Profil-ID/Revision, Referenzhöhe, alle Slot-IDs, erlaubte Elternbeziehungen, Grundmatrizen, Pivots, Größen, Richtungsansichten, Links-/Rechts-Paarung und Ebenen. Der Elternbaum ist azyklisch. |
| `template.json` | Vorlagen-ID, Bereichs-ID, Name, Aktionstyp, Labels, archiviert/aktiv, Liste freigegebener Revisionen, Entwurfsreferenz. |
| Vorlagenrevision | Profilreferenz, Framefläche, Bodenanker, FPS, Frameanzahl, Schleifenmodus, acht Richtungsdefinitionen, Spuren und diskrete Änderungen. Unveränderlich nach Freigabe. |
| `asset.json` | Asset-ID, Originalname, Art, Slot-/Richtungs-Metadaten, Revisionen, relative Dateien, Maße, Pivots, Inhalts-Hashes und Herkunfts-/Lizenznotiz. |
| Outfit-Entwurf | Entwurfs-ID, Bereich, aktive Vorlagenrevision, noch nicht endgültig benanntes Aussehen, letzter Bearbeitungszustand. |
| `character.json` | NPC-ID, Bereichs-ID, Name, Labels, Profilreferenz, Standard-Aussehens-ID und benötigte Aktionstypen. |
| Aussehen | Aussehens-ID, NPC-ID, Profilreferenz, Slot-Zuordnungen, pro Richtung Fitting, Equipment und eigene Revision. |
| `binding.json` | Zuordnungs-ID, NPC-ID, eindeutiger `action_key`, Vorlagen-ID und festgehaltene Revision, Aussehens-ID, optionale lokale Korrekturen, Prüfstatus. |
| Exportmanifest | Formatversion, Erzeugerversion, Quellen-Fingerabdruck, Frameflächen, Bodenanker, Aktionen/Richtungen, Seiten und Rechtecke, FPS, Loop, Spiegelherkunft und Prüfergebnisse. |

#### 14.3 Wichtige Validierungen

Für jede aktive Spur existiert ein Slot. Ein Slot hat höchstens einen Eltern-Slot. Spiegelquellen existieren und bilden keinen Zyklus. Jeder exportierte Frame verweist auf ein vorhandenes Bildrechteck innerhalb einer PNG-Seite. Frameanzahl und FPS sind positiv und begrenzt. Es gibt keine NaN- oder unendlichen Zahlen.

Eine Zuordnung darf keine Vorlage einer inkompatiblen Profilrevision erhalten. Eine Größenänderung wird nicht allein durch übereinstimmende Namen als kompatibel betrachtet. Ein NPC hat je `action_key` höchstens eine aktive Zuordnung; bewusst verschiedene Varianten verwenden andere Schlüssel, etwa `walk` und `walk_carry`.

Zunächst gelten als Planungsgrenzen: Figurenhöhe 16–512 px, Framefläche je Achse höchstens 1024 px, 1–1024 Frames und 1–120 FPS. Dies sind Produktgrenzen, keine behaupteten Engine-Maximalwerte. Der Speicherbedarf wird zusätzlich vor dem Rendern berechnet und kann strengere Grenzen erfordern.

#### 14.4 Referenzen, Kopien und Revisionen

Vorlagenrevisionen, Profilrevisionen und importierte Bildrevisionen sind nach Veröffentlichung unveränderlich. Änderungen erzeugen neue Revisionen. Dadurch können alte Zuordnungen reproduzierbar bleiben.

Eine exportierte Animation referenziert die **effektiv verwendeten** Revisionen, nicht pauschal die jeweils neuesten Daten. Nicht verwendete neue Revisionen machen bestehende Exporte nicht automatisch ungültig. Ändern sich aber tatsächlich referenzierte veränderliche Fitting-Daten, wird die betroffene Ausgabe als veraltet markiert.

Der Quellen-Fingerabdruck berücksichtigt verwendete Profile, Vorlagen, Bildinhalte, Fitting, Overrides, Exportoptionen und Rasterer-Version. Nur eine neue Uhrzeit darf keinen neuen visuellen Build erzwingen. JSON wird für den Fingerabdruck kanonisch normalisiert; zufällige Dictionary-Reihenfolgen sind ungeeignet.

### 15. JSON-Beispiele

Die folgenden Ausschnitte erklären die Formate. Sie sind **keine vollständig ladbare Beispiel-Vault**; vollständige, schemageprüfte Fixtures werden in den Implementierungsphasen angelegt. Die IDs sind beispielhafte UUIDs.

#### 15.1 Bereich mit 80-px-NPC-Profil

```json
{
  "schema_version": 1,
  "kind": "area",
  "id": "22222222-2222-4222-8222-222222222222",
  "project_id": "11111111-1111-4111-8111-111111111111",
  "name": "NPCs",
  "object_type": "humanoid",
  "profile_ref": {
    "id": "33333333-3333-4333-8333-333333333333",
    "revision": 1
  },
  "reference_height_px": 80,
  "directions": ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
  "default_frame_size_px": [128, 128],
  "default_ground_origin_px": [64, 108]
}
```

#### 15.2 Ausschnitt einer Bewegungsspur

```json
{
  "slot_id": "upper_arm_l",
  "property": "rotation_deg",
  "interpolation": "linear",
  "keys": [
    {"frame": 0, "value": -20},
    {"frame": 3, "value": 0},
    {"frame": 6, "value": 20},
    {"frame": 9, "value": 0}
  ]
}
```

Bei zwölf Loop-Frames wird der Übergang von Index 9 zurück zur Pose bei 0 über den gedachten Zeitpunkt 12 ausgewertet. Dieser Wert gehört zur Bewegungsdefinition, nicht zum PNG-Inhalt.

#### 15.3 Animationszuordnung eines NPCs

```json
{
  "schema_version": 1,
  "kind": "animation_binding",
  "id": "88888888-8888-4888-8888-888888888888",
  "character_id": "66666666-6666-4666-8666-666666666666",
  "action_key": "walk",
  "template_ref": {
    "id": "44444444-4444-4444-8444-444444444444",
    "revision": 1
  },
  "appearance_id": "77777777-7777-4777-8777-777777777777",
  "revision": 1,
  "local_overrides": [],
  "review_state": "draft"
}
```

#### 15.4 Ausrüstung ohne Eigenbewegung

```json
{
  "equipment_id": "99999999-9999-4999-8999-999999999999",
  "name": "Linker Handschuh",
  "anchor_slot": "hand_l",
  "enabled": true,
  "follow_mode": "slot",
  "own_motion_enabled": false,
  "fit_by_direction": {
    "s": {"offset_px": [0, 0], "rotation_deg": 0}
  }
}
```

Der Handschuh folgt der Hand, obwohl eigene Bewegungsregler deaktiviert sind. Eine fehlende Richtungszuordnung wird weiterhin geprüft; dieser Ausschnitt zeigt nur eine Richtung.

### 16. Render- und Exportpipeline

#### 16.1 Quellenformat und Ausgabeformat nicht verwechseln

**Bearbeitbare Quelle:** JSON-Tracks, Profile, Fitting und die ursprünglichen Körper-/Equipment-PNGs.
**Standard-Spielausgabe:** gebackene PNG-Sprite-Sheets plus JSON-Metadaten.
**Zusätzliche Engine-Ausgabe:** Godot-Ressourcen, die diese PNGs referenzieren.
**Optional:** vollständige Einzel-PNG-Sequenzen.

Es wird kein proprietärer, undurchsichtiger Container als einziges Arbeitsformat eingeführt. Ein ZIP-Paket darf als Transportverpackung dienen, ersetzt aber nicht die Ordnerstruktur der geöffneten Vault. Eine `.tres`-Datei allein ist ebenfalls kein Ersatz für die Studio-Quelldaten.

#### 16.2 Gemeinsame Auswertung

```text
Profil-Snapshot + Bewegung + NPC-Aussehen + lokale Korrekturen
                             ↓
             Richtung und Frameindex auflösen
                             ↓
             starre Welttransformationen berechnen
                             ↓
            Sichtbarkeit und Schichtfolge bestimmen
                             ↓
       Pixelrasterung in ein RGBA-Bild definierter Größe
                             ↓
       Vorschau ODER Atlasaufbau ODER Einzelbildexport
```

Vorschau und Export verwenden dieselben Samples. Eine GPU-Vorschau mit abweichender Rasterregel darf nicht die alleinige Referenz für ein anderes CPU-Exportergebnis sein.

#### 16.3 Referenz-Rasterer

Für Version 1 wird ein prüfbarer CPU-Rasterer auf Godot-`Image`-Basis vorgesehen. Bilder können über Godot geladen und als PNG gespeichert werden. [S7]

Statische und ganzzahlig verschobene Teile erhalten einen schnellen Kopier-/Compositing-Pfad. Gedrehte Teile werden innerhalb ihrer Zielbegrenzung per inverser starrer Transformation und Nearest-Sampling abgetastet. Bildpixel werden nicht weich interpoliert. Die Sample-Punkte und die Behandlung von Randpunkten werden ausdrücklich definiert.

Die endgültige Ursprungslage wird nach dem Zusammensetzen der Transformationskette quantisiert. Rundung für negative und positive Werte wird einheitlich implementiert und getestet. Für Alphakomposition gilt eine dokumentierte Source-over-Regel auf RGBA8, mit reproduzierbarer Ganzzahl-Rundung; vollständig transparente Pixel werden auf transparente schwarze Werte normalisiert.

Vollständig plattformidentische Pixel sind ein **zu prüfendes Qualitätsziel**, kein aus der Frameworkwahl automatisch folgendes Versprechen. Golden-Image-Tests vergleichen dekodierte RGBA-Pixel. Identische PNG-Bytes werden nur verlangt, wenn Encoder und Metadaten kontrolliert identisch sind.

Bei zu langsamer GDScript-Rasterung wird zuerst gecacht, blockweise gearbeitet und gemessen. Eine native Beschleunigung benötigt einen gesonderten Entscheid und muss dieselben Referenzbilder erzeugen. Ein zweiter ungeprüfter Renderer ist keine zulässige Abkürzung.

#### 16.4 Atlasaufbau

Standard ist ein regelmäßiges Raster mit gleicher Framegröße. Die Richtungssortierung ist fest und in JSON enthalten. Innerhalb einer Richtung folgen die Samples in Timeline-Reihenfolge.

Automatisches Beschneiden transparenter Ränder und Rotieren gepackter Frames sind standardmäßig ausgeschaltet. Sonst könnten Bodenanker und Animation beim Abspielen springen. Jeder Frame besitzt einen expliziten Rechteck-Eintrag, sodass mehrere Atlas-Seiten möglich bleiben.

Die maximale Atlas-Seite ist im Exportprofil begrenzt, zunächst auf 4096 × 4096 px. Dies ist ein bewusstes Produktlimit, keine pauschale Hardwareaussage. Passt der Clip nicht auf eine Seite, werden weitere Seiten erzeugt. Der Export versucht nicht, beliebig große Texturen oder alle NPCs gleichzeitig im Speicher zu halten.

Standardpadding ist null für das gleichmäßige, ungefilterte Raster. Ein optionaler Rand-/Extrusionsmodus ist getrennt konfigurierbar und muss in den Frame-Rechtecken korrekt berücksichtigt werden. Die tatsächliche Pixelgrafik wird dabei nicht skaliert.

#### 16.5 Metadaten pro Animation

Das JSON enthält mindestens Formatversion, Aktion, Richtungsliste, Framefläche, Bodenanker, FPS, Loop-Flag, Frameanzahl, Atlas-Dateien, Frame-Rechtecke, Quellen-Fingerabdruck und Angaben zum Sprung-/Root-Modus.

Ein Frame-Eintrag kann beispielsweise so aussehen:

```json
{
  "direction": "s",
  "frame": 0,
  "page": "sheet-0.png",
  "rect_px": [0, 512, 128, 128],
  "ground_origin_px": [64, 108],
  "duration_ticks": 1
}
```

In Version 1 entspricht ein Tick `1 / fps` Sekunden. Alle ausgegebenen Samples haben zunächst die Dauer eins; identische Bilder werden nicht heimlich zeitlich zusammengezogen.

#### 16.6 Exportdialog und Prüfungen

Der Exportdialog bietet NPC/Zuordnung, Richtungen, Format, maximale Seitengröße, Einzelbilder ein/aus, Schatten ein/aus, Sprunghöhe gebacken/extern und ein optionales Zielverzeichnis. Gespeicherte Exportprofile reduzieren wiederholte Eingaben.

Vor dem Schreiben werden Vollständigkeit, Referenzen, Richtungsabdeckung, verfügbare Bildgrößen, Clipping, Speicherschätzung und Namenskollisionen geprüft. Ein vollständiger NPC-Export blockiert bei fehlenden Pflichtdaten. Ein absichtlich unvollständiger Testexport ist möglich, muss aber eindeutig als solcher gekennzeichnet werden.

Der Export wird in einem neuen Build-Verzeichnis erzeugt. Erst nach erfolgreicher Prüfung wird `current.json` auf diesen Stand gesetzt. Ein Abbruch oder Fehler darf den letzten guten Export nicht beschädigen. Fortschritt und Abbruch bleiben bedienbar; nur temporäre Daten des eigenen Jobs werden aufgeräumt.

#### 16.7 Gemeinsame Größe eines NPC-Pakets

Für zusammengehörige Animationen sollen Framefläche und Bodenanker gleich sein. Weichen sie ab, warnt der Paketexport und bietet ein gemeinsames transparentes Padding an. Er skaliert nicht ungefragt alle Bilder. Der Paketmanifest-Anker muss mit den tatsächlich ausgegebenen Frames übereinstimmen.

Einzelbildexport verwendet richtungsgetrennte Ordner und nullaufgefüllte Nummern. Er bleibt eine Komfortoption für andere Werkzeuge, nicht die primäre Speichermethode jedes bearbeiteten Zwischenzustands.

### 17. Godot-Export und Einbindung in Spiele

#### 17.1 Zielpaket

Ein vollständiger NPC-Export enthält PNG-Sheets, ein allgemeines JSON-Manifest, eine `SpriteFrames`-Ressource (`sprite_frames.tres`) und optional eine kleine Szene mit `AnimatedSprite2D` (`character.tscn`).

Godot unterstützt Animationen aus Einzelbildern oder Sprite-Sheets. `SpriteFrames` hält die Animationssequenzen; `AtlasTexture` kann die Teilrechtecke einer Atlasgrafik adressieren. Daher passt ein PNG-plus-Metadaten-Export zu diesem Ziel. [S11–S13]

Die Engine-Dateien sind **ableitbare Ausgabe**, nicht das Bearbeitungsformat des Studios. Das allgemeine JSON bleibt verfügbar, damit die Ausgabe auch in anderen Engines weiterverarbeitet werden kann.

#### 17.2 Namens- und Ressourcenvertrag

Animationsnamen lauten beispielsweise `idle_s`, `walk_s`, `walk_ne`, `sprint_w` und `jump_n`. Alle acht Richtungen werden im Standardpaket vollständig ausgegeben; das Zielspiel muss keine zusätzliche Spiegelregel erraten.

Die Godot-Dateien referenzieren PNGs über portable Ressourcenpfade innerhalb des exportierten Pakets. Maschinenspezifische absolute Pfade und Pfade in die ursprüngliche Vault sind verboten. Relative externe Ressourcenpfade sind im Godot-Textformat vorgesehen; ihre tatsächliche Verwendung im erzeugten `.tres`-/`.tscn`-Paket wird durch einen frischen Importtest abgesichert. [S14]

Der Exporter darf Ressourcen-Text kontrolliert erzeugen, muss dabei Strings und IDs korrekt escapen und anschließend mit Godot selbst validieren. Das blinde Speichern einer zur Laufzeit aus einer externen PNG erzeugten Textur kann zu eingebetteten Bilddaten statt der beabsichtigten externen Datei führen; das Format wird deshalb ausdrücklich geprüft. [S15]

#### 17.3 Darstellungsregeln im Zielspiel

Die mitgelieferte Szene besitzt einen Figurenursprung am Boden. Das Sprite verwendet den exportierten Bodenanker als negativen Bildoffset und keine widersprüchliche zusätzliche Zentrierung. Texturfilter ist Nearest. Ein Richtungswechsel behält denselben Bodenbezug.

Die Szene enthält keine erzwungene Spielsteuerung, Kollisionslogik oder zusätzliche Knochen. Das Spiel wählt Aktion und Richtung und startet die passende Animation. Ein Sprungmodus ist im Manifest vermerkt, damit das Spiel nicht doppelt vertikal versetzt.

Für Bildraten übernimmt `SpriteFrames` die exportierte Animations-FPS. Bei später eingeführten variablen Dauern muss die relative Dauer nach dem `SpriteFrames`-Vertrag umgerechnet werden; in Version 1 bleiben die Samples gleich lang. [S11]

#### 17.4 Verbindlicher Integrationstest

Ein Export wird in ein **frisches temporäres Godot-Projekt** kopiert. Dort werden PNGs importiert und die Ressourcen geladen. Der Test zählt Animationsnamen und Frames, prüft Atlasrechtecke und lädt die erzeugte Szene. Das Paket wird zusätzlich in ein anders benanntes Unterverzeichnis verschoben und erneut geprüft.

Kein Test darf nur deshalb bestehen, weil der Entwickler-Rechner noch alte `.godot`-Importdaten oder Pfade zur ursprünglichen Vault besitzt. Die zunächst zugesicherte Kompatibilität gilt für die geprüfte Godot-Version 4.7.2. Weitere Godot-4-Versionen werden nur nach tatsächlichem Test als unterstützt dokumentiert.

### 18. Softwarearchitektur und Repository-Struktur

#### 18.1 Trennung der Verantwortlichkeiten

| Schicht | Verantwortung | Darf nicht |
|---|---|---|
| Fachmodelle | Projekte, Profile, Vorlagen, Aussehen, Zuordnungen, Validierung. | Auf konkrete UI-Nodes oder Dateidialoge angewiesen sein. |
| Anwendungsdienste | Abläufe wie NPC speichern, Vorlage freigeben, Export starten. | Fachzustand ausschließlich in UI-Controls verstecken. |
| Speicherung | JSON lesen/schreiben, IDs auflösen, Revisionen, Recovery. | Beliebige ungeprüfte Pfade aus UI-Text übernehmen. |
| Animation/Rendering | Samples, starre Transformationen, Rasterung, Atlasaufbau. | Vom Echtzeit-Abspielverlauf oder Zufall abhängen. |
| Oberfläche | Navigation, Auswahl, Inspector, Timeline, Vorschau. | Nebenbei autoritative Dateien ohne Service schreiben. |
| Adapter | Nativer Dialog, Dateisystem, Godot-Paketexport, Diagnose. | Allgemeine Fachmodelle an ein bestimmtes Exportformat ketten. |

Runtime-Modelle können typisierte GDScript-Klassen sein. Ihre Persistenz bleibt ausdrücklich JSON; interne Godot-Objekte werden nicht unkontrolliert als native Ressourcen serialisiert.

#### 18.2 Vorgesehene Dienste

`VaultService` öffnet und schließt Arbeitsordner. `JsonStore` validiert und schreibt einzelne Dokumente. `TransactionService` koordiniert mehrteilige Änderungen und Recovery. `ObjectIndex` löst IDs auf. `ProfileService` erstellt versionierte Körperkonfigurationen. `AnimationSampler` berechnet Posen. `DirectionResolver` behandelt Spiegelungen und explizite Ansichten. `PixelCompositor` rendert das Referenzbild. `AppearanceService` verwaltet Zuordnung und Feinschliff. `ExportService` erstellt generische Builds. `GodotExporter` erzeugt die Engine-Dateien. `PreviewCache` hält begrenzte, neu aufbaubare Vorschaudaten.

Eine zentrale Command-Abstraktion verbindet Änderungen mit Undo/Redo, Dirty-Status und Autosave. Speichern ist nicht an zufällige Signalreihenfolgen mehrerer Panels gekoppelt.

#### 18.3 Passende Erweiterung der vorhandenen Struktur

```text
game/
├── project.godot
├── scenes/bootstrap.tscn            # vorhandenen Einstieg kontrolliert anpassen
├── services/                       # vorhandene Services prüfen und ggf. weiterverwenden
├── studio/
│   ├── app/                        # Start, Session, Navigation, Commands
│   ├── domain/                     # Modelle und Fachvalidierung
│   ├── storage/                    # Vault, JSON, Pfade, Journal, Revisionen
│   ├── animation/                  # Sampling, Richtungen, Posen, Presets
│   ├── rendering/                  # CPU-Compositor, Atlas, Cache
│   ├── exports/                    # generischer und Godot-Exporter
│   ├── ui/
│   │   ├── shell/
│   │   ├── dashboards/
│   │   ├── dummy_editor/
│   │   ├── outfit_editor/
│   │   ├── timeline/
│   │   └── components/             # Karten, Dropdowns, Dialoge
│   └── resources/
│       ├── profiles/               # mitgelieferte Basisprofile
│       ├── motions/                # Startpresets
│       └── theme/
└── tests/
    └── studio/
        ├── unit/
        ├── integration/
        ├── golden/
        └── fixtures/

docs/developer/
├── features/pixelcutoutsprite-studio.md
├── plans/pixelcutoutsprite-execplan.md
├── prompts/pixelcutoutsprite/
└── decisions/                      # Entscheidungen während der Umsetzung

tools/                              # vorhandenes Python-Tooling erweitern
config/                             # vorhandene Konfiguration weiterverwenden
```

Diese Struktur ist ein Zielbild. Vorhandene Klassen und Prüfverträge werden in Phase 00 gelesen. Kein paralleles zweites App-Projekt wird ohne begründete Notwendigkeit angelegt.

#### 18.4 Tooling und Versionierung

`python tools/control.py` bleibt der führende Einstieg. Vorhandene `style`, `check`, `godot4 test` und Desktop-Exportbefehle werden erhalten oder nachvollziehbar weiterentwickelt. Neue Befehle wie `studio validate-vault` oder `studio export-fixture` sind **geplante Erweiterungen**, keine Behauptung über bereits vorhandene Befehle.

Produktname, Repository-Metadaten, Dokumentationslinks und Paketbezeichnungen müssen vom Forge2D-Template auf PixelCutoutSprite angepasst werden. Die bestehende Lizenz wird nicht stillschweigend geändert. Toolchain-Downloads werden nur mit geprüfter Herkunft und dokumentierter Version automatisiert.

### 19. Speichern, Wiederherstellung und Sicherheit

#### 19.1 Öffnen und Initialisieren

Ein neuer leerer Ordner wird nach bewusster Auswahl initialisiert. In einem nicht leeren Ordner ohne gültige Vault-Metadaten zeigt die App vorab, welche Verwaltungsdateien sie anlegen würde. Vorhandene fremde Dateien bleiben unangetastet.

Ein Ordner mit ungültigen Metadaten wird nicht als vermeintlich leerer Arbeitsordner überschrieben. Stattdessen gibt es Diagnose, schreibgeschützte Ansicht soweit möglich und Wiederherstellungsoptionen.

Gerätespezifisch darf die App außerhalb des Vaults eine kleine Einstellungsdatei für zuletzt geöffnete Pfade und Fensterpositionen führen. Dort liegen keine autoritativen NPCs oder Animationen. Diese ausdrückliche Ausnahme ist nötig, um einen zuletzt verwendeten Ordner überhaupt wieder anbieten zu können.

#### 19.2 Schreibstrategie

Ein einzelnes JSON-Dokument wird zunächst vollständig in eine temporäre Datei im selben Verzeichnis geschrieben, geschlossen und erneut validiert. Der vorherige gültige Stand bleibt bis zum erfolgreichen Austausch erhalten.

Änderungen an mehreren Dateien oder Ordnern erhalten eine Transaktions-ID und ein kleines JSON-Journal mit geplanten Schritten. Die Schritte sind wiederaufnehmbar beziehungsweise rückrollbar. Ein Erfolgsmarker wird zuletzt geschrieben. Ein Neustart prüft offene Journale und bietet eine eindeutige Wiederherstellung an.

**Keine falsche Atomaritätsgarantie:** Mehrere Dateischreibvorgänge sind nicht automatisch eine Datenbanktransaktion. Stromausfall, Windows-Dateisperren und unterschiedliche Dateisysteme werden über Fehlerbehandlung und Recovery berücksichtigt. Das konkrete Austausch-/Umbenennungsverhalten der Dateisystem-APIs ist pro Plattform zu testen. [S3, S4]

#### 19.3 Autosave und Undo/Redo

Vollendete Bearbeitungsaktionen lösen einen verzögerten Autosave aus; als Startwert sind etwa zwei Sekunden Ruhe nach einer Aktion vorgesehen. Dauerhafte Freigaben und Exportstände entstehen trotzdem nur durch ausdrückliche Aktionen.

Der Speichermodus zeigt „Ungespeichert“, „Speichert“, „Gespeichert“ oder „Speicherfehler“. Bei Fehlern bleibt der aktuelle Arbeitsspeicherzustand erhalten und die App bietet erneut speichern beziehungsweise eine sichere Kopie an. Navigation und Schließen dürfen ungespeicherte Änderungen nicht still verwerfen.

Undo/Redo gilt für Posen, Timeline, Fitting und Slotzuordnung. Speichern löscht die Undo-Historie der laufenden Sitzung nicht. Löschen eines ganzen Projekts oder ein Schema-Upgrade ist keine gewöhnliche Undo-Aktion und verwendet gesonderte Sicherung/Bestätigung.

#### 19.4 Ein Schreiber pro Vault

Version 1 unterstützt einen aktiven schreibenden App-Prozess je Vault. Ein zweiter Prozess erhält eine schreibgeschützte Öffnung oder die klare Meldung, dass der Ordner bereits bearbeitet wird.

Der Lock verwendet einen eindeutig beanspruchten Lock-Pfad, Instanzkennung und kontrollierte Lebenszeichen. Ein vermeintlich alter Lock wird nicht allein wegen einer kurzen Zeitüberschreitung gelöscht. Nach einem Absturz ist eine erklärte Wiederherstellung nötig. Netzwerkfreigaben und gleichzeitig synchronisierte Mehrrechner-Bearbeitung sind kein unterstützter kollaborativer Modus.

#### 19.5 Fremde Änderungen und Migrationen

Vor einem Austausch wird geprüft, ob die gespeicherte Revision noch der gelesenen Revision entspricht. Eine externe Änderung führt zu einer Konfliktmeldung mit Optionen zum neu Laden oder getrennten Sichern, nicht zum automatischen Überschreiben.

Jede Formatmigration hat eine bekannte Ausgangs- und Zielversion, Tests und einen Backup-Schritt. Zukünftige unbekannte Versionen werden nur lesend geöffnet oder abgelehnt. Migration darf unbekannte Nutzerdaten nicht still entfernen.

#### 19.6 Vertrauensgrenzen

Importiert werden nur erlaubte Datenformate. PNG-Dekodierung und JSON-Verarbeitung haben Größenlimits. Für erste Produktgrenzen gelten maximal 32 MiB komprimierte PNG-Dateigröße und maximal 64 MiB dekodierte RGBA-Daten pro importiertem Bild. Das sind konfigurierbare Schutzgrenzen, keine generellen PNG- oder Engine-Limits.

Nutzerdateien werden nicht als GDScript, `.tscn`, `.tres` mit angehängtem Script oder beliebiges ausführbares Plugin geladen. Der Godot-Exporter erzeugt kontrollierte eigene Dateien, führt aber nichts aus der Vault als Nutzercode aus.

Pfad-Traversal, absolute Pfade in Importmanifesten, ungültige Dateinamen und Verweise außerhalb der zuständigen Wurzel werden abgewiesen. Symbolische Links werden nicht blind rekursiv verfolgt. Die Pfadprüfung muss am tatsächlichen Dateisystem erfolgen; reine String-Präfixvergleiche reichen nicht. Verbleibende Betriebssystem-Race-Bedingungen werden dokumentiert und nicht durch überzogene Sicherheitsversprechen verdeckt.

Die App funktioniert ohne Login, Cloud-Dienst oder Telemetrie. Laufzeit-Netzwerkzugriffe sind für Version 1 nicht erforderlich. Logs enthalten keine kopierten Bildinhalte oder unnötigen privaten Vollpfade.

### 20. Desktop-Bedienung und Qualitätsziele

#### 20.1 Desktop-Layout

Planungsgröße ist ein gut nutzbares Fenster von ungefähr 1440 × 900 px; Mindestlayout wird bei 1280 × 720 px geprüft. Das sind Layoutziele, keine festgeschriebene Monitorauflösung. Panels sind verstellbar oder einklappbar.

Die Oberfläche skaliert für Desktop-DPI unabhängig von der Pixelart-Zeichenfläche. Das gesamte Studio wird nicht einfach wie ein niedrig aufgelöstes Spiel hochgezogen. Rasteransicht und 1:1-Vorschau verwenden kontrollierte ganzzahlige Pixelvergrößerung.

Das Theme soll ruhig, kontrastreich und werkzeugorientiert sein. Status braucht immer Text oder Form zusätzlich zur Farbe. Unvollständige und nicht verfügbare Aktionen erklären ihren Grund.

#### 20.2 Tastatur und Maus

Wichtige Aktionen funktionieren ohne Rechtsklick. Tab-Reihenfolge, sichtbarer Fokus, Esc zum Schließen eines Dialogs und Enter zum Bestätigen sind konsistent.

Vorgesehene Kürzel sind Strg/Cmd+S zum Speichern, Strg/Cmd+Z für Undo, eine plattformpassende Redo-Kombination, Leertaste für Wiedergabe und Links/Rechts für Frame-Schritte außerhalb von Texteingaben. Mittlere Maustaste verschiebt die Zeichenfläche; Strg/Cmd+Mausrad verändert den Zoom. Ein aktives Textfeld fängt seine eigenen Tasten ab, statt versehentlich die Timeline zu verändern.

#### 20.3 Messbare, noch nicht nachgewiesene Ziele

| Bereich | Abnahmeziel |
|---|---|
| Interaktive Vorschau | Ein 128 × 128-px-NPC mit den 16 Grundslots und mehreren Equipmentteilen lässt sich bei 60 UI-Bildern/s bedienen; Clip-Wiedergabe unabhängig davon typischerweise 8–24 FPS. |
| Kartenübersichten | Große Listen werden virtualisiert oder gestaffelt geladen; nicht alle Vorschauen laufen gleichzeitig. |
| Arbeitsspeicher | Ein begrenzter Preview-/Bildcache, anfänglich 256 MiB Budget, statt unbegrenztem Vorhalten aller NPC-Frames. |
| Reaktionsfähigkeit | Import und Export lassen Fortschritt und Abbruch zu; lange Arbeit wird in kontrollierte Jobs oder Teilstücke zerlegt. |
| Öffnen | Ein dokumentierter Test-Vault mit 100 Projekteinträgen und 1000 Asset-Metadaten soll auf dem definierten Referenzgerät zügig öffnen; Messwert und Gerät werden protokolliert. |
| Wiederholung | Gleiche effektive Quellen ergeben gleiche RGBA-Frames in den geprüften Umgebungen. |
| Offline | Kernworkflow ohne Netzwerkverbindung durchführbar. |

Hardwareabhängige Ziele werden in der Implementierung gemessen. Sie sind weder Schätzungen einer Entwicklungsdauer noch bereits erzielte Ergebnisse.

### 21. Tests und Abnahmeszenarien

#### 21.1 Testebenen

Fachtests prüfen IDs, Verträge, Referenzen, Zustände, Rundung, Sampling, Spiegelungen und Export-Fingerabdrücke. Dateisystemtests verwenden ausschließlich temporäre Test-Vaults. UI-Tests und manuelle Desktop-Checks ergänzen die fachlichen Prüfungen. Goldens vergleichen kleine, bekannte RGBA-Bilder. Native Smoke-Tests prüfen Start, Dateidialog und einen minimalen Workflow auf jeder zugesicherten Desktop-Plattform.

Neue Testpakete werden nur begründet übernommen. Die vorhandene Testinfrastruktur bleibt Ausgangspunkt. „Nicht ausgeführt“ wird als solcher Status dokumentiert, niemals als bestanden.

#### 21.2 Verbindliche Ende-zu-Ende-Abnahmen

**A — Projekt und Organisation:** Ein leerer Vault wird initialisiert. Zwei Projekte erhalten eigene Labels. Alle strukturierten Filter sind Dropdowns. Filterkombinationen funktionieren und überleben einen Ansichtswechsel. Ein Label lässt sich entfernen, ohne Inhalte zu löschen.

**B — Bereich und Profil:** Ein NPC-Bereich mit 80-px-Profil wird angelegt. Er enthält 16 standardisierte Slots einschließlich optionaler Haare, aber keine Augenebene. Eine andere Größe ergibt ein nachvollziehbares neues Profil. Bestehende Bewegungen werden nicht still umskaliert.

**C — Dummy und Timeline:** Aus wenigen Keyframes entsteht ein vollständiger Loop. Eine Änderung, Undo und Redo erzeugen die erwarteten Posen. Abspielen und Export-Sampling stimmen bei jedem Index überein. Eine Schleife enthält kein unbeabsichtigtes doppeltes Abschlussbild.

**D — Acht Richtungen:** Fünf explizite Ansichten und drei erlaubte Ableitungen liefern acht Richtungen. Eine asymmetrische Ausstattung bleibt anatomisch korrekt oder wird als nicht spiegelbar gemeldet. Fehlende Richtungen werden nicht versteckt.

**E — Klickverhalten:** Eine neue Karte öffnet den Dummy-Editor. Nach Freigabe öffnet sie den Ausstattungsfluss. Dummy-Editor bleibt per Icon und Kontextmenü erreichbar. Ein neuer Entwurf zerstört eine alte freigegebene Revision nicht.

**F — Inventar und Anziehen:** Ein Paket lässt sich importieren, korrekt vorkonfigurieren und feinjustieren. Ein fehlerhafter Ausschnitt wird abgewiesen. Ein Handschuh ohne Eigenbewegung folgt seiner Hand. Ausgeschaltetes Equipment erscheint weder in Vorschau noch Export.

**G — NPC-Sammlung:** Derselbe Dorfbewohner bekommt Gehen, Sprinten und Springen. Alle drei erscheinen unter seiner einen NPC-ID und in seinem Ordner. Ein zweiter NPC verwendet dieselbe Laufvorlage mit anderen Sprites, ohne eine vollständige Kopie der Vorlage zu benötigen.

**H — Änderungen:** Eine Vorlagenrevision kann übernommen oder beibehalten werden. Eine gemeinsame Fitting-Änderung aktualisiert betroffene Zuordnungen. Ein lokaler Override bleibt lokal. Der Exportstatus reagiert auf tatsächlich verwendete Quellen.

**I — Ausgabe:** PNG-Sheets und JSON enthalten korrekte Rechtecke, Zeitangaben und Bodenanker. Einzelbilder sind nur bei Auswahl vorhanden. Der frische Godot-Import lädt sämtliche vorgesehenen Aktionen und Richtungen, auch nach Verschieben des Pakets.

**J — Robustheit und Portabilität:** Speicherfehler, fehlendes Schreibrecht, abgebrochener Export, zweite App-Instanz und simulierte Unterbrechungen von Dateitransaktionen beschädigen den letzten gültigen Zustand nicht. Eine kopierte Vault lässt sich ohne die ursprünglichen Maschinenpfade öffnen.

#### 21.3 Zusätzliche Negativtests

Unbekannte Schema-Version, ungültiges JSON, doppelte IDs, zyklische Elternbeziehung, zyklische Spiegelung, Null-FPS, leere Framefolge, übergroßes PNG, außerhalb liegendes Atlasrechteck, fehlender Asset-Hash, ungültiger Ressourcenname, Unicode-/Großschreibungs-Kollision, `../`-Pfad und externe symbolische Verknüpfung.

Die Abwesenheit unerwünschter Architektur wird ebenfalls geprüft: kein SQL-Backend, keine notwendige Bone-/Skeleton-Komponente, keine mobile/webbasierte Studio-Ausgabe und keine Laufzeit-Pflicht zu einem Python-Prozess.

### 22. Lieferumfang, Meilensteine und Risiken

#### 22.1 Vollständige erste Version

Zur ersten vollständigen Version gehören Arbeitsordner, Projekt-/Bereichsverwaltung, Labels und Dropdown-Filter, humanoide Profile, Dummy-Editor, Timeline, acht Richtungen, Startbewegungen, Inventar, Ausstattung, Feinschliff, Equipmentoptionen, NPC-Sammlung, Revisionen, PNG-/JSON-Ausgabe, Godot-Paket, Autosave, Undo/Redo, Recovery und geprüfte Desktop-Builds.

Ein frühes Inkrement darf nur eine Richtung und eine Bewegung enthalten, um die Pipeline zu beweisen. Es wird dann als Inkrement gekennzeichnet und nicht als Erfüllung der Acht-Richtungs-Anforderung ausgegeben.

#### 22.2 Reihenfolge ohne Zeitversprechen

| Meilenstein | Phasen | Beobachtbares Ergebnis |
|---|---|---|
| A — Grundlage | P00–P06 | Repository angepasst, Desktop-Shell, Datenverträge, Vault, Dashboards, Bereiche, Animationskarten. |
| B — Bewegungen | P07–P11 | Gemeinsamer Rasterer, Dummy, Timeline, acht Richtungen und editierbare Bewegungspresets. |
| C — Figuren | P12–P15 | Inventar, Anziehen, Feinschliff, Equipment und NPCs mit mehreren Bewegungen. |
| D — Spieleinbindung | P16–P17 | Portabler PNG-/JSON-Export und validiertes Godot-Paket. |
| E — belastbare Version | P18–P22 | Recovery-Härtung, Desktop-Qualität, native Builds, Anleitung, vollständige Abnahme. |

#### 22.3 Bewusst spätere Funktionen

Andere Körperformen und Bäume, getrennte Augen-/Gesichtsebenen, vollständiger Pixel-Painter, automatische Generierung neuer Perspektiven, 3D-Rendering als Quelle, KI-Generierung, komplexe Stoffsimulation, Mehrbenutzer-Synchronisation, Marktplatz, Plugin-Ausführung aus Nutzerpaketen und direkte Anbindung an weitere Game-Engines gehören nicht in den ersten Pflichtumfang.

Die Profil- und Export-Schnittstellen werden erweiterbar gehalten. Es werden jedoch keine leeren, großflächigen Frameworks für noch unbestimmte Erweiterungen gebaut.

#### 22.4 Wichtigste Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Cutout wirkt bei starker Drehung nicht wie sauberes handgezeichnetes Pixelart. | Früh mit echten 80-px-Beispielen testen; Winkelraster und Sprite-Varianten vorsehen. |
| Ein Bild liefert nicht alle Ansichten. | Richtungsassets explizit verlangen; Spiegeln nur mit klaren Regeln. |
| Dummy-Verfahren wird doch zu aufwendigem Rigging. | Profile mit fertigen Befestigungen; kein separater Bone-Setup-Schritt; direkte Bedienung testen. |
| Große Rüstungsbilder lassen sich nicht passend biegen. | Segmentierte starre Ausrüstungspakete; keine versteckte Mesh-Erwartung. |
| Bewegung und NPC-Aussehen werden untrennbar vermischt. | Vorlagen, Appearance und Binding als getrennte Datenobjekte. |
| Dateien werden bei Absturz beschädigt. | Temporäre Dateien, Revisionen, Journal, Backups und Fehler-Injektionstests. |
| Preview und Export unterscheiden sich. | Gemeinsamer Sampler und Referenz-Rasterer; RGBA-Goldens. |
| Rasterer ist zu langsam. | Kleine Fixtures früh messen, Caches und Fast Paths; Beschleunigung nur nach Profiling. |
| Template-Umstellung zerstört bestehendes Tooling. | Bestandsprüfung, kleine Änderungen, vorhandene Gates nicht entfernen. |
| Godot-Paket funktioniert nur auf dem Entwicklerrechner. | Importtest im frischen Projekt ohne alte Caches und mit anderem Zielpfad. |

### 23. Rückverfolgbarkeit der Anforderungen

| ID | Anforderung | Primäre Phasen |
|---|---|---|
| RQ-01 | Fokus auf Pixelart-RPG-Animation. | P00, P07–P11 |
| RQ-02 | Desktop-App, keine Mobile-/Web-Optimierung. | P01, P20 |
| RQ-03 | Projekt-Dashboard als Startseite nach Vault-Öffnung. | P03, P04 |
| RQ-04 | Projekte anlegen und als Ordner speichern. | P03, P04 |
| RQ-05 | Eigene Labels erstellen und zuordnen. | P04 |
| RQ-06 | Sämtliche strukturierten Filter als Dropdowns. | P04–P06, P12, P15, P19 |
| RQ-07 | Selbst definierte Bereiche wie NPCs. | P05 |
| RQ-08 | Größe und Körperprofil auf Bereichsebene. | P02, P05 |
| RQ-09 | Animationen als anklickbare Karten. | P06 |
| RQ-10 | Kleine tatsächliche Bewegungsvorschauen. | P06, P11 |
| RQ-11 | Neue Animation öffnet den Dummy-Editor. | P06, P08 |
| RQ-12 | Freigegebene Animation öffnet die Ausstattung. | P06, P13 |
| RQ-13 | Dummy jederzeit per Icon und Rechtsklick öffnen. | P06, P08 |
| RQ-14 | Raster und vordefinierte Körpergrößen. | P05, P07, P08 |
| RQ-15 | Dreiteilige Arme und Beine, zweiteiliger Rumpf. | P05, P08 |
| RQ-16 | Kopf plus Haare, zunächst ohne Augen. | P05, P08, P13 |
| RQ-17 | Deutlich erkennbare Dummy-Teile und Bedienpunkte. | P08, P19 |
| RQ-18 | Framezahl, FPS und Framefläche an der Animation. | P06, P09 |
| RQ-19 | Wenige Keyframes statt jedes Bild selbst zeichnen. | P09, P11 |
| RQ-20 | Acht Richtungen mit kontrollierter Wiederverwendung. | P10 |
| RQ-21 | Gehen, Sprint, Sprung und weitere Bewegungen. | P11 |
| RQ-22 | Inventar für alle benötigten Teil-Sprites. | P12 |
| RQ-23 | Automatische Vorkonfiguration nach Slot-Metadaten. | P12, P13 |
| RQ-24 | Tabs Inventar, Anziehen und Feinschliff. | P13 |
| RQ-25 | Schwache Dummy-Umrandung als Platzierungshilfe. | P13 |
| RQ-26 | Rüstung, Accessoires und zusätzliches Equipment. | P14 |
| RQ-27 | Equipment ein/aus und mit/ohne Eigenbewegung. | P14 |
| RQ-28 | Bewegungs- und Platzierungsfehler unterscheidbar. | P13, P15 |
| RQ-29 | Laufende Vorschau und einzelne Frames prüfen. | P09, P13 |
| RQ-30 | Angekleideten NPC benennen und labeln. | P13, P15 |
| RQ-31 | Mehrere Bewegungen unter demselben NPC sammeln. | P15 |
| RQ-32 | Wechsel zwischen Animationen- und NPC-Übersicht. | P06, P15 |
| RQ-33 | Lokaler Arbeitsordner/Vault. | P03 |
| RQ-34 | `.pixelforge-studio` enthält nur globale Daten. | P02, P03, P18 |
| RQ-35 | Kein SQL, insbesondere kein SQLite. | P02, P03, P22 |
| RQ-36 | Projekt/Bereich/NPC/Animation auf dem Datenträger. | P03, P15, P16 |
| RQ-37 | Kompakte PNG-Sheets, Einzelbilder optional. | P16 |
| RQ-38 | Einbindung in Code und Godot-Ausgabe. | P16, P17 |
| RQ-39 | Kein notwendiges manuelles Bone-/Skelett-Rigging. | P05, P08, P22 |
| RQ-40 | Vollständige Planung plus abarbeitbare Phasenprompts. | Planungsdokument, P00–P22 |

### 24. Umsetzung mit den Phasenprompts

Die Begleitdateien enthalten **23 aufeinander aufbauende Phasen P00 bis P22**, einen übergeordneten Arbeitsauftrag und einen Fortsetzungsauftrag. Jede Phase nennt Abhängigkeiten, konkreten Auftrag, erwartete Dateien/Ergebnisse und ein überprüfbares Gate.

Die Reihenfolge ist verbindlich, sofern ein dokumentierter Grund keine Abhängigkeiten verletzt. Tests werden in jeder Phase geschrieben; P19 und P22 sind zusätzliche umfassende Prüfungen, kein Ersatz für frühere Tests.

Jede Phase aktualisiert den lebenden Plan unter `docs/developer/plans/pixelcutoutsprite-execplan.md` gemäß dem vorhandenen `.agent/PLANS.md`-Standard. Der Status enthält tatsächlich erledigte Arbeit, ausgeführte Prüfungen und offene Punkte. Ein Kontrollkästchen ist erst erledigt, wenn das Gate nachweisbar bestanden ist oder ausdrücklich als durch den Nutzer abgenommene Ausnahme dokumentiert wurde.

Ein Coding-Agent darf mehrere Phasen in einer Sitzung nacheinander ausführen. Er überspringt dabei keine Gates und behauptet nicht, später im Hintergrund weiterzuarbeiten. Wenn der Arbeitskontext endet, hinterlässt er den exakten nächsten Schritt. Ein technischer Blocker wird beschrieben, ohne durch gelöschte Tests oder eine andere unerwünschte Architektur kaschiert zu werden.

### 25. Quellen und Recherchegrenzen

#### Repository-Quellen

Die Dateien wurden am 5. September 2026 über die GitHub-Verbindung gelesen. Der Stand war nicht Gegenstand eines vollständigen Code-, Sicherheits- oder Laufzeitaudits. Vor der Implementierung sind weitere komponentenbezogene Regeln und Tests zu lesen.

- **R1:** `README.md` — vorhandenes Godot-Template, Befehle, Tooling und Exportabläufe. https://github.com/kleiveist/PixelCutoutSprite/blob/main/README.md
- **R2:** `AGENTS.md` — Repository-Regeln und Prüfpflichten. https://github.com/kleiveist/PixelCutoutSprite/blob/main/AGENTS.md
- **R3:** `.agent/PLANS.md` — Standard für lebende ExecPlans. https://github.com/kleiveist/PixelCutoutSprite/blob/main/.agent/PLANS.md
- **R4:** `config/toolchain.toml` — Godot-/Python-Vorgaben und Abhängigkeiten. https://github.com/kleiveist/PixelCutoutSprite/blob/main/config/toolchain.toml
- **R5:** `game/project.godot` — existierender Projekteinstieg und Desktop-/Renderer-Konfiguration. https://github.com/kleiveist/PixelCutoutSprite/blob/main/game/project.godot

#### Offizielle technische Quellen

Alle Quellen wurden am 5. September 2026 geprüft. Eigene Produktentscheidungen wie Slotgrößen, Ordnernamen und Cachebudgets sind Vorschläge dieses Plans, keine Aussagen der jeweiligen Dokumentation.

- **S1:** Godot 4.7.2, offizielles Archiv. https://godotengine.org/download/archive/4.7.2-stable/
- **S2:** Godot `Control`, GUI-Grundlage. https://docs.godotengine.org/en/stable/classes/class_control.html
- **S3:** Godot `FileAccess`. https://docs.godotengine.org/en/stable/classes/class_fileaccess.html
- **S4:** Godot `DirAccess`. https://docs.godotengine.org/en/4.7/classes/class_diraccess.html
- **S5:** Godot `JSON`. https://docs.godotengine.org/en/stable/classes/class_json.html
- **S6:** Godot `FileDialog`. https://docs.godotengine.org/en/stable/classes/class_filedialog.html
- **S7:** Godot `Image`. https://docs.godotengine.org/en/4.7/classes/class_image.html
- **S8:** GitHub, Arbeiten in einem Codespace. https://docs.github.com/en/codespaces/developing-in-a-codespace/developing-in-a-codespace
- **S9:** GitHub, Portweiterleitung. https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace
- **S10:** Godot `CanvasItem`, Texturfilter. https://docs.godotengine.org/en/stable/classes/class_canvasitem.html
- **S11:** Godot `SpriteFrames`. https://docs.godotengine.org/en/4.7/classes/class_spriteframes.html
- **S12:** Godot `AtlasTexture`. https://docs.godotengine.org/en/stable/classes/class_atlastexture.html
- **S13:** Godot, 2D-Sprite-Animation. https://docs.godotengine.org/en/stable/tutorials/2d/2d_sprite_animation.html
- **S14:** Godot-Textformat, externe Ressourcen und relative Pfade; ältere offizielle Referenz, gegen 4.7.2 durch Integrationstest abzusichern. https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html
- **S15:** Godot, externe und eingebettete Ressourcen. https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html
- **S16:** Godot, Exportvorlagen und Projekt-Export. https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html

**Ergebnis dieser Arbeit:** Spezifikation und Umsetzungsprompts. Es wurde in diesem Auftrag keine Studio-Anwendung implementiert, kein nativer Studio-Build getestet und keine Änderung in das Repository geschrieben.

---

# Teil II — Vollständiger Prompt-Phasen-Verlauf

## PixelCutoutSprite Studio — vollständiger Prompt-Phasen-Verlauf

**Stand:** 5. September 2026 · **Umfang:** 23 Implementierungsphasen, Masterauftrag und Fortsetzungsauftrag.

Die Einzeldateien im Dokumentationspaket sind für die Ablage im Repository vorbereitet. Dieser Sammeltext enthält dieselben Aufträge vollständig. Keine Phase ist allein durch diese Planung implementiert.

## Übergeordneter Arbeitsauftrag — PixelCutoutSprite Studio

Diesen Auftrag zu Beginn einer Implementierungssitzung verwenden. Danach die gewünschte Phase P00–P22 anhängen oder den Serienmodus unten wählen.

```text
Arbeite im vorhandenen Repository kleiveist/PixelCutoutSprite an der Desktop-App
PixelCutoutSprite Studio.

Lies zuerst AGENTS.md, .agent/PLANS.md, docs/index.md und die für die Aufgabe
gültigen Python-/GDScript-Regeln. Lies danach vollständig:
- docs/developer/features/pixelcutoutsprite-studio.md
- docs/developer/plans/pixelcutoutsprite-execplan.md
- den beauftragten Phasenprompt unter docs/developer/prompts/pixelcutoutsprite/

Behandle die Spezifikation als fachlichen Auftrag. Das vorhandene Godot-Template
und das Python-Tooling sind der Ausgangspunkt. Kein Tauri-/Electron-/Web-Neubau.
Desktop-only. Kein SQL/SQLite. Quellen bleiben JSON + PNG in normalen Ordnern.
Keine notwendige manuelle Bone-/Skelett-Einrichtung. Trenne Bewegungsvorlagen,
NPC-Aussehen und Animationszuordnungen. Alle strukturierten Filter sind Dropdowns.

Prüfe vor Änderungen den aktuellen Checkout und vorhandene Nutzeränderungen.
Lösche oder überschreibe keine fremde Arbeit. Lies vorhandene Klassen und Tests,
bevor du Ersatz baust. Neue Abhängigkeiten, Schemaänderungen und Abweichungen
brauchen einen begründeten Eintrag mit Folgen und Alternative. Beachte die
vorhandene Installationspolitik; keine ungeprüften Download-/Installationsskripte.

Implementiere die beauftragte Phase wirklich einschließlich Datenhaltung,
Fehlerfällen und Tests. Reine Mock-Oberflächen gelten nicht als fertige Funktion.
Ändere keine Tests bloß, um Fehler zu verstecken. Zuerst fokussierte Prüfungen,
danach die verfügbaren übergreifenden Repository-Gates. Berichte nur tatsächlich
ausgeführte Tests als ausgeführt und nur bestandene Tests als bestanden.

Aktualisiere während der Arbeit den ExecPlan mit Fortschritt, Entscheidungen,
Beobachtungen, Validierung und Wiederaufnahmeinformationen. Phasengates müssen
nachvollziehbar erfüllt sein. Keine automatische Veröffentlichung, keine
unbeauftragten Pushes und keine destruktiven Git-Befehle.

Abschlussformat:
1. Tatsächlich implementierte Ergebnisse und relevante Dateien.
2. Ausgeführte Prüfungen mit Ergebnis; nicht ausgeführte Prüfungen getrennt.
3. Offene Fehler, Einschränkungen oder Blocker.
4. Exakter nächster Schritt und aktualisierter Phasenstatus.
```

### Serienmodus: mehrere oder alle Phasen

```text
Führe die noch nicht abgeschlossenen Phasen P00 bis P22 nacheinander aus.
Beginne bei der ersten Phase, deren Abhängigkeiten erfüllt und deren Gate noch
nicht bestanden ist. Lies ihren vollständigen Prompt und arbeite ihn ab.
Gehe nur bei bestandenem Gate zur nächsten Phase weiter. Belege erhaltene
Funktionen und Tests, statt sie ungeprüft als bereits erledigt anzunehmen.

Sind mehrere Phasen in dieser Sitzung möglich, arbeite in dieser Reihenfolge
weiter. Endet die verfügbare Sitzung oder blockiert ein reales technisches
Problem, hinterlasse den genauen Zustand und den nächsten ausführbaren Schritt
im ExecPlan. Behaupte nicht, später selbstständig im Hintergrund weiterzuarbeiten.
Überspringe keine Abnahme und markiere keine noch offenen Plattformtests als grün.
```

### Verwendung

Die Einzelphasen sind bewusst aufeinander aufgebaut. Für einen kontrollierten Start werden der übergeordnete Auftrag und P00 verwendet. Ein späterer Auftrag kombiniert den gleichen Rahmen mit der nächsten offenen Phase. Im Serienmodus bleiben die einzelnen Gates genauso verbindlich wie bei separater Ausführung.


---

## Fortsetzungsauftrag — PixelCutoutSprite Studio

```text
Setze die Arbeit an PixelCutoutSprite Studio im vorhandenen Repository fort.

Lies AGENTS.md, .agent/PLANS.md, die vollständige Studio-Spezifikation und den
aktuellen ExecPlan. Prüfe Arbeitsbaum, letzte Änderungen und Testprotokolle.
Verlasse dich nicht allein auf eine frühere Chat-Zusammenfassung.

Ermittle die erste noch nicht belegbar abgeschlossene Phase. Lies ihren Prompt
und den MASTERPROMPT. Prüfe ihre Abhängigkeiten im tatsächlichen Code. Setze am
im ExecPlan beschriebenen nächsten Schritt an. Bewahre bestehende Nutzerarbeit.

Wiederhole relevante Tests nach Änderungen. Aktualisiere Fortschritt,
Entscheidungen, Validierung und offene Punkte. Überspringe keine fehlenden
Funktionen durch Demo-Daten oder entfernte Tests. Berichte am Ende den realen
Funktionsstand, die ausgeführten Prüfungen und den exakten nächsten Schritt.
Kein automatischer Push oder Release.
```


---

## P00 — Bestand prüfen und Umsetzung verankern

**Abhängigkeiten:** Keine; diese Phase beginnt die Implementierung.
**Spezifikation:** Kapitel 1–3, 18, 22–25
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Prüfe den tatsächlichen Checkout, Branch und Arbeitsbaum. Lies AGENTS.md, .agent/PLANS.md, docs/index.md, die relevanten Python-/GDScript-Regeln, config/project.toml, config/toolchain.toml, game/project.godot, Bootstrap, Routing, Tests und CI. Verlasse dich nicht darauf, dass der in der Spezifikation genannte Commit weiterhin aktuell ist.

Erstelle einen Bestandsbericht: Welche Teile sind allgemeines Tooling, welche Spiel-Demo und welche bereits für das Studio brauchbar? Erfasse Desktop-/Touch-/Web-Annahmen, Dokumentationsgeneratoren und Branding. Ordne jede Abweichung dieser Spezifikation zu, ohne unbesehen große Verzeichnisse zu löschen.

Verankere die Spezifikation und den lebenden ExecPlan in der vorhandenen Dokumentation. Halte die Entscheidung „Godot-Desktop, GDScript, vorhandenes Python-Tooling“ fest. Prüfe die konfigurierte Godot-Version anhand offizieller Herkunft, bevor Installationsautomation geändert wird. Führe verfügbare bestehende Basisprüfungen aus; ein fehlendes Werkzeug wird als Blocker dokumentiert, nicht als bestandener Test.

Ergänze einen kurzen Architekturentscheid zur Trennung von Bewegungsvorlage, NPC-Aussehen und Animationszuordnung. Erstelle die Anforderungsübersicht RQ-01 bis RQ-40 als Prüfgrundlage. Implementiere in dieser Phase noch keine umfangreiche Editorfunktion.

### Gate dieser Phase

Bestandsbericht und aktuelle Ausgangsrevision sind dokumentiert. Alle 23 Phasen stehen im ExecPlan. Vorhandene Änderungen des Nutzers bleiben erhalten. Ausgeführte und nicht ausgeführte Basistests sind unterscheidbar. Es gibt keinen unbegründeten Framework-Wechsel.

### Erwartetes Ergebnis

Aktualisierte Planungsdokumentation, Bestandsbericht unter docs/developer/, Architekturentscheid und nachvollziehbares Basisprüfprotokoll.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P00 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P01 — Desktop-Shell und Produktidentität

**Abhängigkeiten:** P00
**Spezifikation:** Kapitel 2, 5, 18, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Wandle den bestehenden App-Einstieg kontrolliert in die Desktop-Shell von PixelCutoutSprite Studio um. Verwende Godot-Control-/Container-Layouts, nicht einen zusätzlichen Web-Stack. Implementiere Kopfzeile, Breadcrumb-Bereich, Hauptinhalt, Statusleiste, Dialog-Layer und eine saubere Navigationsschnittstelle. Nicht implementierte Zielseiten bleiben ausdrücklich gekennzeichnete Platzhalter.

Passe Produktname, zentrale Metadaten und betroffene Template-Verweise an. Erhalte den führenden Einstieg python tools/control.py und bestehende grundlegende Prüfverträge. Entferne mobile oder Web-Produktausgaben nur nach Prüfung ihrer Abhängigkeiten. Keine neue Touch-Optimierung und kein Webexport für eine Codespaces-Vorschau.

Richte das Desktop-Theme, skalierbare Bedienelemente, Fokuszustände und das Mindestlayout ein. Trenne UI-DPI von der späteren Pixel-Zeichenfläche. Definiere die Eingabeaktionen für Speichern, Undo/Redo, Dialogsteuerung und Wiedergabe; Textfelder dürfen keine Editoraktionen versehentlich auslösen.

Ergänze einen Shell-Test und passe den Bootstrap-Integrationstest an die neue Produktionsszene an, ohne ihn durch einen speziellen Testmodus zu umgehen.

### Gate dieser Phase

Die native Anwendung startet in der verfügbaren Desktop-Umgebung. Shell, Navigation und Dialoge funktionieren bei 1440×900 und 1280×720. Headless-Bootstrap-Prüfung besteht. Verbleibende Zielplattformprüfungen sind sichtbar offen; es wird kein getesteter Mehrplattformstatus erfunden.

### Erwartetes Ergebnis

Produktions-Shell, Theme, Navigationsvertrag, aktualisierte Produktkonfiguration und passende Bootstrap-/UI-Basistests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P01 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P02 — Fachmodelle und JSON-Verträge

**Abhängigkeiten:** P00–P01
**Spezifikation:** Kapitel 3, 6, 12–15, 18
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere typisierte Fachmodelle für Vault, Projekt, Bereich, Profilrevision, Bewegungsvorlage, Vorlagenrevision, Assetrevision, Outfit-Entwurf, NPC, Aussehen, Animationszuordnung und Exportmanifest. Die Hierarchie und Referenzen müssen der Spezifikation entsprechen.

Definiere versionierte JSON-Verträge und produktive Validierungsfunktionen. JSON-Schemas dürfen die Verträge dokumentieren; baue keinen umfangreichen eigenen Schema-Interpreter, wenn gezielte Validatoren genügen. IDs sind stabile UUID-Strings, keine Namen oder Zahlen. Unterscheide Schema-Version, Objekt-Revision und unveränderliche freigegebene Revision.

Lege Dateikonventionen, relative Pfadauflösung und reservierte Verwaltungsordner fest. Formuliere Statusübergänge für Entwurf, Freigabe, Ausstattung, NPC-Zuordnung und Export-Aktualität. Eine Vorlage kann mehrere NPCs bedienen. Profile, Vorlagen und Aussehen bleiben getrennt.

Erzeuge vollständige minimale gültige Testdokumente und absichtlich ungültige Gegenbeispiele. Die erklärenden JSON-Ausschnitte der Spezifikation sind keine fertigen Fixtures. Implementiere Referenzprüfung, azyklische Eltern- und Spiegelbeziehungen sowie sinnvolle Zahlenlimits. Unbekannte zukünftige Datenversionen dürfen nicht überschrieben werden.

Führe weder SQL/SQLite noch eine alternative versteckte Datenbank ein. Exportressourcen wie .tres sind kein autoritatives Quellformat.

### Gate dieser Phase

Alle dokumentierten Typen lassen sich aus gültigen JSON-Fixtures lesen und konsistent zurückschreiben. Ungültige Typen, fehlende Referenzen, doppelte IDs, Zyklen und unbekannte Versionen erzeugen klare Fehler. Tests belegen die getrennten Identitäten von Vorlage, Aussehen und Zuordnung.

### Erwartetes Ergebnis

Fachmodelle, Validatoren, Formatdokumentation beziehungsweise Schemas und gültige/ungültige Fixtures unter game/tests/studio/.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P02 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P03 — Vault und sichere Dateispeicherung

**Abhängigkeiten:** P02
**Spezifikation:** Kapitel 13, 14, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die native Auswahl, Initialisierung und Wiederöffnung eines Arbeitsordners. Ein leerer Ordner darf angelegt werden; ein nicht leerer fremder Ordner verlangt eine transparente Initialisierung ohne Überschreiben seiner Dateien. Ein beschädigter Vault ist kein leerer Vault.

Setze die vereinbarte Struktur um: globale Daten ausschließlich in .pixelforge-studio, projektbezogene Metadaten unter .project, Bereichsquellen unter .area und später NPC/Animationen in normalen Unterordnern. Gerätebezogene letzte Pfade dürfen separat gespeichert werden, nicht jedoch Projektquellen.

Implementiere JsonStore, Pfad-Resolver, ID-Index, einfache Schreibsperre pro Vault und eine Transaktionsgrundlage. Einzeldateien werden temporär geschrieben und vor Austausch validiert. Mehrteilige Vorgänge erhalten ein wiederherstellbares JSON-Journal. Bereite Dirty-State und Autosave-Schnittstellen vor. Behaupte keine unbelegte plattformübergreifende Atomarität.

Validiere Pfade am Dateisystem, behandle symbolische Links vorsichtig und verhindere Pfadausbruch. Verwende ausschließlich temporäre Testordner für Tests. Öffnen ohne Schreibrecht muss erklärt werden, nicht durch stilles Speichern an einem anderen Ort kaschiert werden.

### Gate dieser Phase

Neu anlegen, schließen und wieder öffnen funktioniert. Nicht leere Fremdordner bleiben unverändert bis zur ausdrücklichen Initialisierung. Ein zweiter Schreiber wird abgefangen. Simulierte Schreibfehler erhalten die letzte gültige Datei. Keine fachlichen Projektquellen landen im globalen Metadatenordner.

### Erwartetes Ergebnis

VaultService, JsonStore, Pfad-/ID-Auflösung, Transaktionsbasis, Lock-Behandlung und Dateisystem-Integrationstests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P03 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P04 — Projekt-Dashboard, Labels und Dropdown-Filter

**Abhängigkeiten:** P03
**Spezifikation:** Kapitel 4, 5, 13, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere das Projekt-Dashboard als Startansicht nach dem Öffnen eines Vaults. Projektkarten zeigen Name, Labels, Status und sinnvolle Änderungsinformation. Erstellen legt gleichzeitig den Projektordner an. Öffnen, Umbenennen, Duplizieren, Archivieren und kontrolliertes Entfernen laufen über Anwendungsdienste.

Implementiere Workspace-Labels für Projekte sowie die Grundlage projektinterner Labels. Unterstütze Name, Farbe, Umbenennen und Entfernen. Label-Löschung darf keine Inhalte löschen. Prüfe alle Referenzen und Namenskollisionen.

Baue eine wiederverwendbare Dropdown-Filterkomponente für Einzel- und Mehrfachauswahl. Jede strukturierte Bedingung einschließlich Sortierung ist ein Dropdown. Textsuche ist getrennt. Verschiedene Felder verknüpfen sich mit UND; die Label-Auswahl unterstützt „mindestens eines“ und „alle“. Leere Auswahl schränkt nicht ein. Sichtbare Tags sind kein Ersatz für das Dropdown.

Speichere Ansichts- und Filterzustand im richtigen Scope. Ergänze Leerzustände, Fehlermeldungen, Tastaturfokus und eine Reset-Aktion. Bearbeitungen dürfen keine direkte, ungeprüfte Dateioperation aus einer Kartenklasse ausführen.

### Gate dieser Phase

Zwei Projekte mit verschiedenen Labels lassen sich anlegen, filtern, öffnen und nach Neustart wiederfinden. Umbenennen erhält IDs. Projektkopie hat neue Identität. Keine Filterbedingung ist nur über Chip, Freitext oder versteckte Checkbox erreichbar. Labelentfernung lässt Projekte bestehen.

### Erwartetes Ergebnis

Projekt-Dashboard, Label-Verwaltung, gemeinsame Dropdown-Komponenten und Tests für CRUD, Referenzen und Filterlogik.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P04 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P05 — Bereiche und humanoide Körperprofile

**Abhängigkeiten:** P04
**Spezifikation:** Kapitel 5, 6, 9, 14
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere frei benennbare Bereiche innerhalb eines Projekts und deren Kartenübersicht. Ein Bereich erhält Objekttyp, Profilversion, Referenzhöhe, acht Richtungen, Standard-Framefläche, Bodenanker und Labels. Version 1 bietet nur das humanoide NPC-Profil produktiv an; andere Objekttypen werden nicht als fertig dargestellt.

Erstelle das versionierte Standardprofil mit 15 anatomischen Slots plus optionalem Haar-Slot: zwei Rumpfteile, Kopf und je drei Teile pro Arm und Bein. Keine Augenebene und kein vom Nutzer anzulegendes Skelett. Liefere feste Befestigungen, Grundpositionen, Slotflächen, Links-/Rechts-Paarungen und Grundreihenfolgen pro Ansicht.

Setze die 80-px-Referenz und die Größenableitung um. Rundungsreste werden kontrolliert korrigiert; die tatsächliche neutrale Gesamthöhe muss dem gewählten Wert entsprechen. Haare und Equipment dürfen über die anatomische Höhe hinausragen. Die vorgeschlagenen Proportionen sind mit einem einfachen Dummy visuell zu prüfen.

Speichere verwendete Profile als unveränderliche Snapshots. Eine Änderung der Größe erzeugt eine neue Version und verändert vorhandene Bewegungen nicht automatisch. Stelle eine Vorschau der berechneten Slotmaße dar.

### Gate dieser Phase

Ein Bereich „NPCs“ mit 80 px lässt sich erzeugen und erneut öffnen. Slots, Elternbeziehungen und acht Ansichtsdefinitionen sind valide. Die neutrale Höhe ist messbar korrekt. Andere Größen bleiben ganzzahlig. Eine neue Profilversion beschädigt keine alte Referenz.

### Erwartetes Ergebnis

Bereichsverwaltung, Profilgenerator/-loader, erstes humanoides Profil, Größenprüfung und referenzierte Profil-Fixtures.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P05 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P06 — Animationsbibliothek und zustandsabhängige Navigation

**Abhängigkeiten:** P05
**Spezifikation:** Kapitel 4, 5, 8, 12
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere im Bereich den Tab Animationen und die Navigation zum späteren NPC-Tab. Bewegungskarten enthalten Name, Typ, Labels, Status, Richtungsabdeckung und Platz für eine echte Vorschau. Erstellen, Duplizieren, Archivieren und Entfernen arbeiten mit stabilen IDs.

Der Dialog für eine neue Animation erfasst Name, Aktionstyp, Frameanzahl, FPS, Loop sowie Framebreite/-höhe und Bodenanker. Profilhöhe wird geerbt und nicht mit der Framefläche verwechselt. Ergänze sinnvolle Vorbelegung aus dem Bereich und klare Grenzprüfungen.

Implementiere das Klickmodell: neue/ungeprüfte Vorlage öffnet Dummy; freigegebene Vorlage öffnet den Ausstattungsfluss. Dummy bleibt per sichtbarem Icon und Rechtsklick-Menü erreichbar. Gibt es mehrere NPC-Zuordnungen, darf nicht willkürlich eine ausgewählt werden. Eine neue Entwurfsänderung macht die bisherige Freigabe nicht rückwirkend ungeschehen.

Setze Statusübergänge und unveränderliche Freigaberevisionen zunächst anhand vollständiger Test-Fixtures um. Noch nicht vorhandene Editoren bleiben eindeutig als Zwischenstand erkennbar. Ersetze ihre Platzhalter in den folgenden Phasen. Filter einschließlich Richtung, Status, Profil und Sortierung sind Dropdowns.

### Gate dieser Phase

Neue Karte, Freigabe-Fixture, zusätzliche Entwurfsänderung und mehrere NPC-Referenzen führen jeweils zum richtigen Ziel. Duplizieren erzeugt neue Vorlagenidentität. Ungültige Timingwerte werden abgefangen. Kein toter Rechtsklick-only-Zugang.

### Erwartetes Ergebnis

Animationsdashboard, Erstelldialog, Freigabe-/Routinglogik, Kontextaktionen und Navigations-/Status-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P06 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P07 — Gemeinsamer Pixel-Rasterer

**Abhängigkeiten:** P05–P06
**Spezifikation:** Kapitel 7, 9, 11, 16, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den zentralen Rendervertrag unabhängig von der Editoroberfläche: Profil, aufgelöste Pose, Asset-Bilder, Fitting und Ziel-Framefläche ergeben ein RGBA-Bild. Verwende für die Referenz Godot Image und keine UI-Screenshot-Ausgabe.

Baue starre Eltern-/Kind-Transformationen, Richtungsschichten, Sichtbarkeit und kontrolliertes Source-over-Compositing. Definiere die Reihenfolge von Profil, Bewegung, NPC-Anpassung, lokalem Override und Pivot. Runde nicht jede Hierarchiestufe einzeln. Dokumentiere Pixelzentren, Rundung negativer Werte und Randbehandlung.

Implementiere schnelle Wege für unveränderte beziehungsweise ganzzahlig versetzte Teile. Für Drehungen verwende inverses Nearest-Sampling in einer begrenzten Zielregion. Keine Weichzeichnung und keine Mesh-Verformung. Berechne Clipping-Hinweise. Dummy-Bilder können aus kleinen eigenen Testformen erzeugt werden.

Erzeuge Golden-Fixtures für Überdeckung, Drehpunkt, halbtransparente Ebenen, negative Koordinaten, Spiegelung und Abschneiden. Vorschau und Export sollen später denselben Compositor aufrufen. Miss schon jetzt einen 128×128-Beispielframe, ohne aus einer Einzelmessung ein allgemeines Leistungsversprechen abzuleiten.

### Gate dieser Phase

Bekannte Eingaben erzeugen die erwarteten RGBA-Pixel. Wiederholungen sind gleich. Elternbewegung und Fitting kombinieren sich korrekt. Kein unkontrolliertes Antialiasing und kein Export von Editorhilfen. Langsame Stellen sind gemessen und dokumentiert.

### Erwartetes Ergebnis

Rendervertrag, PixelCompositor, Transformations-/Compositing-Helfer, Clipping-Prüfung und Golden-Image-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P07 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P08 — Direkt bedienbarer Dummy-Editor

**Abhängigkeiten:** P07
**Spezifikation:** Kapitel 6, 7, 18, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Ersetze den Dummy-Platzhalter durch den echten Editor. Zeige Raster, Framegrenze, Bodenlinie, neutralen 16-Slot-Dummy und eindeutig erkennbare Griffe. Links stehen Teile und Ebenen, rechts ihre Eigenschaften. Slotnamen, Konturen und Fokus ergänzen Farben.

Implementiere Auswahl, Mehrfachauswahl, Verschieben, Drehen, numerische Eingaben, Sichtbarkeit, Sperren, Rasterfang und ein optionales Winkelraster. Befestigte Teile folgen dem Profil. Es gibt keinen vorherigen Bone-Aufbauschritt und keine notwendigen Skeleton2D-/Bone2D-Komponenten.

Trenne eine Poseänderung von einer Profiländerung. Arbeite über rückgängig machbare Commands; ein Drag ergibt eine Undo-Aktion. Speichern, Dirty-State und Fehleranzeige benutzen die Dienste aus P03. Stelle zunächst eine ausgewählte Pose beziehungsweise einen ausgewählten Keyframe dar; die vollständige Timeline folgt in P09.

Verwende den Referenz-Rasterer für die Dummy-Darstellung. Editorgriffe und Hilfslinien liegen separat darüber. Ergänze Zoom, Pan und eine 1:1-Kontrolle. Behalte Breadcrumb und den klaren Hinweis bei, dass hier eine wiederverwendbare Bewegungsvorlage bearbeitet wird.

### Gate dieser Phase

Alle Körperteile lassen sich ohne Rig-Einrichtung sinnvoll auswählen und bewegen. Untergeordnete Teile bleiben befestigt. Undo/Redo und erneutes Öffnen erhalten die Pose. Hilfen erscheinen nie in einem gerenderten Nutzbild. Textfelder lösen keine ungewollten Editor-Kürzel aus.

### Erwartetes Ergebnis

Dummy-Editor, Transformationswerkzeuge, Inspector, Command-Basis und Interaktions-/Persistenztests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P08 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P09 — Timeline, Keyframes und deterministisches Sampling

**Abhängigkeiten:** P08
**Spezifikation:** Kapitel 7, 8, 14, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die Timeline mit Spuren, Keyframes, Scrubbing, Abspielkopf, Play/Pause, Frame-Schritten, Kopieren/Einfügen, Duplizieren, Bereichsauswahl und klarer Auto-Key-Einstellung. Die Timeline bearbeitet Daten, nicht nur den momentanen UI-Zustand.

Implementiere AnimationSampler als reine Funktion von Daten, Richtung und Sampleindex. Unterstütze Halten, lineare und die freigegebenen Easing-Interpolationen. Sichtbarkeit, Varianten und Schichtwechsel sind diskret. Drehwinkel verwenden einen dokumentierten Interpolationsweg.

Trenne Frameanzahl, FPS, Framefläche und Figurenhöhe. Für N Frames werden genau 0 bis N−1 ausgegeben. Der Loop interpoliert zum gedachten Anfang bei N, ohne ein zusätzliches Abschlussbild zu exportieren. Vorschautempo ändert gespeicherte FPS nicht.

Beim Verlängern oder Verkürzen einer Animation zeige Retiming-/Abschneidefolgen an; belegte Keys verschwinden nicht still. Ergänze die Anzeige benachbarter Posen als Orientierung. Verwende denselben Sampler für Vorschau und spätere Exporte. Halte die UI bei längeren Clips bedienbar.

### Gate dieser Phase

Vier Schlüsselposen erzeugen einen zwölfteiligen Loop mit erwarteter Dauer. Samplewerte sind unabhängig vom vorherigen Abspielverlauf. Ende/Anfang, 0/1/mehrere Keys, Winkelsprung und Retiming sind getestet. Undo/Redo stellt Timeline und Pose wieder her.

### Erwartetes Ergebnis

Timeline, AnimationSampler, Abspielsteuerung, Auto-Key, Retiming-Dialog und Zeit-/Interpolations-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P09 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P10 — Acht Richtungen, Spiegelregeln und Schichten

**Abhängigkeiten:** P09
**Spezifikation:** Kapitel 6, 9, 12, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die acht benannten Richtungen n/ne/e/se/s/sw/w/nw vollständig. Jede Richtung ist explizit, gespiegelt oder fehlend. Der Editor zeigt Herkunft und Abdeckung und erlaubt, eine gespiegelte Richtung als eigenständige Kopie weiterzubearbeiten.

Unterstütze fünf Ausgangsansichten und drei kontrollierte Ableitungen, ohne acht eigenständige Ansichten zu verbieten. Verhindere Spiegelzyklen. Front und Rückseite dürfen nicht aus einer horizontalen Spiegelung verwechselt werden.

Trenne Pose-Spiegelung, Asset-Spiegelung und Gesamtbild-Spiegelung. Die Profilpaarung definiert anatomische Links-/Rechts-Zuordnung. Assets werden für Zielslot und Zielrichtung gewählt; nicht spiegelbares Equipment darf nicht still die Hand wechseln. Fehlende passende Grafik liefert einen sichtbaren Fehler oder einen ausdrücklich bestätigten Fallback.

Verwende richtungsabhängige Grundschichten und diskrete Schichtwechsel. Verdeckte Teile müssen von fehlenden Teilen unterscheidbar sein. Lege eine eigene asymmetrische Fixture mit einseitigem Handschuh oder Accessoire an und prüfe den vollständigen Richtungsumlauf.

### Gate dieser Phase

Alle acht Richtungen werden korrekt ausgewertet. Doppelte Spiegelung stellt den Ausgangszustand wieder her. Anatomische Asymmetrie, Zielschichten und fehlende Quellen sind getestet. Freigabe kann eine unbemerkte Lücke in der geforderten Richtungsabdeckung nicht übergehen.

### Erwartetes Ergebnis

DirectionResolver, Richtungseditor, Spiegel-/Schichtwerkzeuge, Abdeckungsprüfung und Acht-Richtungs-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P10 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P11 — Bewegungspresets und tatsächliche Kartenvorschauen

**Abhängigkeiten:** P10
**Spezifikation:** Kapitel 5, 8, 9, 20
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erstelle editierbare Startvorlagen für Stillstehen, Gehen, Sprinten, Springen und eine neutrale Interaktions-/Angriffsbewegung. Baue sie aus wenigen sichtbaren Posen beziehungsweise erklärten Hilfskanälen auf. Keine versteckte KI-Erzeugung, keine notwendige Skelettbibliothek und keine Behauptung universell fertiger Kunstqualität.

Gehen und Sprinten sollen sich nachvollziehbar in Timing und Pose unterscheiden. Ein besonders schneller Sprint kann als Variante aus derselben Grundlage entstehen. Setze Standard-Fortbewegung auf „auf der Stelle“ und behandle empfohlene Geschwindigkeit nur als Metadatum.

Für Springen trenne Bodenursprung, Körper-Höhenkanal und Schatten. Zeige den Unterschied zwischen gebackener Sprunghöhe und extern gesteuerter Höhe. Hilfskanäle wie Wippen oder Nachschwingen bleiben sichtbar, deterministisch und in normale Keys umwandelbar.

Verbinde die Animationskarten mit tatsächlichen gespeicherten Vorschauen. Spiele nur sichtbare beziehungsweise aktivierte Karten ab; respektiere reduzierte Bewegung. Cache-Invalidierung reagiert auf Änderungen. Ergänze eine erste geführte Vorlagen-Freigabe mit Prüfung aller Richtungen.

### Gate dieser Phase

Jedes Preset lässt sich bearbeiten und freigeben. Acht Richtungen und Timing sind vorhanden. Ein Sprung verschiebt nicht den Bodenanker und clippt nicht unbemerkt. Kartenvorschauen stimmen mit dem Editor überein. Es gibt keinen dauerhaften Voll-Render aller Bibliothekskarten.

### Erwartetes Ergebnis

Mitgelieferte Bewegungsdaten, Hilfskanäle, PreviewCache, echte Kartenvorschauen und erste vollständige Bewegungs-Demo.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P11 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P12 — PNG-Inventar und Paketimport

**Abhängigkeiten:** P11
**Spezifikation:** Kapitel 10, 13, 14, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere das bereichsbezogene Inventar mit PNG-Einzelbildern und regelmäßig gerasterten Sprite-Sheets. Biete Dateidialog und Drag-and-drop an. Kopiere Quellen kontrolliert in die Vault, statt dauerhaft auf externe Downloadpfade zu verweisen.

Definiere und implementiere die JSON-Begleitdatei für Asset-Pakete. Slot, Richtung, Variante, Profil, Ausschnitt, Maße und Pivot müssen vor dem Import geprüft werden. Unterstütze die Dateinamenskonvention nur als sichtbaren Zuordnungsvorschlag. Mehrdeutige Namen bleiben unzugeordnet.

Prüfe Dateigröße, dekodierte Größe, Alpha, Pixelmaße, Ausschnittgrenzen und Pfade. Größenabweichungen erhalten erklärte Optionen; keine stille Skalierung oder automatische Zerlegung eines ganzen NPC-Bildes. Quellbilder bleiben unverändert, abgeleitete Bilder sind Cache.

Ergänze Asset-IDs, Inhalts-Hashes, neue Revisionen und Verwendungsnachweise. Das Entfernen verwendeter Bilder erklärt seine Folgen. Filter für Slot, Richtung, Art, Profil, Labels und Verwendung sind Dropdowns. Erstelle eigene einfache Import-Fixtures und Gegenbeispiele.

### Gate dieser Phase

Ein korrekt beschriebenes Paket wird vollständig und reproduzierbar zugeordnet. Falsche Maße, ungültige Ausschnitte, übergroße Dateien und Pfadausbruch werden abgefangen. Externe Originale bleiben unverändert. Inventar bleibt nach Neustart vollständig verfügbar.

### Erwartetes Ergebnis

AssetRepository, PNG-/Sheet-Importer, Paketvertrag, Inventaroberfläche, Verwendungssuche und Importtests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P12 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P13 — Ausstattungseditor, Feinschliff und NPC-Entwürfe

**Abhängigkeiten:** P12
**Spezifikation:** Kapitel 4, 7, 11, 12
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere die drei sichtbaren Modi Inventar, Anziehen und Feinschliff innerhalb eines zusammenhängenden Editors. Eine freigegebene Bewegung führt hierher. Vorhandenen kompatiblen NPC auswählen oder neuen Outfit-Entwurf beginnen; nicht ungefragt irgendeine bestehende Figur verwenden.

Ordne ein Paket automatisch nach bestätigten Slot-Metadaten zu. Zeige fehlende Teile deutlich. Im Feinschliff sind pro Richtung Bild, Pivot, lokaler Offset, starre Korrekturdrehung und Schichtlage einstellbar. Der Dummy bleibt als regelbare schwache Kontur sichtbar und wird nicht mitexportiert.

Verwende exakt die Transformationsreihenfolge des Compositors. Änderungen werden über Commands und Autosave gespeichert. Ein unbenannter Entwurf liegt unter .area/drafts und bleibt nach Schließen verfügbar. „Als NPC speichern“ erfragt Name und Labels und erzeugt NPC, Standard-Aussehen und erste Animationszuordnung mit stabilen IDs.

Zeige laufende Animation und Frame-Schritte. Stelle den Bearbeitungsumfang sichtbar dar: Vorlage, gemeinsames NPC-Aussehen oder lokale Zuordnung. Biete den Rücksprung zum Dummy für Bewegungsfehler, statt Sprite-Offsets als Ersatz für alle falschen Posen zu missbrauchen.

### Gate dieser Phase

Ein importiertes Paket kann angezogen, feinjustiert und als benannter NPC gespeichert werden. Kontur und Auswahlgriffe bleiben aus der Ausgabe. Entwurfswiederaufnahme, Undo/Redo, lokale Koordinaten und Richtungskorrekturen sind getestet. Die erste NPC-Zuordnung referenziert die Vorlage, nicht eine unverbundene Kopie.

### Erwartetes Ergebnis

Ausstattungseditor, AppearanceService, Outfit-Entwürfe, erste NPC-Erzeugung und Fitting-/Workflowtests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P13 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P14 — Ausrüstung und optionale Eigenbewegung

**Abhängigkeiten:** P13
**Spezifikation:** Kapitel 9, 11, 14, 16
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erweitere das Aussehen um Rüstung, Accessoires und zusätzliche Equipmentstücke. Ein Objekt kann mehrere starre Teile an verschiedenen Slots enthalten. Die 16 Grundslots des humanoiden Profils bleiben unverändert; Equipment wird nicht zu neuer Pflichtanatomie.

Implementiere getrennt enabled, follow_mode und own_motion_enabled. Ein sichtbares Teil ohne Eigenbewegung folgt weiterhin seinem Körper-Slot. Nur die Regler/Spuren für seine eigene Bewegung sind grau deaktiviert. Ein ausgeschaltetes Teil erscheint weder in Vorschau noch Export, behält aber seine gespeicherten Einstellungen.

Unterstütze richtungsabhängige Bilder, Pivots und Schichten sowie kontrollierte eigene Transformationsspuren beziehungsweise die vorhandenen deterministischen Hilfskanäle. Unsichtbare oder deaktivierte Spuren dürfen keine Phantom-Bewegung erzeugen. Mitführen am Figurenursprung ist eine ausdrücklich gewählte Alternative.

Zeige bei großflächigen Kleidungsstücken, dass starre Bilder nicht automatisch über mehrere Gelenke deformiert werden. Teste ein segmentiertes Oberteil, einen mitgeführten Handschuh und ein Accessoire mit eingeschaltetem Nachschwingen. Überprüfe Asymmetrie und Überdeckungen in allen Richtungen.

### Gate dieser Phase

Die drei Zustände „ausgeblendet“, „mitgeführt ohne Eigenbewegung“ und „mit eigener Bewegung“ unterscheiden sich korrekt. Ausschalten löscht keine Werte. Ausstattung sitzt in allen Richtungen anatomisch richtig. Keine Mesh-/Skinning-Abhängigkeit wird eingeführt.

### Erwartetes Ergebnis

Equipment-Modelle, Ausstattungskomponenten, optionale Spuren, deaktivierte Bedienzustände und entsprechende Render-/Verhaltenstests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P14 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P15 — NPC-Dashboard, Mehrfachanimationen und Revisionen

**Abhängigkeiten:** P14
**Spezifikation:** Kapitel 3–5, 12–14
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den Tab NPCs und die NPC-Detailansicht mit allen Bewegungen einer Figur. Zeige Namen, Labels, Richtungsabdeckung, benötigte/fehlende Aktionen und Exportstatus. Alle strukturierten Filter bleiben Dropdowns. Der Wechsel zwischen Animationen und NPCs erhält den sinnvollen Bereichskontext.

Ergänze „Vorhandenem NPC weitere Bewegung zuordnen“. Die Figur wird über ihre ID gewählt. Verwende ihr bestehendes Aussehen und eine festgehaltene freigegebene Vorlagenrevision. Erzeuge je action_key höchstens eine aktive Zuordnung; Varianten erhalten ausdrückliche neue Schlüssel.

Implementiere lokale Fitting-/Bewegungskorrekturen ausschließlich für eine Zuordnung. Gemeinsames Aussehen und Vorlage bleiben davon unberührt. Ein Editierhinweis erklärt den Umfang. Eine neue Vorlagenrevision wird zur Übernahme angeboten, nicht automatisch aufgezwungen. Prüfe Kompatibilität und lokale Overrides vor dem Update.

Implementiere Duplizieren und kontrolliertes Umbenennen eines NPCs samt Ordnerstruktur und Referenzen. Ein zweiter NPC darf dieselbe Vorlagenrevision und unveränderliche Assets weiterverwenden. Bereite die korrekte Aktualitätsberechnung anhand effektiv genutzter Quellen vor.

### Gate dieser Phase

Dorfbewohner 01 besitzt Gehen, Sprinten und Springen in einem NPC-Ordner. Ein zweiter NPC teilt die Laufvorlage, nicht die Identität. Lokale Änderungen bleiben lokal. Alte Revision beibehalten und neue übernehmen funktionieren. Umbenennen und Wiederöffnen beschädigen keine Zuordnungen.

### Erwartetes Ergebnis

NPC-Dashboard/-Details, BindingService, Revision-Übernahme, lokale Overrides, Duplizier-/Umbenennungslogik und Mehrfachanimations-Tests.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P15 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P16 — Generischer PNG-/JSON-Export

**Abhängigkeiten:** P15
**Spezifikation:** Kapitel 13–16, 19
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere den Standardexport aus dem gemeinsamen Sampler und Referenz-Compositor. Ausgabe sind PNG-Sheets plus vollständige JSON-Metadaten. Optional können zusätzlich einzelne PNG-Frames in richtungsgetrennten Ordnern erzeugt werden. Autoritative Quellen bleiben unabhängig davon erhalten.

Baue einen regelmäßigen Atlas mit festen Frameflächen, Bodenankern und expliziten Rechtecken. Keine stille Rotation oder Randbeschneidung. Begrenze Seiten und Gesamtspeicher; erzeuge bei Bedarf mehrere Seiten. Validiere Padding-/Extrusionsoptionen, falls vorhanden.

Implementiere Exportprofile, Quellen-Fingerabdruck, Build-Verzeichnis, Abschlussprüfung und erst danach current.json. Ein abgebrochener Job darf den letzten guten Build nicht ersetzen. Unterstütze Fortschritt, Abbruch und verständliche Meldungen zu fehlenden Quellen, fehlenden Richtungen oder Clipping.

Ein kompletter NPC-Export prüft gemeinsame Framegröße und Bodenanker. Biete transparentes Padding statt ungefragter Skalierung an. Dokumentiere FPS, Loop, Sprungmodus und alle Richtungen. Testexport mit fehlenden Teilen ist nur ausdrücklich und markiert zulässig. Bau deterministische Fixture-Exporte und vergleiche dekodierte Pixel.

### Gate dieser Phase

Ein NPC exportiert mehrere Aktionen mit je acht Richtungen. Alle Rechtecke liegen in der korrekten PNG-Seite, Framezahl/FPS/Anker stimmen. Einzelbilder fehlen standardmäßig und erscheinen nur auf Wunsch. Abbruch erhält den alten Build. Effektive Quelländerungen ändern die Aktualität, bloße Wiederholung nicht.

### Erwartetes Ergebnis

ExportService, AtlasBuilder, generischer Manifestvertrag, Exportdialog/-profile, Fingerabdruck und Export-Goldens.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P16 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P17 — Portables Godot-Paket und echter Importtest

**Abhängigkeiten:** P16
**Spezifikation:** Kapitel 16–17
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Implementiere als zusätzliche Ausgabe SpriteFrames-Ressourcen und optional eine AnimatedSprite2D-Szene. Nutze PNG-Sheets über AtlasTexture-Rechtecke. Namen folgen action_direction, beispielsweise walk_s und sprint_ne. FPS und Loop übernehmen die generischen Daten.

Erzeuge portable Ressourcenpfade innerhalb des Pakets. Es dürfen weder absolute Rechnerpfade noch Referenzen in die ursprüngliche Vault entstehen. Verwende keine unbeabsichtigt eingebetteten ImageTexture-Bilddaten als Ersatz für PNG-Verweise. Escape Namen und Ressourcen-Text korrekt; führe keinen Nutzer-Scriptcode aus.

Die optionale Szene besitzt ihren Ursprung am Boden, einen konsistenten Sprite-Offset und Nearest-Filter. Sie enthält keine erzwungene Spielsteuerung, keine Kollision und kein Skelett. Der Sprungmodus ist erklärt, damit ein Zielspiel Höhe nicht doppelt anwendet.

Erzeuge automatisiert ein frisches temporäres Godot-Projekt, kopiere das Paket hinein, lasse Bilder importieren und lade die Ressourcen. Prüfe Animationsnamen, Framezahl, Rechtecke, FPS und Szene. Wiederhole den Test nach Verschieben in ein anders benanntes Unterverzeichnis. Benenne die tatsächlich getestete Godot-Version.

### Gate dieser Phase

Der frische Godot-Import gelingt ohne alte .godot-Caches und ohne Zugriff auf die Vault. Alle erwarteten Aktionen/Richtungen sind vorhanden. Das verschobene Paket funktioniert. Es gibt keine Behauptung über ungeprüfte andere Godot-Versionen.

### Erwartetes Ergebnis

GodotExporter, generierte Beispielressourcen, frischer Projekt-Importtest und kurze Engine-Einbindungsanleitung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P17 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P18 — Recovery, Autosave und Datenintegrität härten

**Abhängigkeiten:** P17; Speicherung aus P03 und Commands aus P08 bestehen bereits.
**Spezifikation:** Kapitel 12–14, 19, 21
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Prüfe jetzt die gesamte reale Bearbeitungskette gegen Speicher- und Wiederherstellungsfehler. Ergänze die bestehenden Dienste, statt eine zweite Speicherschicht einzuführen. Autosave, manuelles Speichern, Navigation, Undo/Redo, Freigaben und Exporte müssen zusammen konsistent bleiben.

Injiziere Abbrüche zwischen den Schritten mehrteiliger Änderungen: Projekt-/NPC-Umbenennen, Asset-Import, neue Freigaberevision und Export-Abschluss. Offene Journale müssen beim Neustart nachvollziehbar fortsetzbar oder rückrollbar sein. Simuliere fehlende Rechte, belegte Dateien und fehlgeschlagene Writes ausschließlich in Test-Vaults.

Teste zwei App-Instanzen und den Umgang mit verwaisten Locks. Externe Dateiveränderungen müssen einen Konflikt auslösen, statt überschrieben zu werden. Formatmigrationen erhalten versionierte Ausgangsfixtures und Backups. Zukünftige unbekannte Schema-Versionen bleiben geschützt.

Prüfe die Speicherorte: globale Daten unter .pixelforge-studio, projektbezogene Backups/Journale im Projekt, Quellen im zuständigen Bereich/NPC. Kontrolliere Lösch-/Trash-Aktionen, Referenzen und Cache-Wiederaufbau. Ein kopierter Vault muss ohne ursprüngliche Vollpfade funktionieren.

### Gate dieser Phase

Die beschriebenen Fehlerfälle erhalten den letzten gültigen Stand oder stellen ihn kontrolliert wieder her. Keine stille Datenverlustmeldung und keine ungeprüfte Mehrdatei-Atomaritätsbehauptung. Kopieren und Öffnen der Vault funktionieren. Offene Grenzen werden konkret dokumentiert.

### Erwartetes Ergebnis

Gehärtete Speicherdienste, Migration-/Konfliktbehandlung, Fehler-Injektionstests und Recovery-Dokumentation.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P18 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P19 — Desktop-Usability und Leistung prüfen

**Abhängigkeiten:** P18
**Spezifikation:** Kapitel 5, 7, 20–21
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Führe einen vollständigen Desktop-Durchlauf mit echten erzeugten Daten aus. Prüfe 1440×900, das Mindestlayout 1280×720 und verfügbare DPI-Skalierungen. Panels, Timeline, Dialoge und Dropdowns dürfen keine zentralen Aktionen abschneiden. Die Pixel-Zeichenfläche darf nicht durch allgemeine UI-Skalierung weich werden.

Prüfe Fokus, Tab-Reihenfolge, Tastaturkürzel, Texteingaben, Rechtsklick-Alternativen, Tooltips und Statusmeldungen. Kontrolliere ausdrücklich, dass jede strukturierte Filterbedingung über ein Dropdown erreichbar ist. Reduzierte Bewegung deaktiviert unnötige Kartenanimationen.

Miss Vorschau, Rasterer, Import, Export und große Übersichten auf einem benannten Referenzgerät. Verwende einen Testbestand mit vielen Projekt-/Asset-Metadaten und begrenzten gleichzeitig sichtbaren Previews. Cachebudget und Freigabe unbenutzter Bilddaten werden geprüft. Optimiere gemessene Engpässe, ohne den Referenz-Rasterer semantisch zu verändern.

Prüfe Offline-Verhalten und Abbruch langer Jobs. Trenne funktionale Fehler von nicht erreichten Leistungszielen. Neue Beschleunigungsabhängigkeiten brauchen einen dokumentierten Entscheid und müssen dieselben Golden-Pixel erzeugen.

### Gate dieser Phase

Der gesamte Workflow ist mit Maus und Tastatur durchführbar. Keine nur farblich oder per Rechtsklick versteckten Pflichtinformationen. Messungen und Referenzgerät sind protokolliert. Cache bleibt begrenzt, lange Jobs reagieren. Keine erfundenen FPS- oder Plattformresultate.

### Erwartetes Ergebnis

Usability-Korrekturen, Benchmark-/Profilingbericht, optimierte begrenzte Caches und Desktop-Abnahmeprotokoll.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P19 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P20 — Native Builds, Tooling und Codespaces

**Abhängigkeiten:** P19
**Spezifikation:** Kapitel 2, 18, 21–22
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Integriere die Studio-Tests und Buildabläufe in das vorhandene Python-Tooling und die CI. Erhalte nachvollziehbare style-/check-Gates und die vorhandene Installationspolitik. Aktualisiere Produktmetadaten und Desktop-Exportkonfigurationen konsistent, ohne Sicherheitsprüfungen einfach abzuschalten.

Erzeuge native Testartefakte für Windows, Linux und macOS mit der festgelegten Godot-Version und passenden offiziellen Exportvorlagen. Prüfe je zugesicherter Plattform Start, Dateidialog und einen kleinen Speichern-/Export-Durchlauf. Endnutzer benötigen keinen zusätzlichen Python-Prozess und keinen Godot-Editor für die Benutzung der exportierten Studio-App.

Dokumentiere Signierung/Notarisierung, soweit relevant, als eigenen Freigabeschritt. Erfinde keine Signatur und speichere keine Zertifikate oder Geheimnisse im Repository. Veröffentlichung, Tagging und Push bleiben explizit beauftragte Aktionen, nicht automatische Nebenwirkungen dieser Phase.

Ergänze bei Bedarf eine Codespaces-/Devcontainer-Konfiguration für Codearbeit und Headless-Tests. Kein Webexport und keine mobile Studio-Ausgabe. Erkläre, dass Portweiterleitung keine native GUI-Vorschau ersetzt. Prüfe welche Tests dort tatsächlich laufen können.

### Gate dieser Phase

Vorhandene und neue Gates sind in Tooling/CI eingebunden. Für jede Plattform gibt es ein tatsächliches Testresultat oder einen offen benannten Blocker; ungeprüfte Plattformen gelten nicht als abgenommen. Artefakte enthalten keine Nutzer-Vault oder Geheimnisse. Codespaces-Dokumentation verspricht keine nicht vorhandene Desktop-Vorschau.

### Erwartetes Ergebnis

Desktop-Buildkonfigurationen, CI-/Tooling-Erweiterungen, Testartefakte soweit erzeugbar, Plattformmatrix und Entwicklungsanleitung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P20 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P21 — Anleitung und nachvollziehbare Beispiel-Vault

**Abhängigkeiten:** P20
**Spezifikation:** Kapitel 4, 10–17, 21–24
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Erstelle eine kleine eigene, rechtlich unproblematische Beispiel-Vault: ein Spielprojekt, ein 80-px-NPC-Bereich, freigegebene Bewegungen, zwei unterschiedlich ausgestattete NPCs und mehrere Aktionen je Figur. Nutze selbst erzeugte einfache Pixelteile oder eindeutig freigegebene Quellen mit Herkunftsnotiz.

Die Beispiel-Vault muss den realen Produktionsworkflow verwenden und erneut geöffnet werden können. Sie ist kein UI-Mock. Zeige Wiederverwendung einer Vorlage, lokale Fittingkorrektur, Equipment ohne Eigenbewegung und ein vollständiges Godot-Paket.

Schreibe eine deutsche Schritt-für-Schritt-Anleitung vom leeren Ordner bis zur Spieleinbindung. Erkläre Projekt/Bereich/Vorlage/NPC/Zuordnung, Figurenhöhe gegenüber Framefläche, Freigaben, Spiegelgrenzen, Speicherstruktur, Recovery und den Unterschied zwischen Quelle und Export. Keine Aussagen über Funktionen, die tatsächlich noch nicht fertig sind.

Aktualisiere README und Dokumentationsindex über die vorhandenen Mechanismen. Ergänze bekannte Einschränkungen, tatsächliche Plattform-/Godot-Versionen und einen kurzen Fehlerbericht-Leitfaden ohne private Daten. Prüfe, dass Nutzer die exportierte App verwenden können, ohne das Entwickler-Tooling zu installieren.

### Gate dieser Phase

Die Beispiel-Vault lässt sich in einer sauberen Umgebung öffnen und exportieren. Eine Person kann der Anleitung ohne versteckte Schritte folgen. Screenshots, falls erstellt, stammen aus dem tatsächlichen Studio. Alle dokumentierten Funktionen und getesteten Versionen stimmen mit dem implementierten Stand überein.

### Erwartetes Ergebnis

Beispiel-Vault beziehungsweise reproduzierbarer Generator, deutsche Nutzeranleitung, aktualisierte Einstiegseiten und Einschränkungsübersicht.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P21 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.


---

## P22 — Gesamtabnahme und überprüfbarer Abschluss

**Abhängigkeiten:** P00–P21 mit dokumentierten Gates.
**Spezifikation:** Kapitel 1–25, insbesondere 21–23
**Lebender Plan:** `docs/developer/plans/pixelcutoutsprite-execplan.md`

### Auftrag an den Coding-Agenten

Lies vor der Arbeit die geltenden Repository-Regeln, die vollständige Studio-Spezifikation und `docs/developer/prompts/pixelcutoutsprite/MASTERPROMPT.md`. Prüfe den aktuellen Codezustand und die Abhängigkeiten dieser Phase. Implementiere den folgenden Umfang im bestehenden Godot-Desktop-Projekt; bewahre Nutzeränderungen und aktualisiere den ExecPlan.

Arbeite RQ-01 bis RQ-40 sowie die Ende-zu-Ende-Szenarien A bis J einzeln durch. Verweise pro Anforderung auf implementierte Komponenten und tatsächliche Tests oder manuelle Belege. Eine vorhandene Datei allein ist kein Funktionsnachweis.

Prüfe die gesamte Kette: Vault öffnen, Projekt und Bereich anlegen, Dummy animieren, acht Richtungen freigeben, PNGs importieren, anziehen, feinjustieren, NPC benennen, weitere Bewegung zuordnen, neu öffnen und als PNG/JSON/Godot exportieren. Wiederhole den Godot-Import in einem frischen Projekt.

Kontrolliere die Negativanforderungen: kein SQL/SQLite für die Studio-Daten, keine fachlichen Projektquellen im globalen Metadatenordner, kein erforderlicher Bone-/Skeleton-Aufbau, kein mobiles/webbasiertes Studio und keine Python-Pflicht für Endnutzer. Prüfe unveränderte ursprüngliche Quelldateien und intakte Revisionsreferenzen.

Führe die verfügbaren vollständigen Repository-Gates und Plattformprüfungen aus. Behebe echte Fehler oder dokumentiere konkrete Blocker. Setze nur tatsächlich bestandene Phasen auf abgeschlossen. Veröffentliche keinen Release und pushe keine Änderungen ohne gesonderten Auftrag.

Schließe den ExecPlan mit tatsächlichen Ergebnissen, Prüfungen, verbleibenden Grenzen und einem klaren nächsten fachlichen Schritt. Spätere Körperprofile oder KI-Funktionen werden nicht nachträglich zum Pflichtumfang erklärt.

### Gate dieser Phase

Alle Muss-Anforderungen haben nachvollziehbare Belege oder ausdrücklich offene, nicht als erledigt markierte Einträge. Keine unbelegten Test-, Leistungs- oder Plattformbehauptungen. Der dokumentierte Funktionsstand stimmt mit Anwendung, Daten und Exporten überein.

### Erwartetes Ergebnis

Abnahmematrix, abschließendes Testprotokoll, aktueller ExecPlan und ehrlicher Implementierungsabschluss ohne automatische Veröffentlichung.

Führe zuerst die passenden fokussierten Tests und danach die verfügbaren Repository-Gates aus. Dokumentiere genaue Prüfergebnisse und offene Punkte. Setze P22 nur bei belegbar erfülltem Gate auf abgeschlossen. Nenne den nächsten Schritt; keine automatischen Pushes oder Releases.

---

# Teil III — Initialer ExecPlan

## PixelCutoutSprite Studio — lebender ExecPlan

**Planungsstand:** 5. September 2026
**Planung:** erstellt
**Implementierung:** noch nicht begonnen
**Repository:** `kleiveist/PixelCutoutSprite`

Dieses Dokument wird bei der Umsetzung fortgeschrieben. Ein hier aufgeführter Plan oder Prompt ist kein Nachweis einer implementierten Funktion.

### Purpose / Big Picture

Eine lokale Desktop-App für wiederverwendbare Pixelart-Cutout-Animationen entwickeln. Der Nutzer arbeitet von Projekt und Bereich über Dummy-Bewegung und Sprite-Ausstattung bis zum benannten NPC mit mehreren exportierbaren Animationen. Vorrangig sind humanoide RPG-NPCs mit acht Richtungen, ohne notwendige manuelle Bone-Einrichtung.

Verbindliche Spezifikation: PixelCutoutSprite Studio (`../features/pixelcutoutsprite-studio.md` im Dokumentationspaket).
Ausführungsrahmen: MASTERPROMPT (`../prompts/pixelcutoutsprite/MASTERPROMPT.md` im Dokumentationspaket).
Phasenindex: P00–P22 (`../prompts/pixelcutoutsprite/README.md` im Dokumentationspaket).

### Current State

Das über die GitHub-Verbindung gelesene Repository enthält ein Forge2D-Godot-Template mit Python-Tooling. Während der Planung gelesener Baum: `9a927ee895218357fc72fa1f506621335dc11a72`. README, AGENTS, Planstandard, Toolchain und Godot-Projektkonfiguration wurden gelesen. Der Checkout wurde in diesem Auftrag nicht ausgeführt.

Die Konfiguration nennt Godot 4.7.2 und Python mindestens 3.11 für das Entwickler-Tooling. Das offizielle Godot-Archiv bestätigt 4.7.2 als stabile Veröffentlichung zum Recherchestand. In P00 ist der tatsächliche dann vorliegende Checkout erneut zu prüfen.

Es wurden ausschließlich Planungsdateien erzeugt. Diese Dateien wurden nicht in das GitHub-Repository geschrieben. Eine Studio-Implementierung, native Builds und App-Tests stehen noch aus.

### Scope and Non-Goals

Pflichtumfang ist in der Spezifikation RQ-01 bis RQ-40 festgelegt. Besonders wichtig sind Desktop-only, JSON/PNG statt SQL, lokale Vault, globale Daten ausschließlich unter .pixelforge-studio, 16 vordefinierte Grundslots einschließlich optionaler Haare, acht Richtungen, getrennte Vorlagen/Appearance/Bindings und ein portabler Spieleexport.

Nicht Teil der ersten Version sind andere Körperformen, Augen-/Gesichtssystem, vollständiger Pixel-Painter, KI-Perspektivgenerierung, notwendige Skelette/IK, Cloud-Zusammenarbeit und mobile beziehungsweise Web-Ausgaben des Studios.

### Concrete Steps

Die folgenden Phasen werden der Reihe nach anhand ihres vollständigen Prompts umgesetzt. Eine Phase beginnt erst bei erfüllten Abhängigkeiten. Tests werden fortlaufend ergänzt, nicht erst am Ende.

| Phase | Auftrag | Status |
|---|---|---|
| P00 (`../prompts/pixelcutoutsprite/00.md` im Dokumentationspaket) | Bestand prüfen und Umsetzung verankern | Nicht begonnen |
| P01 (`../prompts/pixelcutoutsprite/01.md` im Dokumentationspaket) | Desktop-Shell und Produktidentität | Nicht begonnen |
| P02 (`../prompts/pixelcutoutsprite/02.md` im Dokumentationspaket) | Fachmodelle und JSON-Verträge | Nicht begonnen |
| P03 (`../prompts/pixelcutoutsprite/03.md` im Dokumentationspaket) | Vault und sichere Dateispeicherung | Nicht begonnen |
| P04 (`../prompts/pixelcutoutsprite/04.md` im Dokumentationspaket) | Projekt-Dashboard, Labels und Dropdown-Filter | Nicht begonnen |
| P05 (`../prompts/pixelcutoutsprite/05.md` im Dokumentationspaket) | Bereiche und humanoide Körperprofile | Nicht begonnen |
| P06 (`../prompts/pixelcutoutsprite/06.md` im Dokumentationspaket) | Animationsbibliothek und zustandsabhängige Navigation | Nicht begonnen |
| P07 (`../prompts/pixelcutoutsprite/07.md` im Dokumentationspaket) | Gemeinsamer Pixel-Rasterer | Nicht begonnen |
| P08 (`../prompts/pixelcutoutsprite/08.md` im Dokumentationspaket) | Direkt bedienbarer Dummy-Editor | Nicht begonnen |
| P09 (`../prompts/pixelcutoutsprite/09.md` im Dokumentationspaket) | Timeline, Keyframes und deterministisches Sampling | Nicht begonnen |
| P10 (`../prompts/pixelcutoutsprite/10.md` im Dokumentationspaket) | Acht Richtungen, Spiegelregeln und Schichten | Nicht begonnen |
| P11 (`../prompts/pixelcutoutsprite/11.md` im Dokumentationspaket) | Bewegungspresets und tatsächliche Kartenvorschauen | Nicht begonnen |
| P12 (`../prompts/pixelcutoutsprite/12.md` im Dokumentationspaket) | PNG-Inventar und Paketimport | Nicht begonnen |
| P13 (`../prompts/pixelcutoutsprite/13.md` im Dokumentationspaket) | Ausstattungseditor, Feinschliff und NPC-Entwürfe | Nicht begonnen |
| P14 (`../prompts/pixelcutoutsprite/14.md` im Dokumentationspaket) | Ausrüstung und optionale Eigenbewegung | Nicht begonnen |
| P15 (`../prompts/pixelcutoutsprite/15.md` im Dokumentationspaket) | NPC-Dashboard, Mehrfachanimationen und Revisionen | Nicht begonnen |
| P16 (`../prompts/pixelcutoutsprite/16.md` im Dokumentationspaket) | Generischer PNG-/JSON-Export | Nicht begonnen |
| P17 (`../prompts/pixelcutoutsprite/17.md` im Dokumentationspaket) | Portables Godot-Paket und echter Importtest | Nicht begonnen |
| P18 (`../prompts/pixelcutoutsprite/18.md` im Dokumentationspaket) | Recovery, Autosave und Datenintegrität härten | Nicht begonnen |
| P19 (`../prompts/pixelcutoutsprite/19.md` im Dokumentationspaket) | Desktop-Usability und Leistung prüfen | Nicht begonnen |
| P20 (`../prompts/pixelcutoutsprite/20.md` im Dokumentationspaket) | Native Builds, Tooling und Codespaces | Nicht begonnen |
| P21 (`../prompts/pixelcutoutsprite/21.md` im Dokumentationspaket) | Anleitung und nachvollziehbare Beispiel-Vault | Nicht begonnen |
| P22 (`../prompts/pixelcutoutsprite/22.md` im Dokumentationspaket) | Gesamtabnahme und überprüfbarer Abschluss | Nicht begonnen |

### Progress

- [x] Nutzeranforderungen in eine vollständige Produktspezifikation überführt.
- [x] Relevanten Repository-Ausgangsstand und offizielle technische Quellen gelesen.
- [x] Dateistruktur, Datenverträge, Exporte, Risiken und Abnahmefälle geplant.
- [x] Masterauftrag, Fortsetzungsauftrag und 23 Phasenprompts erstellt.
- [ ] P00 begonnen: aktuellen Checkout und tatsächliche Basisprüfungen erfassen.
- [ ] Meilenstein A: Grundlage, P00–P06.
- [ ] Meilenstein B: Bewegungen, P07–P11.
- [ ] Meilenstein C: Figuren, P12–P15.
- [ ] Meilenstein D: Spieleinbindung, P16–P17.
- [ ] Meilenstein E: belastbare Desktop-Version, P18–P22.

Bei jeder Phasenänderung ergänzen: Datum, tatsächlicher Umfang, betroffene Dateien, Prüfungen und nächster Schritt. Noch nicht geprüfte Plattformen werden nicht als fertig markiert.

### Surprises & Discoveries

**2026-09-05:** Das Repository ist nicht leer: Es enthält bereits ein Godot-/Python-Template. Deshalb ist ein zusätzlicher Web-/Tauri-/Electron-Stack nicht vorgesehen.

**2026-09-05:** Der gewünschte Workflow braucht eine Trennung zwischen Bewegungsvorlage und konkretem NPC. Eine reine Ordnerliste von unabhängigen Sprite-Sheets würde die geforderte Wiederverwendung nicht erfüllen.

**2026-09-05:** „Nicht animiertes“ Equipment muss seinem Träger trotzdem folgen können. Sichtbarkeit, Mitführen und Eigenbewegung sind deshalb getrennte Eigenschaften.

**2026-09-05:** Eine native Desktop-App ist nicht automatisch per Codespaces-Portweiterleitung als GUI bedienbar. Codespaces dient in diesem Plan Codearbeit und geeigneten Headless-Tests.

### Decision Log

| ID | Entscheidung | Begründung |
|---|---|---|
| ADR-001 | Bestehendes Godot-Desktop-Projekt und Python-Tooling weiterverwenden. | Passend zum Repository, kein zusätzlicher Produktstack nötig. |
| ADR-002 | Vordefinierte starre Cutout-Teile mit Keyframes. | Keine manuelle Rig-Einrichtung, trotzdem wenige zu bearbeitende Posen. |
| ADR-003 | Vorlagen, NPC-Aussehen und Zuordnungen trennen. | Dieselbe Bewegung für mehrere Figuren wiederverwenden. |
| ADR-004 | JSON/PNG in gewöhnlichen Vault-Ordnern, kein SQL. | Explizite Nutzeranforderung und portable, nachvollziehbare Quellen. |
| ADR-005 | PNG-Sheets + JSON als Standard, Godot-Ressourcen zusätzlich. | Engine-unabhängige Basis und einfache Godot-Einbindung. |
| ADR-006 | Unveränderliche Freigaberevisionen und explizite Updates. | Bestehende NPCs und Exporte nicht unbemerkt verändern. |
| ADR-007 | Gemeinsamer Sampler und prüfbarer Referenz-Rasterer. | Vorschau und Ausgabe sollen dieselben Pixel ergeben. |
| ADR-008 | Workspace-Ordnername .pixelforge-studio bleibt fest. | Gewünschte globale Ablage, getrennt vom Produktbranding. |

Abweichungen während der Implementierung werden hier ergänzt, einschließlich betroffener Anforderungen, Migration, Testfolgen und erwogener Alternative.

### Validation

#### Bereits in diesem Planungsauftrag geprüft

Die Planungsdateien wurden lokal auf Vollständigkeit der 23 Phasen, gültige JSON-Syntax der erklärenden Ausschnitte, geschlossene Codeblöcke, auflösbare interne Dateilinks und vollständige RQ-01–RQ-40-Abdeckung geprüft. Das genaue Dateiprüfprotokoll liegt dem Paket bei.

#### Nicht in diesem Auftrag ausgeführt

Keine Repository-Installation, keine vorhandenen Projekt-Tests, keine Studio-App, kein PNG-Renderer, kein nativer Desktop-Build und kein Godot-Import des künftigen Exporters wurden ausgeführt. Die Webrecherche bestätigt API-/Versionsgrundlagen, nicht die spätere Implementierung.

#### Prüflog für die Implementierung

| Datum / Phase | Befehl oder manuelle Prüfung | Umgebung | Ergebnis | Beleg / offene Punkte |
|---|---|---|---|---|
| Noch offen | Basisprüfung in P00 | Noch zu erfassen | Nicht ausgeführt | Kein App-Test in der Planung. |

Die vorhandenen Repository-Gates, insbesondere python tools/control.py style und python tools/control.py check, werden in der Implementierung entsprechend ihrer tatsächlichen Verfügbarkeit verwendet. Änderungen an ihren Verträgen werden begründet dokumentiert.

### Recovery / Idempotence

Vor Arbeitsbeginn aktuellen Git-Status und Nutzeränderungen prüfen. Keine destruktiven Git-Befehle, unbeauftragten Pushes oder Releases. Tests verwenden temporäre Vaults. Produktionsdaten werden niemals als Wegwerf-Fixture benutzt.

Wiederaufnahme beginnt mit dem aktuellen Code und diesem Plan, nicht allein mit Chat-Kontext. Die erste unvollständige Phase und ihr Gate werden erneut geprüft. Mehrteilige Nutzerdatenänderungen erhalten in der App Journale und Sicherungen; ein fehlgeschlagener Export ersetzt keinen letzten gültigen Build.

**Nächster ausführbarer Schritt:** P00 mit dem MASTERPROMPT im aktuellen Repository beginnen und den tatsächlichen Ausgangsstand sowie die verfügbaren Basisprüfungen dokumentieren.

### Outcomes & Retrospective

Die Planung und Prompt-Abfolge sind vorhanden. Die Studio-Implementierung ist noch offen. Nach jeder größeren Etappe werden reale Ergebnisse, erkannte Grenzen und notwendige Planänderungen hier ergänzt. Ein Abschlussstatus wird erst nach der belegten Gesamtabnahme P22 vergeben.

---

# Anhang — Dateiprüfung

## Dateiprüfung des Planungsdokuments

**Stand:** 5. September 2026. Diese Prüfung betrifft nur die erstellten Planungsdateien.

| Prüfung | Ergebnis |
|---|---|
| Markdown-Dateien im Dokumentationspaket vor Erzeugung dieses Berichts | 29 gelesen. |
| Phasenfolge | Genau 23 Phasen, P00 bis P22, ohne Lücke. |
| Pflichtabschnitte der Phasen | Auftrag, Gate und erwartetes Ergebnis in allen 23 Dateien vorhanden. |
| Anforderungsübersicht | RQ-01 bis RQ-40 enthalten. |
| JSON-Beispiele | 5 Codeblöcke syntaktisch mit einem JSON-Parser geprüft. |
| Interne Markdown-Dateilinks | 56 Links auf existierende Dateien aufgelöst. |
| Codeblöcke | Alle geprüften Markdown-Dateien besitzen geschlossene Codeblöcke. |
| Implementierungsstatus | Als Planung gekennzeichnet; keine Phasenimplementation als abgeschlossen ausgegeben. |

**Grenzen:** Die JSON-Beispiele sind erklärende Ausschnitte, keine vollständig ladbare Beispiel-Vault. Es wurde keine Anwendung implementiert oder getestet. App-Tests, native Builds, Rendering-Ergebnisse und Godot-Paketimport sind Aufgaben der späteren Phasen. Externe Quellen sind Recherchebelege, kein Ersatz dafür.
