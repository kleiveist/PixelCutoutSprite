<!-- AUTO-GENERATED:backlink START -->
[← Back](features.md)
<!-- AUTO-GENERATED:backlink END -->
# PixelCutoutSprite Studio — Produktspezifikation und technische Planung

**Version:** 1.0 · **Stand:** 6. September 2026 · **Sprache:** Deutsch
**Repository:** `kleiveist/PixelCutoutSprite`
**Status:** Verbindliche Produktspezifikation; P00–P22 sind umgesetzt und die tatsächlichen
Nachweise stehen in der [Gesamtabnahme](../acceptance/final-acceptance.md). Historische
Planungsformulierungen beschreiben weiterhin den jeweiligen Sollzustand.
**Verbindlichkeit:** Nutzeranforderungen werden als Muss-Anforderungen behandelt. Ergänzende Entscheidungen sind hier als Planungsfestlegungen dokumentiert und können durch einen begründeten Architekturentscheid geändert werden.

> **Implementierungskorrektur:** Der tatsächliche Checkout ist Template Tooling 0.4.0 und
> enthält keine Forge2D-/Godot-App. [ADR-001](../decisions/adr-001-tauri-desktop.md)
> ersetzt deshalb die technischen Repository-Annahmen in Kapitel 2 und 18: Das Studio wird
> mit Tauri 2, Rust, Vite, React und TypeScript umgesetzt. Godot bleibt Exportziel in Kapitel
> 17. Alle fachlichen Anforderungen und Desktop-Grenzen bleiben unverändert.

## Inhaltsverzeichnis

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

## 1. Produktziel und feste Grenzen

PixelCutoutSprite Studio wird eine **lokale Desktop-Anwendung zum Erstellen wiederverwendbarer Pixelart-Animationen**, zunächst für humanoide Figuren in RPGs mit acht Blick- und Bewegungsrichtungen.

Das zentrale Verfahren lautet:

> Einen vorgegebenen, gut erkennbaren Dummy durch wenige Posen animieren. Danach passende Pixel-Sprites auf seine Körperteile setzen. Dieselbe Bewegung mit unterschiedlichen NPCs und Ausrüstungen wiederverwenden. Das Ergebnis als fertige Sprite-Animation exportieren.

Ein Nutzer soll **weder jeden Zwischenframe zeichnen noch ein eigenes Skelett konstruieren** müssen. Er muss jedoch die Ausgangs-Sprites bereitstellen und Bewegungen beziehungsweise wichtige Posen gestalten. Aus einem beliebigen einzelnen Frontbild werden nicht automatisch perfekte Ansichten in acht Richtungen erzeugt.

### 1.1 Verbindlicher Umfang

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

### 1.2 Begriffliche und gestalterische Festlegungen

Der Repository- und Produktname bleibt **PixelCutoutSprite**; die Oberfläche kann „PixelCutoutSprite Studio“ anzeigen. Der gewünschte globale Datenordner heißt dauerhaft `.pixelforge-studio`. Unterschiedliche Schreibweisen dieses Ordners werden nicht parallel eingeführt.

Das vom Nutzer „Wallet“ genannte Ordnersystem wird in der Oberfläche **„Arbeitsordner (Vault)“** genannt. Gemeint ist ein lokaler Datenordner, kein Finanz- oder Kryptosystem.

„Homepage“, „Page“ und „Dashboard“ bezeichnen Ansichten innerhalb der Desktop-App. Es wird kein Browser-Produkt vorausgesetzt. Der „Sprite-Editor“ ist in Version 1 ein **Zuordnungs- und Platzierungseditor**, kein vollständiges Zeichenprogramm mit Pinseln.

## 2. Repository-Befund und Technologieentscheidung

### 2.1 Tatsächlicher Ausgangsstand

P00 prüfte den lokalen Branch `main` bei Revision
`e709b853f0bf2bcfb95da7e7113cf18e43c4fc57`. Der Checkout enthält Template Tooling 0.4.0
mit Python-Tooling, Tauri-Helfern und dem Profil `desktop-local`, aber noch keinen Produktbaum.
Die im importierten Plan genannten Dateien `AGENTS.md`, `.agent/PLANS.md`, `game/project.godot`
und `config/*.toml` existieren hier nicht. Der vollständige Befund steht im
[Repository-Inventar](../repository-inventory.md).

Das Tooling definiert Vite/TypeScript/Tauri/Rust als lokale Desktop-Schiene. Der führende
Repository-Einstieg bleibt `python tools/control.py`. Godot 4.7.2 ist auf dem Referenzrechner
verfügbar und wird ausschließlich für den Export-Importtest in P17 verwendet.

### 2.2 Architekturentscheidung ADR-001

**Auf dem vorhandenen Tooling-Template und seinem Tauri-Desktopprofil aufbauen. Kein Electron-
oder Browserprodukt.**

| Teil | Entscheidung |
|---|---|
| Desktop-Laufzeit | Tauri 2 und Rust; Windows, Linux und macOS. |
| Oberfläche | React und TypeScript auf Vite, ausschließlich als gebündelte Desktop-WebView. |
| Fachliche Logik | Pure TypeScript-Module und Rust-Dienste ohne Abhängigkeit vom sichtbaren View-Baum. |
| Pixelbilder | Deterministische RGBA8-Puffer; Canvas/ImageData für Anzeige und Rust `image` für native PNG-I/O. |
| Dateien | Rust-Standardbibliothek, validierte relative Pfade, JSON und kontrollierte Transaktionen. |
| Tooling | Vorhandenes Python-Tooling erweitern; Python ist keine Laufzeitvoraussetzung für Endnutzer. |
| Tests | Vitest/DOM-Tests, Rust-Unit-/Integrationstests, Tauri-Smokes und Godot nur als Exportverbraucher. |
| Neue Abhängigkeiten | Exakt versioniert, begründet und mit minimalen nativen Berechtigungen. |

Tauri stellt die native Desktop-Hülle und IPC-Grenze bereit. React bildet den umfangreichen,
zustandsbehafteten Editor ab; Rust kontrolliert Dateizugriff und native Jobs. Die Entscheidung
nutzt das im tatsächlichen Template vorbereitete Profil und vermeidet eine zweite Laufzeit.

### 2.3 Desktop und Codespaces sauber unterscheiden

Codespaces kann für Quellcodearbeit, Tooling und geeignete Headless-Tests verwendet werden. Portweiterleitung macht den Vite-Entwicklungsserver erreichbar, nicht automatisch eine native Tauri-Desktop-Oberfläche. **Die Studio-GUI wird nativ auf einem Desktop geprüft.** Ein optional eingerichteter Remote-Desktop wäre nur eine Entwicklungsumgebung, kein Produktziel. Es wird kein Webprodukt hinzugefügt, nur um eine Codespaces-Vorschau zu erhalten. [S8, S9]

Die vorhandenen Spiel-/Touch-Baselines werden in Phase 00 geprüft. Unbenutzte spielbezogene Oberflächen oder mobile Exportziele werden kontrolliert abgelöst, nicht blind gelöscht. Bestehende Prüfungen werden fachlich angepasst und nicht bloß deaktiviert.

## 3. Begriffe und fachliches Datenmodell

### 3.1 Die fünf zentralen Objekte

| Objekt | Bedeutung | Beispiel |
|---|---|---|
| Projekt | Ein Spiel oder ein zusammengehöriger Asset-Bestand. | „Mein RPG“ |
| Bereich | Ein organisatorischer Teil des Projekts mit Körperprofil und Größenvorgaben. | „NPCs – Menschen 80 px“ |
| Bewegungsvorlage | Eine vom Aussehen unabhängige Dummy-Animation. | „Gehen“, „Sprinten“, „Springen“ |
| NPC/Charakter | Eine benannte Figur mit zugeordneten Körper-Sprites und Ausrüstung. | „Dorfbewohner 01“ |
| Animationszuordnung | Verbindung zwischen einem NPC und einer bestimmten freigegebenen Bewegungsvorlage. | „Dorfbewohner 01 / Gehen“ |

Zusätzlich gibt es **Körperprofile**, **Assets**, **Labels**, **Outfit-Entwürfe**, **Exportprofile** und **Exportstände**.

### 3.2 Die entscheidende Trennung

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

### 3.3 Beziehungen und Identität

Ein Projekt enthält mehrere Bereiche. Ein Bereich enthält mehrere Körperprofil-Versionen, Bewegungsvorlagen, Assets und NPCs. Ein NPC gehört in Version 1 genau einem Bereich an. Er besitzt ein Standard-Aussehen und beliebig viele Animationszuordnungen. Eine Zuordnung referenziert genau eine freigegebene Vorlagenrevision und ein Aussehen.

Alle referenzierbaren Objekte besitzen stabile String-IDs. Namen dienen der Anzeige und dürfen geändert werden. Referenzen erfolgen **niemals nur über Dateinamen oder sichtbare Namen**. Ein NPC mit demselben Namen in einem anderen Projekt ist keine identische Figur.

Bereiche und Labels haben verschiedene Aufgaben: Ein Bereich bestimmt Zugehörigkeit und Kompatibilität; Labels beschreiben zusätzliche Eigenschaften. Ein Label „Dorfbewohner“ erzeugt keinen neuen Ordner.

## 4. Vollständiger Arbeitsablauf

### 4.1 Erster nutzbarer Durchlauf

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

### 4.2 Nichtlineares Arbeiten

Jeder Schritt bleibt wieder aufrufbar. Ein Nutzer darf zuerst PNGs importieren, dann den Dummy animieren oder einen vorhandenen NPC um eine neue Bewegung erweitern. Der geführte Ablauf ist eine Hilfe, keine starre Einbahnstraße.

Unbenannte Outfit-Arbeit wird als Entwurf im jeweiligen Bereich gespeichert. Erst „Als NPC speichern“ verlangt einen Namen. Dadurch geht Arbeit nicht verloren, wenn die Benennung erst am Ende erfolgt.

## 5. Navigation, Dashboards und Filter

### 5.1 Ansichten und Klickverhalten

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

### 5.2 Karten und Vorschauen

Animationskarten sind echte Schaltflächen mit Fokuszustand und Bedienung per Tastatur. Eine Karte enthält Namen, Bewegungstyp, Labels, Freigabestatus, Richtungsabdeckung und eine kleine gerenderte Vorschau.

Die Vorschau zeigt die tatsächliche Bewegung des gespeicherten Dummys oder des gewählten NPCs, keine beliebige Beispielanimation. Sie spielt nur bei Hover, Fokus oder expliziter Aktivierung. Nicht sichtbare Karten werden nicht dauerhaft animiert. Bei „Bewegungen reduzieren“ bleiben Vorschauen statisch.

Die direkte Aktion „Dummy bearbeiten“ erhält ein sichtbares Icon mit Tooltip. Dieselbe Funktion steht im Rechtsklick-Menü. Rechtsklick ist niemals der einzige Zugang.

### 5.3 Regeln für Filter und Labels

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

## 6. Bereiche, Größen und Körpervorlagen

### 6.1 Einstellungen beim Anlegen eines Bereichs

Ein Bereich speichert Namen, Objekttyp, Körperprofil-Version, Referenzhöhe, Richtungsmodell, Standard-Framegröße, gemeinsamen Bodenanker und Labels.

**Planungsstandard:** humanoide RPG-Figur, orthografische/leicht von oben dargestellte Acht-Richtungs-Ansicht, `80 px` anatomische Referenzhöhe. Die Referenzhöhe misst die neutrale Figur vom Kopf bis zur Fußsohle, ohne überstehende Haare oder Ausrüstung.

Die Körpergröße allein bestimmt nicht sinnvoll jede Proportion. Deshalb liefert ein **versioniertes Proportionsprofil** die Größenverhältnisse, Slot-Rechtecke, Grundpositionen und Befestigungspunkte. Die Eingabe „80 px“ skaliert dieses Profil deterministisch. Anschließend wird die tatsächlich berechnete Größe angezeigt.

### 6.2 Humanoides Standardprofil: 16 Slots

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

### 6.3 Beispiel für das 80-px-Profil

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

### 6.4 Größenregeln und Änderungen

Intern wird zunächst mit dem Faktor `H / 80` aus dem Basispreset gerechnet. Slotgrößen werden auf ganze Pixel begrenzt, mindestens ein Pixel groß. Das Profil korrigiert Rundungsreste gezielt, sodass die anatomische Gesamthöhe wieder exakt `H` erreicht. Einfach alle Teilhöhen unabhängig runden und addieren ist nicht ausreichend.

Vorhandene Pixelgrafiken werden bei einer Größenänderung nicht stillschweigend skaliert. Der Import bietet unverändert übernehmen, transparent auffüllen, eine passende Variante auswählen oder bewusst neu skalieren an. Skalierung wird als sichtbare, bestätigte Bearbeitung behandelt.

Nach der ersten Verwendung wird ein Profil nicht stillschweigend überschrieben. Eine andere Größe oder Körperstruktur erzeugt eine neue Profilversion beziehungsweise einen neuen Bereich. Bestehende Vorlagen und NPCs behalten ihre bisherige Profilreferenz. Ein späterer Migrationsassistent muss Auswirkungen und Vorschau anzeigen.

### 6.5 Vorgegebene Befestigungsstruktur

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

## 7. Dummy-Editor und Cutout-Verfahren

### 7.1 Was der Nutzer tatsächlich bearbeitet

Der Dummy besteht aus starren, deutlich unterscheidbaren Teilen. Er besitzt kein Gesicht und keine dekorativen Details. Jeder Slot hat einen Namen, einen Mittelpunkt beziehungsweise Drehpunkt und definierte Befestigungspunkte. Auswahl wird durch Kontur, Griffpunkte und Text hervorgehoben, nicht nur durch Farbe.

Die Profilvorlage bringt alle Befestigungen bereits mit. Der Nutzer verschiebt und dreht Teile, ohne zunächst einen Rig-Editor bedienen zu müssen. Zusammenhängende Teile können gemeinsam verschoben werden. Unterarme bleiben beispielsweise an ihren Oberarmen befestigt.

**Technische Ehrlichkeit:** Bewegliche Teile benötigen Bezugspunkte und Beziehungen. Die interne starre Transformationshierarchie ähnelt mathematisch einem Gelenkmodell. Sie ist hier aber kein vom Nutzer zu konstruierendes Bone-Rig. Es werden weder `Skeleton2D` noch `Bone2D`, Gewichte, Skinning oder Mesh-Verformung für das Kernverfahren eingesetzt.

### 7.2 Anordnung der Oberfläche

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

### 7.3 Bearbeitungswerkzeuge

Erforderlich sind Einzel- und Mehrfachauswahl, Verschieben, Drehen, Rasterfang, Sperren, Sichtbarkeit, Kopieren/Einfügen von Posen, Zurücksetzen auf Grundpose, Spiegeln mit Vorschau und Undo/Redo.

Eine Mausbewegung wird als eine rückgängig machbare Änderung zusammengefasst, nicht als Hunderte einzelne Pixeländerungen. Numerische Eingaben erlauben reproduzierbare Werte. Beim Draggen zeigt der Inspector die tatsächlichen Werte.

Ein sichtbarer Auto-Key-Schalter entscheidet, ob eine Änderung am aktuellen Frame einen Keyframe anlegt. Ohne Auto-Key verändert eine Pose-Bearbeitung nur einen bereits ausgewählten Keyframe; andernfalls muss der Nutzer einen Keyframe anlegen. Änderungen an der Körpervorlage erfolgen ausschließlich im separaten Profilbereich, nicht versehentlich durch einen Drag im Animationseditor.

### 7.4 Pixelgenauigkeit und ihre Grenzen

Die Vorschau und der Export verwenden dieselbe fachliche Auswertung und dieselbe Referenz-Rasterung. Nearest-Neighbor-Sampling, ein transparentes Zielbild und ganzzahlige Ausgabepositionen sind der Standard. Godot bietet einen Nearest-Texturfilter; der Filter allein ersetzt jedoch nicht die korrekte Rasterung. [S10]

Beliebige Rotationen können auch ohne Unschärfe Treppenkanten, veränderte Silhouetten oder zeitliches Flimmern erzeugen. **Pixelrasterfang garantiert kein handgezeichnetes Ergebnis.** Dafür sind drei Hilfen vorgesehen: optionales Winkelraster, pro Richtung passende Teil-Sprites und alternative Sprite-Varianten für problematische Posen.

Es gibt keine automatische Weichzeichnung, keine dauerhaft aktivierte nicht-ganzzahlige Skalierung und keine Mesh-Verformung als versteckten Standard.

## 8. Timeline, Keyframes und Bewegungswiedergabe

### 8.1 Vier verschiedene Größen

| Begriff | Bedeutung |
|---|---|
| Figurenhöhe | Anatomische Größe des Dummys, im Bereich/Profil festgelegt. |
| Framefläche | Breite und Höhe eines Ausgabebildes, beim Anlegen der Animation festgelegt; Standard aus dem Bereich. |
| Frameanzahl | Anzahl der ausgegebenen Bilder eines Durchlaufs. |
| Bildrate/FPS | Wie viele Animationsbilder pro Sekunde abgespielt werden. |

Diese Größen werden in der Oberfläche nicht unter dem unklaren Begriff „Framehöhe“ vermischt. Ein Dialog „Neue Animation“ zeigt alle vier Werte, die Figurenhöhe allerdings nur als geerbte Profilinformation.

**Beispiel:** 80-px-Figur, 128 × 128-px-Frame, zwölf Frames und zwölf FPS ergeben einen einsekündigen Durchlauf. Vier gesetzte Schlüsselposen können zur Berechnung dieser zwölf Ausgabeframes genügen. Das sind zwölf gerenderte Bilder, aber nicht zwölf neu gezeichnete Figuren.

### 8.2 Daten einer Bewegung

Eine Vorlage speichert Namen, Bewegungstyp, Körperprofil-Referenz, Framefläche, Bodenanker, Frameanzahl, FPS, Schleifenmodus, Richtungsdefinitionen und Spuren. Eine Spur adressiert einen stabilen Slot oder einen ausdrücklich definierten Zusatzkanal.

Erlaubte Kerneigenschaften in Version 1 sind Verschiebung, Drehung, Sichtbarkeit, diskrete Sprite-Varianten und optionale Schichtwechsel. Nicht-ganzzahlige Skalierung ist nicht Bestandteil der Standardbewegung. Körpergröße wird über das Profil bestimmt, nicht über wechselnde Track-Skalierung.

Keyframes liegen an ganzzahligen Frameindizes. Die Standardinterpolation für Bewegungswerte ist linear; Halten und ausgewählte Ease-in/Ease-out-Kurven sind verfügbar. Sichtbarkeit, Varianten und Schichtreihenfolgen sind diskret und werden nicht gemischt. Drehwinkel verwenden standardmäßig den kürzesten Weg; bewusst größere Drehungen benötigen eine explizite Einstellung.

### 8.3 Zeitmodell und Schleifen

Die Auswertung ist eine reine Funktion: **gespeicherte Daten + Richtung + Sampleindex → Pose**. Die exportierten Bilder hängen nicht davon ab, wie schnell der Rechner zuvor die Vorschau abgespielt hat.

Für `N` gleich lange Frames bei `fps` gilt `Dauer = N / fps`; exportiert werden die Indizes `0` bis `N−1`. Bei einer Schleife wird der erste Zustand für die Interpolation gedanklich bei `N` fortgesetzt, aber nicht als zusätzliches identisches Abschlussbild exportiert.

Der interne Timeline-Zoom verändert weder Samplezahl noch Zeit. Eine Vorschau bei halber Geschwindigkeit ist nur ein Wiedergabefaktor und verändert die gespeicherte FPS-Einstellung nicht. Längeres Halten wird in Version 1 mit entsprechend gesetzten Posen beziehungsweise identischen Samples abgebildet; variable Einzelbilddauern sind eine spätere Erweiterung, kein versteckter zweiter Zeitstandard.

### 8.4 Funktionsumfang der Timeline

Spuren ein-/ausklappen, Abspielkopf scrubben, einzelne Frames vor/zurück, Keyframes hinzufügen/verschieben/löschen, Pose duplizieren, Mehrfachauswahl, Bereich kopieren, Schleife anzeigen und vorherige/nächste Pose als transparente Orientierung darstellen.

Beim Ändern der Frameanzahl wird nicht unbemerkt abgeschnitten. Der Dialog bietet „Zeitlich verteilen“ oder „Frames am Ende ergänzen/entfernen“ und zeigt betroffene Keys. Entfernen von belegten Frames erfordert eine bestätigte Vorschau. Jede Zeitänderung ist rückgängig machbar.

### 8.5 Bewegungspresets und prozedurale Hilfen

Die erste vollständige Version enthält editierbare Startpresets für **Stillstehen, Gehen, Sprinten, Springen und eine neutrale Interaktions-/Angriffsbewegung**. Sie sind Hilfen, keine Zusicherung universell fertiger Animationen für jedes Design. Ein besonders schneller Sprint kann auf dem Sprintpreset mit geändertem Timing und optionalen Effekten beruhen; es muss nicht eine dritte unabhängige Laufvorlage entstehen.

Optionale Hilfskanäle erzeugen Rumpfwippen, einfaches Nachschwingen oder eine Sprunghöhenkurve. Sie müssen in der Timeline sichtbar, abschaltbar und in normale Keyframes umwandelbar sein. Physik mit zufälligen oder nicht reproduzierbaren Ergebnissen gehört nicht in den Standardexport.

Die Figur läuft standardmäßig auf der Stelle. Eine Vorschau kann einen scrollenden Boden verwenden. Empfohlene Bewegungsgeschwindigkeit in Pixeln pro Sekunde ist Metadatum, keine automatisch eingebaute Spielsteuerung. Das Zielspiel entscheidet über tatsächliche Fortbewegung und Kollision.

### 8.6 Springen

Bodenposition, sichtbare Körperhöhe und Schatten sind getrennte Kanäle. Eine positive Sprunghöhe verschiebt den Körper nach oben; der Schatten bleibt am Bodenanker. Schatten ist eine abschaltbare Zusatzebene, keine anatomische Körperkomponente.

Der Exportmodus legt ausdrücklich fest: Sprunghöhe **im Bild enthalten** oder **nur als Kurve/Metadatum ausgeben**. Das Zielspiel darf denselben Höhenversatz nicht zusätzlich anwenden, wenn er bereits in den Frames steckt. Die Vorschau prüft Kopf, Haare und Ausrüstung auf Überschreiten der Framefläche.

## 9. Acht Richtungen und Zeichenreihenfolge

### 9.1 Einheitliche Richtungsnamen

Die Daten verwenden `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`. In der Oberfläche stehen zusätzlich Pfeile und deutsche Beschriftungen. In der festgelegten Ansicht bedeutet Süden die Frontansicht und Norden die Rückansicht; positive Bildschirm-Y-Werte zeigen nach unten.

Jede Richtung ist entweder **explizit bearbeitet**, **aus einer Quelle gespiegelt** oder **fehlend**. Diese Zustände sind sichtbar. Eine Richtung darf nur eine eindeutige Quelle besitzen; zyklische Spiegelreferenzen sind ungültig.

### 9.2 Arbeitsersparnis durch fünf Ausgangsansichten

Ein Profil kann `n`, `ne`, `e`, `se` und `s` als Quellen verwenden. `nw`, `w` und `sw` werden bei geeigneten Figuren daraus abgeleitet. Es bleiben acht nutzbare Richtungen, obwohl weniger Ausgangsposen bearbeitet werden.

Das ist eine Option und keine Pflicht. Bei asymmetrischen Figuren oder Equipment müssen einzelne Gegenrichtungen explizit gestaltet werden können. Front- und Rückansicht sowie echte perspektivische Unterschiede entstehen nicht durch horizontales Spiegeln.

### 9.3 Pose spiegeln und Bild spiegeln sind nicht dasselbe

Die Anwendung unterscheidet:

- **Pose spiegeln:** Transformationswerte werden über eine vom Profil definierte Links-/Rechts-Paarung übertragen. Danach werden die Assets der Zielrichtung gewählt.
- **Sprite spiegeln:** Ein einzelnes Bild wird nur gespiegelt, wenn die Asset-Metadaten dies erlauben.
- **Fertiges Gesamtbild spiegeln:** Nur als bewusst gewählte Abkürzung für geeignete symmetrische Figuren, nicht als unvermeidliche Exportregel.

Anatomische Slots behalten eine definierte Identität. Ausrüstung an der linken Hand darf nicht unbemerkt die Hand wechseln. Eine asymmetrische Testfigur mit nur einem farbig markierten Handschuh beziehungsweise einem einseitigen Accessoire ist Pflicht-Testmaterial. Doppelte Spiegelung muss den Ausgangszustand wiederherstellen.

### 9.4 Vordergrund, Hintergrund und Verdeckung

Das Profil enthält eine gültige Grundreihenfolge der Teile pro Richtung. Rückwärtige Arme oder Beine müssen hinter dem Körper liegen können; vordere davor. Ein zusätzliches Accessoire besitzt ebenfalls einen klaren Einfügepunkt in dieser Reihenfolge.

Für bewegungsabhängige Änderungen sind diskrete Reihenfolge-Keys möglich. Gleichrangige Einträge werden stabil nach einer definierten Tie-Break-Regel sortiert. Eine Zielrichtung verwendet ihre eigene Grundreihenfolge; das simple Umkehren der gesamten Liste ist nicht automatisch korrekt.

Haare sind fachlich ein optionaler Slot. Ein Asset darf zusätzliche vordere/hintere Darstellungsstücke besitzen, ohne die Pflichtanatomie um einen weiteren Kopf zu erweitern.

## 10. Inventar und Sprite-Import

### 10.1 Umfang des Inventars

Das Inventar enthält die Ausgangsbilder des jeweiligen Bereichs. Körperprofil und Größe sind dadurch eindeutig. Eine Projektansicht kann mehrere Inventare gesammelt anzeigen; eine Übernahme in einen anderen Bereich ist aber eine ausdrückliche Import-/Kopieraktion mit Kompatibilitätsprüfung.

Unterstützt werden zunächst transparente PNG-Einzelbilder sowie PNG-Sheets mit regelmäßigem Raster. Der Sheet-Import benötigt Zellgröße, Abstand, Rand und Zuordnung. Automatische Erkennung ist nur eine Vorschlagsfunktion.

### 10.2 Vorkonfiguration der Slots

Die zuverlässigste automatische Zuordnung erfolgt durch eine kleine JSON-Begleitdatei eines Asset-Pakets. Sie nennt Profilversion, Slot, Richtung, Variante, Ausschnitt, Bildgröße und Drehpunkt.

Als zweite Möglichkeit wird eine Dateinamenskonvention angeboten, beispielsweise `forearm_l__se__base.png`. Der Import zeigt erkannte Zuordnungen vor dem Bestätigen. Mehrdeutige Namen bleiben unzugeordnet, statt heimlich einem Slot zugewiesen zu werden.

Ein beliebiges zusammengesetztes NPC-Bild wird nicht automatisch in korrekte Oberarme, Unterarme und Hände zerlegt. Die benötigten Teile müssen im Paket vorliegen oder vorher in einem Zeichenwerkzeug getrennt werden.

### 10.3 Importprüfung

Vor der endgültigen Übernahme werden Dateiformat, tatsächliche Bildabmessungen, Alpha, Dateigröße, zulässige Ausschnitte, Profilkompatibilität und doppelte Inhalte geprüft. Transparente Ränder bleiben standardmäßig erhalten, weil sie für Pivots und Zuordnung relevant sein können.

Quellbilder werden in den Arbeitsordner kopiert. Dauerhafte Referenzen auf einen beliebigen Download-Ordner werden vermieden. Für Originaltreue bleibt das importierte Original unverändert; abgeleitete Ausschnitte können im Cache liegen. Ein Asset hat eine ID und einen Inhalts-Hash. Eine neue Bildversion ist eine neue Revision, nicht eine unsichtbare Änderung aller bisherigen Exporte.

### 10.4 Inventarbedienung

PNG-Dateien lassen sich per Dialog oder Drag-and-drop übernehmen. Rasterkarten zeigen Bild, Slot, Richtung, Profil, Labels und Verwendungsanzahl. Filter sind Dropdowns. „In Vorlage einsetzen“ weist kompatible Slots zu; „Nur importieren“ legt die Bilder ohne Ausstattung ab.

Beim Entfernen eines verwendeten Assets werden die referenzierenden NPCs beziehungsweise Zuordnungen angezeigt. Standard ist Archivieren oder Abbrechen, nicht ein unbemerktes Erzeugen kaputter Animationen.

## 11. Anziehen, Feinschliff und Ausrüstung

### 11.1 Drei klar getrennte Arbeitsmodi

**Inventar** verwaltet importierte Bilder. **Anziehen** weist ein Körper-/Ausrüstungspaket Slots zu. **Feinschliff** korrigiert dessen exakte Lage am Dummy.

Diese Modi erscheinen als oben sichtbare Tabs oder Schaltflächen. Die aktuelle Figur und ihre Vorschau bleiben erhalten; ein Tabwechsel setzt keine Arbeit zurück.

Im Modus Anziehen können ein vollständiges Asset-Paket oder einzelne Teile ausgewählt werden. Die Anwendung setzt kompatible Sprites zunächst mit den hinterlegten Pivots an die passenden Profilpunkte. Fehlende Slots werden mit neutralen Platzhaltern und einer verständlichen Liste angezeigt.

### 11.2 Platzierung und Transformationen

Der Feinschliff speichert pro Slot und Richtung Bildwahl, Pivot, lokalen Offset, optionale starre Drehkorrektur, Sichtbarkeit und Schichtkorrektur. Die Dummy-Kontur kann stufenlos von unsichtbar bis deutlich sichtbar eingestellt werden; Standard ist eine schwache Umrandung.

Die Transformationsreihenfolge wird einheitlich definiert:

```text
Slot-Weltmatrix = Elternmatrix × Profil-Grundmatrix × Animationsdelta
Bildmatrix      = Slot-Weltmatrix × NPC-Anpassung × Zuordnungs-Korrektur × Pivotversatz
```

Die Anpassungen erfolgen im lokalen Koordinatensystem des jeweiligen Slots. Ein Offset in einem gedrehten Unterarm bewegt sich daher mit dem Unterarm. Hilfen zeigen lokale Achsen und Drehpunkte an. Das Raster wird erst anhand des fertigen, zusammengesetzten Zustands angewendet; wiederholtes Runden jeder Elternstufe würde Fehler aufaddieren.

### 11.3 Korrekturen an der richtigen Stelle

| Beobachtung | Richtige Änderung |
|---|---|
| Der nackte Dummy bewegt einen Arm falsch. | Bewegungsvorlage im Dummy-Editor korrigieren. |
| Ein Sprite sitzt in jeder Bewegung zu weit links. | NPC-Aussehen im Feinschliff korrigieren. |
| Dasselbe Outfit passt nur beim Sprint an einer Stelle nicht. | Lokale Korrektur der NPC-Animationszuordnung. |
| Ein einzelnes gedrehtes Teil sieht pixelig ungünstig aus. | Alternative Sprite-Variante oder diskreten Bildwechsel verwenden. |
| Ein Accessoire liegt bei einer Richtung vor statt hinter dem Kopf. | Richtungsabhängige Schichtregel korrigieren. |

Eine laufende Vorschau, Frame-Schritte und Dummy-/Sprite-Vergleich unterstützen diese Unterscheidung. Das UI zeigt vor jedem Speichern, welcher Umfang verändert wird.

### 11.4 Rüstung, Accessoires und Equipment

Ein Ausrüstungseintrag kann aus einem oder mehreren starren Stücken bestehen. Jedes Stück besitzt einen Anheftungs-Slot, Richtungsgrafiken, Pivot und Schichtposition. Ein Kleidungsstück, das mehrere bewegliche Körperbereiche abdeckt, muss entsprechend segmentiert sein oder als bewusst starres Teil gestaltet werden. Die App verbiegt nicht automatisch ein großes Rüstungs-PNG.

Drei Einstellungen werden getrennt gespeichert:

| Einstellung | Bedeutung |
|---|---|
| `enabled` | Teil ist sichtbar und darf exportiert werden; ausgeschaltet bleibt es gespeichert, wird aber nicht gerendert. |
| `follow_mode` | Teil folgt seinem Körper-Slot oder dem Figurenursprung. Standard ist Mitführen am Körperteil. |
| `own_motion_enabled` | Zusätzliche eigene Bewegung ist aktiv, beispielsweise ein kontrolliertes Nachschwingen. |

**Keine Eigenbewegung bedeutet nicht „bleibt im Raum stehen“.** Ein statischer Handschuh folgt trotzdem seiner Hand. Seine eigenen Bewegungsregler werden grau dargestellt, während Slot und Asset weiterhin auswählbar bleiben. Ein ausgeblendetes Teil wird dagegen auch aus dem Export ausgeschlossen.

Equipment wird nicht als zusätzlicher Pflichtknochen oder anatomischer Pflichtslot angelegt. Aktivieren eigener Bewegung blendet lediglich passende Zusatzspuren ein. Diese werden deterministisch ausgewertet und können wieder abgeschaltet werden, ohne die gespeicherten Werte zu verlieren.

## 12. NPCs, Animationszuordnung und Freigaben

### 12.1 Freigabe der Dummy-Bewegung

Eine neue Vorlage startet als Entwurf. „Dummy freigeben“ prüft Profilreferenzen, Tracks, Frameeinstellungen und Richtungsabdeckung. Die Aktion erzeugt eine unveränderliche Revision und markiert sie als freigegeben. Ein späterer Bearbeitungsstand ist ein neuer Entwurf, keine stille Änderung der alten Revision.

Eine bereits freigegebene Karte bleibt beim normalen Klick im Ausstattungsfluss, auch wenn zusätzlich ein neuer Entwurf existiert. Ein Badge weist auf unveröffentlichte Änderungen hin. Das Editier-Icon öffnet den Entwurf.

### 12.2 Zustandsmodell

| Objekt | Gespeicherter Arbeitszustand | Abgeleitete Zustände |
|---|---|---|
| Bewegungsvorlage | Entwurf, freigegebene Revisionen, archiviert. | Neuere Entwurfsänderung vorhanden, Richtungen fehlen. |
| Outfit-Entwurf | In Bearbeitung, einem NPC zugewiesen. | Pflichtteile fehlen, inkompatible Bilder. |
| NPC | Entwurf, geprüft, archiviert. | Welche benötigten Bewegungen vollständig sind. |
| Animationszuordnung | Entwurf oder geprüft. | Neue Vorlagenrevision verfügbar, Export veraltet, Fehler. |
| Export | Unveränderlicher Build mit Quell-Fingerabdruck. | Aktuell oder nicht mehr aktuell. |

„Exportiert“ und „vollständig“ sind keine dauerhaften Wahrheiten: Werden Quellen geändert, muss der Exportstatus neu berechnet werden. „Neue Vorlagenrevision verfügbar“ bedeutet umgekehrt nicht, dass ein alter, bewusst festgehaltener Export automatisch kaputt ist.

### 12.3 Klick auf eine fertige Bewegung

Ist die Ansicht bereits auf einen NPC gefiltert, öffnet der Klick dessen Zuordnung. Sonst erscheint eine kompakte Auswahl: „Neuen NPC ausstatten“ oder ein vorhandener NPC aus demselben kompatiblen Bereich.

Eine Bewegungsvorlage kann mehrere NPCs bedienen. Deshalb darf der Klick auf ihre Karte nicht willkürlich einen beliebigen NPC auswählen. Die zuletzt benutzte Auswahl darf angeboten werden, bleibt aber sichtbar.

### 12.4 NPC speichern und weitere Bewegungen hinzufügen

Beim ersten Speichern werden Name, Labels und optionale Beschreibung erfragt. Der neue NPC bekommt eine stabile ID und einen physischen Ordner. Das aktive Outfit und die aktive Bewegung werden zugeordnet.

Für eine weitere Bewegung wird ausdrücklich derselbe NPC über seine ID gewählt. Die Anwendung verwendet dessen Aussehen und erstellt nur die fehlende Animationszuordnung. Ein gleicher Textname allein führt nicht zu einem automatischen Zusammenführen zweier Figuren.

Das NPC-Dashboard zeigt die Summe der zugeordneten Bewegungen, fehlende erforderliche Bewegungen, Richtungsabdeckung und Exportstatus. In der Detailansicht lässt sich zwischen allen Bewegungen und Richtungen wechseln.

### 12.5 Änderungen und Wiederverwendung

Änderungen des NPC-Aussehens wirken grundsätzlich auf seine zugeordneten Bewegungen, soweit dort kein lokaler Override hinterlegt ist. Vor einer breiten Änderung wird die Zahl der betroffenen Zuordnungen angezeigt. Raster-Caches und Export-Fingerabdrücke werden entsprechend ungültig.

Eine neue Vorlagenrevision wird nicht automatisch auf alle NPCs angewendet. Der Nutzer kann bestehende Revision beibehalten, eine neue Version mit Vergleich übernehmen oder die Vorlage abzweigen. Vor einem Update werden lokale Korrekturen auf noch gültige Slot-IDs und Richtungen geprüft.

Duplizieren eines NPCs erzeugt neue NPC- und Zuordnungs-IDs, darf aber unveränderliche Assets und Vorlagenrevisionen innerhalb desselben Bereichs weiter referenzieren. Projektübergreifendes Kopieren muss seine Abhängigkeiten vollständig mitnehmen und IDs nötigenfalls abbilden.

### 12.6 Umgesetzter P15-Anwendungsvertrag

Der area-scoped React-Arbeitsbereich `NpcWorkspace` erhält Sitzungs-ID und stabile Bereichs-ID vom
Desktop-Router. Native Commands lösen daraus den relativen Bereichspfad innerhalb des gehaltenen
Vault-Locks auf; Dateipfade überschreiten die Frontend-Vertrauensgrenze nicht. Sein Umschalter
zwischen Animationen und NPCs behält Bereichs-, Character- und Binding-ID. Eine aus dem
Animationsdashboard geöffnete Bewegung kehrt dadurch zur gezielten Zuordnung statt zu einer
willkürlichen Figur zurück. Freitext ist ausschließlich die Namenssuche. Labels,
Vollständigkeit, benötigte Bewegung, Exportstatus, Freigabestatus und Sortierung sind
strukturierte Dropdowns.

Der Rust-`BindingService` ist die einzige Schreibgrenze für P15. Eine weitere Bewegung verwendet
die Standard-Aussehens-ID des über seine stabile ID gewählten NPCs und genau eine freigegebene,
festgehaltene Vorlagenrevision. Ohne Variantenangabe gilt der `action_key` der Vorlage. Eine
Variante muss als eigener gültiger Schlüssel angegeben werden; ein bereits aktiver Schlüssel wird
abgewiesen. Lokale Overrides schreiben ausschließlich `binding.json`, setzen dessen Prüfung auf
Entwurf zurück und verändern weder `appearance.json` noch die unveränderliche Motionrevision.

Neue Releases erscheinen als Angebot mit Vergleich von Framezahl, FPS, Richtungsabdeckung und
beibehaltenen lokalen Korrekturen. Unter mehreren neueren Releases wird die jüngste kompatible
Revision angeboten; existiert keine, erklärt das jüngste inkompatible Release den Blocker. Die
Übernahme ist eine ausdrückliche CAS-geschützte Aktion und prüft die exakte Profilrevision,
weiterhin vorhandene Slots und Richtungen sowie das bestehende Equipment. Für P14-Equipment gibt
es keine stille Zeitachsenumrechnung: Liegt ein beibehaltener Equipment-Key außerhalb des
Framebereichs der Zielrevision, ist diese Revision inkompatibel. Die bisher festgehaltene Revision
bleibt dabei unverändert. Ungespeicherte Overrides werden pro Binding gehalten; ein Reload nach
einer anderen Mutation verwirft sie nicht, und nur das erfolgreich gespeicherte Binding wird als
sauber markiert.

Duplizieren erzeugt neue Character-, Appearance- und Binding-IDs in einem gestuften NPC-Ordner,
referenziert aber dieselben unveränderlichen Asset- und Motionrevisionen. Umbenennen verschiebt den
vollständigen NPC-Ordner unter Journalführung und ändert nur Anzeigename, Dokumentrevision und
Zeitstempel; ID-Referenzen bleiben stabil. Die Exportanzeige vergleicht das jüngste gefundene
Manifest mit einem kanonischen Fingerabdruck der effektiv festgehaltenen Profile, Motionrevisionen,
Bildrevisionen, Fittings und lokalen Overrides. Reine Prüf- und Änderungsmetadaten der
veränderlichen NPC-Dokumente sowie ungenutzte neuere Vorlagenreleases ändern diesen
Fingerabdruck nicht. Fremde oder beschädigte abgeleitete JSON-Dateien unter Exportordnern werden
bei der Quellinventur ignoriert; beschädigte autoritative Vault-Dokumente bleiben ein harter Fehler.

## 13. Arbeitsordner und physische Dateistruktur

### 13.1 Grundsatz

Der Arbeitsordner ist unabhängig vom Programm-Installationsordner und vom GitHub-Checkout. Die App darf in ihren Installationsdateien keine Nutzerprojekte speichern. Ein vollständig kopierter Vault muss sich auf einem anderen unterstützten Desktop wieder öffnen lassen.

Die gewünschte sichtbare Fachstruktur bleibt erhalten:

```text
Arbeitsordner / Projekt / Bereich / NPC / Animation
```

Hilfsdaten für Vorlagen, Inventar und Profile werden auf der jeweils passenden Ebene abgelegt. Sie werden nicht in einen globalen Ordner verlagert.

### 13.2 Verbindlicher Strukturvorschlag

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

### 13.3 Benennung und Referenzen

Ordnernamen bestehen aus einem bereinigten Anzeigenamen und einem ID-Suffix. Unzulässige Betriebssystemzeichen, reservierte Namen, abschließende Punkte/Leerzeichen und kollidierende Groß-/Kleinschreibung werden geprüft. Bei einer Kollision wird das ID-Suffix verlängert. Vom Nutzer eingegebene Namen werden nicht direkt als Pfade verwendet.

Normale Objekt-Namen sollen innerhalb derselben Geschwisterebene eindeutig sein. IDs bleiben trotzdem notwendig. Umbenennen aktualisiert Metadaten und, falls der lesbare Ordnername angepasst wird, den Ordner über eine kontrollierte Dateitransaktion. Zuordnungen bleiben wegen der IDs intakt.

Verweise innerhalb des Vaults werden über IDs aufgelöst. Gespeicherte Asset-Unterpfade sind relativ zu ihrem zuständigen Bereich. Absolute Maschinenpfade sind in portablen Projektquellen und Exporten verboten.

### 13.4 Was dauerhaft gespeichert wird

Autoritativ sind JSON-Quellen, Profil-Snapshots, importierte PNGs und die verwendeten Revisionen. Vorschau-Bilder, Suchindizes und fertig gerenderte Exporte sind abgeleitete Daten und müssen neu erzeugbar sein.

Ein JSON-Verzeichnisbaum ist kein Anlass, zusätzlich SQLite oder eine andere versteckte Datenbank einzubauen. Listen und Suchen arbeiten zunächst mit einem neu aufbaubaren In-Memory-Index; ein optionaler JSON-Cache ist ausschließlich eine Beschleunigung.

## 14. Datenverträge und Versionsregeln

### 14.1 Gemeinsame Regeln

Jede autoritative JSON-Datei enthält `schema_version`, `kind` und eine stabile Objekt-ID beziehungsweise eine eindeutig zugeordnete Revision. Veränderliche Objekte enthalten eine monotone `revision`, Zeitstempel und Elternreferenz. Zeitstempel sind UTC-Zeichenketten; sie bestimmen nicht allein die fachliche Identität oder Export-Aktualität.

IDs werden als UUID-Strings erzeugt und verglichen, nicht als Fließkommazahlen. Ganzzahlige Felder werden beim Einlesen ausdrücklich validiert. Vektoren sind kleine Zahlenarrays oder Objekte nach festem Schema. Unbekannte zukünftige Schema-Versionen werden nicht mit einer alten Version überschrieben.

In Version 1 verwenden alle nicht ausdrücklich optionalen Referenzen gültige IDs. Verwaiste Referenzen erzeugen eine Reparaturmeldung und blockieren betroffene Exporte. Sie werden nicht stillschweigend durch irgendein ähnlich benanntes Objekt ersetzt.

### 14.2 Vertragsübersicht

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

### 14.3 Wichtige Validierungen

Für jede aktive Spur existiert ein Slot. Ein Slot hat höchstens einen Eltern-Slot. Spiegelquellen existieren und bilden keinen Zyklus. Jeder exportierte Frame verweist auf ein vorhandenes Bildrechteck innerhalb einer PNG-Seite. Frameanzahl und FPS sind positiv und begrenzt. Es gibt keine NaN- oder unendlichen Zahlen.

Eine Zuordnung darf keine Vorlage einer inkompatiblen Profilrevision erhalten. Eine Größenänderung wird nicht allein durch übereinstimmende Namen als kompatibel betrachtet. Ein NPC hat je `action_key` höchstens eine aktive Zuordnung; bewusst verschiedene Varianten verwenden andere Schlüssel, etwa `walk` und `walk_carry`.

Zunächst gelten als Planungsgrenzen: Figurenhöhe 16–512 px, Framefläche je Achse höchstens 1024 px, 1–1024 Frames und 1–120 FPS. Dies sind Produktgrenzen, keine behaupteten Engine-Maximalwerte. Der Speicherbedarf wird zusätzlich vor dem Rendern berechnet und kann strengere Grenzen erfordern.

### 14.4 Referenzen, Kopien und Revisionen

Vorlagenrevisionen, Profilrevisionen und importierte Bildrevisionen sind nach Veröffentlichung unveränderlich. Änderungen erzeugen neue Revisionen. Dadurch können alte Zuordnungen reproduzierbar bleiben.

Eine exportierte Animation referenziert die **effektiv verwendeten** Revisionen, nicht pauschal die jeweils neuesten Daten. Nicht verwendete neue Revisionen machen bestehende Exporte nicht automatisch ungültig. Ändern sich aber tatsächlich referenzierte veränderliche Fitting-Daten, wird die betroffene Ausgabe als veraltet markiert.

Der Quellen-Fingerabdruck berücksichtigt verwendete Profile, Vorlagen, Bildinhalte, Fitting, Overrides, Exportoptionen und Rasterer-Version. Nur eine neue Uhrzeit darf keinen neuen visuellen Build erzwingen. JSON wird für den Fingerabdruck kanonisch normalisiert; zufällige Dictionary-Reihenfolgen sind ungeeignet.

## 15. JSON-Beispiele

Die folgenden Ausschnitte erklären die Formate. Sie sind **keine vollständig ladbare Beispiel-Vault**; vollständige, schemageprüfte Fixtures werden in den Implementierungsphasen angelegt. Die IDs sind beispielhafte UUIDs.

### 15.1 Bereich mit 80-px-NPC-Profil

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

### 15.2 Ausschnitt einer Bewegungsspur

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

### 15.3 Animationszuordnung eines NPCs

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

### 15.4 Ausrüstung ohne Eigenbewegung

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

## 16. Render- und Exportpipeline

### 16.1 Quellenformat und Ausgabeformat nicht verwechseln

**Bearbeitbare Quelle:** JSON-Tracks, Profile, Fitting und die ursprünglichen Körper-/Equipment-PNGs.
**Standard-Spielausgabe:** gebackene PNG-Sprite-Sheets plus JSON-Metadaten.
**Zusätzliche Engine-Ausgabe:** Godot-Ressourcen, die diese PNGs referenzieren.
**Optional:** vollständige Einzel-PNG-Sequenzen.

Es wird kein proprietärer, undurchsichtiger Container als einziges Arbeitsformat eingeführt. Ein ZIP-Paket darf als Transportverpackung dienen, ersetzt aber nicht die Ordnerstruktur der geöffneten Vault. Eine `.tres`-Datei allein ist ebenfalls kein Ersatz für die Studio-Quelldaten.

### 16.2 Gemeinsame Auswertung

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

### 16.3 Referenz-Rasterer

Für Version 1 wird ein prüfbarer CPU-Rasterer auf Godot-`Image`-Basis vorgesehen. Bilder können über Godot geladen und als PNG gespeichert werden. [S7]

Statische und ganzzahlig verschobene Teile erhalten einen schnellen Kopier-/Compositing-Pfad. Gedrehte Teile werden innerhalb ihrer Zielbegrenzung per inverser starrer Transformation und Nearest-Sampling abgetastet. Bildpixel werden nicht weich interpoliert. Die Sample-Punkte und die Behandlung von Randpunkten werden ausdrücklich definiert.

Die endgültige Ursprungslage wird nach dem Zusammensetzen der Transformationskette quantisiert. Rundung für negative und positive Werte wird einheitlich implementiert und getestet. Für Alphakomposition gilt eine dokumentierte Source-over-Regel auf RGBA8, mit reproduzierbarer Ganzzahl-Rundung; vollständig transparente Pixel werden auf transparente schwarze Werte normalisiert.

Vollständig plattformidentische Pixel sind ein **zu prüfendes Qualitätsziel**, kein aus der Frameworkwahl automatisch folgendes Versprechen. Golden-Image-Tests vergleichen dekodierte RGBA-Pixel. Identische PNG-Bytes werden nur verlangt, wenn Encoder und Metadaten kontrolliert identisch sind.

Bei zu langsamer GDScript-Rasterung wird zuerst gecacht, blockweise gearbeitet und gemessen. Eine native Beschleunigung benötigt einen gesonderten Entscheid und muss dieselben Referenzbilder erzeugen. Ein zweiter ungeprüfter Renderer ist keine zulässige Abkürzung.

### 16.4 Atlasaufbau

Standard ist ein regelmäßiges Raster mit gleicher Framegröße. Die Richtungssortierung ist fest und in JSON enthalten. Innerhalb einer Richtung folgen die Samples in Timeline-Reihenfolge.

Automatisches Beschneiden transparenter Ränder und Rotieren gepackter Frames sind standardmäßig ausgeschaltet. Sonst könnten Bodenanker und Animation beim Abspielen springen. Jeder Frame besitzt einen expliziten Rechteck-Eintrag, sodass mehrere Atlas-Seiten möglich bleiben.

Die maximale Atlas-Seite ist im Exportprofil begrenzt, zunächst auf 4096 × 4096 px. Dies ist ein bewusstes Produktlimit, keine pauschale Hardwareaussage. Passt der Clip nicht auf eine Seite, werden weitere Seiten erzeugt. Der Export versucht nicht, beliebig große Texturen oder alle NPCs gleichzeitig im Speicher zu halten.

Standardpadding ist null für das gleichmäßige, ungefilterte Raster. Ein optionaler Rand-/Extrusionsmodus ist getrennt konfigurierbar und muss in den Frame-Rechtecken korrekt berücksichtigt werden. Die tatsächliche Pixelgrafik wird dabei nicht skaliert.

### 16.5 Metadaten pro Animation

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

### 16.6 Exportdialog und Prüfungen

Der Exportdialog bietet NPC/Zuordnung, Richtungen, Format, maximale Seitengröße, Einzelbilder ein/aus, Schatten ein/aus, Sprunghöhe gebacken/extern und ein optionales Zielverzeichnis. Gespeicherte Exportprofile reduzieren wiederholte Eingaben.

Vor dem Schreiben werden Vollständigkeit, Referenzen, Richtungsabdeckung, verfügbare Bildgrößen, Clipping, Speicherschätzung und Namenskollisionen geprüft. Ein vollständiger NPC-Export blockiert bei fehlenden Pflichtdaten. Ein absichtlich unvollständiger Testexport ist möglich, muss aber eindeutig als solcher gekennzeichnet werden.

Der Export wird in einem neuen Build-Verzeichnis erzeugt. Erst nach erfolgreicher Prüfung wird `current.json` auf diesen Stand gesetzt. Ein Abbruch oder Fehler darf den letzten guten Export nicht beschädigen. Fortschritt und Abbruch bleiben bedienbar; nur temporäre Daten des eigenen Jobs werden aufgeräumt.

### 16.7 Gemeinsame Größe eines NPC-Pakets

Für zusammengehörige Animationen sollen Framefläche und Bodenanker gleich sein. Weichen sie ab, warnt der Paketexport und bietet ein gemeinsames transparentes Padding an. Er skaliert nicht ungefragt alle Bilder. Der Paketmanifest-Anker muss mit den tatsächlich ausgegebenen Frames übereinstimmen.

Einzelbildexport verwendet richtungsgetrennte Ordner und nullaufgefüllte Nummern. Er bleibt eine Komfortoption für andere Werkzeuge, nicht die primäre Speichermethode jedes bearbeiteten Zwischenzustands.

## 17. Godot-Export und Einbindung in Spiele

### 17.1 Zielpaket

Ein vollständiger NPC-Export enthält PNG-Sheets, ein allgemeines JSON-Manifest, eine `SpriteFrames`-Ressource (`sprite_frames.tres`) und optional eine kleine Szene mit `AnimatedSprite2D` (`character.tscn`).

Godot unterstützt Animationen aus Einzelbildern oder Sprite-Sheets. `SpriteFrames` hält die Animationssequenzen; `AtlasTexture` kann die Teilrechtecke einer Atlasgrafik adressieren. Daher passt ein PNG-plus-Metadaten-Export zu diesem Ziel. [S11–S13]

Die Engine-Dateien sind **ableitbare Ausgabe**, nicht das Bearbeitungsformat des Studios. Das allgemeine JSON bleibt verfügbar, damit die Ausgabe auch in anderen Engines weiterverarbeitet werden kann.

### 17.2 Namens- und Ressourcenvertrag

Animationsnamen lauten beispielsweise `idle_s`, `walk_s`, `walk_ne`, `sprint_w` und `jump_n`. Alle acht Richtungen werden im Standardpaket vollständig ausgegeben; das Zielspiel muss keine zusätzliche Spiegelregel erraten.

Die Godot-Dateien referenzieren PNGs über portable Ressourcenpfade innerhalb des exportierten Pakets. Maschinenspezifische absolute Pfade und Pfade in die ursprüngliche Vault sind verboten. Relative externe Ressourcenpfade sind im Godot-Textformat vorgesehen; ihre tatsächliche Verwendung im erzeugten `.tres`-/`.tscn`-Paket wird durch einen frischen Importtest abgesichert. [S14]

Der Exporter darf Ressourcen-Text kontrolliert erzeugen, muss dabei Strings und IDs korrekt escapen und anschließend mit Godot selbst validieren. Das blinde Speichern einer zur Laufzeit aus einer externen PNG erzeugten Textur kann zu eingebetteten Bilddaten statt der beabsichtigten externen Datei führen; das Format wird deshalb ausdrücklich geprüft. [S15]

### 17.3 Darstellungsregeln im Zielspiel

Die mitgelieferte Szene besitzt einen Figurenursprung am Boden. Das Sprite verwendet den exportierten Bodenanker als negativen Bildoffset und keine widersprüchliche zusätzliche Zentrierung. Texturfilter ist Nearest. Ein Richtungswechsel behält denselben Bodenbezug.

Die Szene enthält keine erzwungene Spielsteuerung, Kollisionslogik oder zusätzliche Knochen. Das Spiel wählt Aktion und Richtung und startet die passende Animation. Ein Sprungmodus ist im Manifest vermerkt, damit das Spiel nicht doppelt vertikal versetzt.

Für Bildraten übernimmt `SpriteFrames` die exportierte Animations-FPS. Bei später eingeführten variablen Dauern muss die relative Dauer nach dem `SpriteFrames`-Vertrag umgerechnet werden; in Version 1 bleiben die Samples gleich lang. [S11]

### 17.4 Verbindlicher Integrationstest

Ein Export wird in ein **frisches temporäres Godot-Projekt** kopiert. Dort werden PNGs importiert und die Ressourcen geladen. Der Test zählt Animationsnamen und Frames, prüft Atlasrechtecke und lädt die erzeugte Szene. Das Paket wird zusätzlich in ein anders benanntes Unterverzeichnis verschoben und erneut geprüft.

Kein Test darf nur deshalb bestehen, weil der Entwickler-Rechner noch alte `.godot`-Importdaten oder Pfade zur ursprünglichen Vault besitzt. Die zunächst zugesicherte Kompatibilität gilt für die geprüfte Godot-Version 4.7.2. Weitere Godot-4-Versionen werden nur nach tatsächlichem Test als unterstützt dokumentiert.

## 18. Softwarearchitektur und Repository-Struktur

### 18.1 Trennung der Verantwortlichkeiten

| Schicht | Verantwortung | Darf nicht |
|---|---|---|
| Fachmodelle | Projekte, Profile, Vorlagen, Aussehen, Zuordnungen, Validierung. | Auf konkrete React-Komponenten oder Dateidialoge angewiesen sein. |
| Anwendungsdienste | Abläufe wie NPC speichern, Vorlage freigeben, Export starten. | Fachzustand ausschließlich in UI-Controls verstecken. |
| Speicherung | JSON lesen/schreiben, IDs auflösen, Revisionen, Recovery. | Beliebige ungeprüfte Pfade aus UI-Text übernehmen. |
| Animation/Rendering | Samples, starre Transformationen, Rasterung, Atlasaufbau. | Vom Echtzeit-Abspielverlauf oder Zufall abhängen. |
| Oberfläche | Navigation, Auswahl, Inspector, Timeline, Vorschau. | Nebenbei autoritative Dateien ohne Rust-Service schreiben. |
| Adapter | Nativer Dialog, Dateisystem, Godot-Paketexport, Diagnose. | Allgemeine Fachmodelle an ein bestimmtes Exportformat ketten. |

Runtime-Modelle sind typisierte Rust-Strukturen mit passenden TypeScript-DTOs. Ihre Persistenz
bleibt ausdrücklich JSON; UI-Zustand oder Tauri-interne Objekte werden nicht unkontrolliert als
Quellformat serialisiert.

### 18.2 Vorgesehene Dienste

`VaultService` öffnet und schließt Arbeitsordner. `JsonStore` validiert und schreibt einzelne Dokumente. `TransactionService` koordiniert mehrteilige Änderungen und Recovery. `ObjectIndex` löst IDs auf. `ProfileService` erstellt versionierte Körperkonfigurationen. `AnimationSampler` berechnet Posen. `DirectionResolver` behandelt Spiegelungen und explizite Ansichten. `PixelCompositor` rendert das Referenzbild. `AppearanceService` verwaltet Zuordnung und Feinschliff. `BindingService` verwaltet NPC-Übersichten, lokale Zuordnungsänderungen, explizite Revisionsübernahmen sowie stabile Duplizier- und Umbenennungsvorgänge. `ExportService` erstellt generische Builds. `GodotExporter` erzeugt die Engine-Dateien. `PreviewCache` hält begrenzte, neu aufbaubare Vorschaudaten.

Eine zentrale Command-Abstraktion verbindet Änderungen mit Undo/Redo, Dirty-Status und Autosave. Speichern ist nicht an zufällige Signalreihenfolgen mehrerer Panels gekoppelt.

### 18.3 Passende Erweiterung der vorhandenen Struktur

```text
frontend/
├── src/
│   ├── app/                         # Shell, Navigation, Store und Commands
│   ├── api/                         # einziger Tauri-IPC-Zugang
│   ├── domain/                      # TypeScript-Verträge und pure UI-nahe Regeln
│   ├── features/                    # Dashboards und Editoren
│   ├── components/                  # Karten, Dropdowns und Dialoge
│   └── styles/
└── tests/

src-tauri/
├── src/
│   ├── domain/                      # autoritative Modelle und Validierung
│   ├── application/                 # fachliche Anwendungsfälle
│   ├── storage/                     # Vault, JSON, Pfade, Journal und Revisionen
│   ├── animation/                   # Sampling, Richtungen, Posen und Presets
│   ├── rendering/                   # CPU-Compositor, Atlas und Cache
│   ├── exports/                     # generischer und Godot-Exporter
│   └── commands/                    # dünne IPC-Grenze
├── resources/                       # Basisprofile und Startbewegungen
└── tests/                           # Integration, Goldens und Fixtures

docs/developer/
├── features/pixelcutoutsprite-studio.md
├── plans/pixelcutoutsprite-execplan.md
├── prompts/pixelcutoutsprite/
└── decisions/                      # Entscheidungen während der Umsetzung

tools/                              # vorhandenes portables Python-Tooling erhalten
project-tooling.toml                # desktop-local und Produktpfade
```

Diese Struktur ist ein Zielbild. Produktcode bleibt außerhalb der portablen Tooling-Grenze.
Frontend und Tauri-Host bilden gemeinsam eine Desktop-App, kein paralleles zweites Produkt.

### 18.4 Tooling und Versionierung

`python tools/control.py` bleibt der führende Einstieg. Vorhandene Quality-, Test- und
Tauri-Desktop-Befehle werden erhalten oder nachvollziehbar weiterentwickelt. Neue Befehle wie
`studio validate-vault` oder `studio export-fixture` sind **geplante Erweiterungen**, keine
Behauptung über bereits vorhandene Befehle.

Produktname, Repository-Metadaten, Dokumentationslinks und Paketbezeichnungen werden vom
generischen Template auf PixelCutoutSprite angepasst. Die bestehende Lizenz wird nicht
stillschweigend geändert. Toolchain-Downloads werden nur mit geprüfter Herkunft und
dokumentierter Version automatisiert.

## 19. Speichern, Wiederherstellung und Sicherheit

### 19.1 Öffnen und Initialisieren

Ein neuer leerer Ordner wird nach bewusster Auswahl initialisiert. In einem nicht leeren Ordner ohne gültige Vault-Metadaten zeigt die App vorab, welche Verwaltungsdateien sie anlegen würde. Vorhandene fremde Dateien bleiben unangetastet.

Ein Ordner mit ungültigen Metadaten wird nicht als vermeintlich leerer Arbeitsordner überschrieben. Stattdessen gibt es Diagnose, schreibgeschützte Ansicht soweit möglich und Wiederherstellungsoptionen.

Gerätespezifisch darf die App außerhalb des Vaults eine kleine Einstellungsdatei für zuletzt geöffnete Pfade und Fensterpositionen führen. Dort liegen keine autoritativen NPCs oder Animationen. Diese ausdrückliche Ausnahme ist nötig, um einen zuletzt verwendeten Ordner überhaupt wieder anbieten zu können.

### 19.2 Schreibstrategie

Ein einzelnes JSON-Dokument wird zunächst vollständig in eine temporäre Datei im selben Verzeichnis geschrieben, geschlossen und erneut validiert. Der vorherige gültige Stand bleibt bis zum erfolgreichen Austausch erhalten.

Änderungen an mehreren Dateien oder Ordnern erhalten eine Transaktions-ID und ein kleines JSON-Journal mit geplanten Schritten. Die Schritte sind wiederaufnehmbar beziehungsweise rückrollbar. Ein Erfolgsmarker wird zuletzt geschrieben. Ein Neustart prüft offene Journale und bietet eine eindeutige Wiederherstellung an.

**Keine falsche Atomaritätsgarantie:** Mehrere Dateischreibvorgänge sind nicht automatisch eine Datenbanktransaktion. Stromausfall, Windows-Dateisperren und unterschiedliche Dateisysteme werden über Fehlerbehandlung und Recovery berücksichtigt. Das konkrete Austausch-/Umbenennungsverhalten der Dateisystem-APIs ist pro Plattform zu testen. [S3, S4]

### 19.3 Autosave und Undo/Redo

Vollendete Bearbeitungsaktionen lösen einen verzögerten Autosave aus; als Startwert sind etwa zwei Sekunden Ruhe nach einer Aktion vorgesehen. Dauerhafte Freigaben und Exportstände entstehen trotzdem nur durch ausdrückliche Aktionen.

Der Speichermodus zeigt „Ungespeichert“, „Speichert“, „Gespeichert“ oder „Speicherfehler“. Bei Fehlern bleibt der aktuelle Arbeitsspeicherzustand erhalten und die App bietet erneut speichern beziehungsweise eine sichere Kopie an. Navigation und Schließen dürfen ungespeicherte Änderungen nicht still verwerfen.

Undo/Redo gilt für Posen, Timeline, Fitting und Slotzuordnung. Speichern löscht die Undo-Historie der laufenden Sitzung nicht. Löschen eines ganzen Projekts oder ein Schema-Upgrade ist keine gewöhnliche Undo-Aktion und verwendet gesonderte Sicherung/Bestätigung.

### 19.4 Ein Schreiber pro Vault

Version 1 unterstützt einen aktiven schreibenden App-Prozess je Vault. Ein zweiter Prozess erhält eine schreibgeschützte Öffnung oder die klare Meldung, dass der Ordner bereits bearbeitet wird.

Der Lock verwendet einen eindeutig beanspruchten Lock-Pfad, Instanzkennung und kontrollierte Lebenszeichen. Ein vermeintlich alter Lock wird nicht allein wegen einer kurzen Zeitüberschreitung gelöscht. Nach einem Absturz ist eine erklärte Wiederherstellung nötig. Netzwerkfreigaben und gleichzeitig synchronisierte Mehrrechner-Bearbeitung sind kein unterstützter kollaborativer Modus.

### 19.5 Fremde Änderungen und Migrationen

Vor einem Austausch wird geprüft, ob die gespeicherte Revision noch der gelesenen Revision entspricht. Eine externe Änderung führt zu einer Konfliktmeldung mit Optionen zum neu Laden oder getrennten Sichern, nicht zum automatischen Überschreiben.

Jede Formatmigration hat eine bekannte Ausgangs- und Zielversion, Tests und einen Backup-Schritt. Zukünftige unbekannte Versionen werden nur lesend geöffnet oder abgelehnt. Migration darf unbekannte Nutzerdaten nicht still entfernen.

### 19.6 Vertrauensgrenzen

Importiert werden nur erlaubte Datenformate. PNG-Dekodierung und JSON-Verarbeitung haben Größenlimits. Für erste Produktgrenzen gelten maximal 32 MiB komprimierte PNG-Dateigröße und maximal 64 MiB dekodierte RGBA-Daten pro importiertem Bild. Das sind konfigurierbare Schutzgrenzen, keine generellen PNG- oder Engine-Limits.

Nutzerdateien werden nicht als GDScript, `.tscn`, `.tres` mit angehängtem Script oder beliebiges ausführbares Plugin geladen. Der Godot-Exporter erzeugt kontrollierte eigene Dateien, führt aber nichts aus der Vault als Nutzercode aus.

Pfad-Traversal, absolute Pfade in Importmanifesten, ungültige Dateinamen und Verweise außerhalb der zuständigen Wurzel werden abgewiesen. Symbolische Links werden nicht blind rekursiv verfolgt. Die Pfadprüfung muss am tatsächlichen Dateisystem erfolgen; reine String-Präfixvergleiche reichen nicht. Verbleibende Betriebssystem-Race-Bedingungen werden dokumentiert und nicht durch überzogene Sicherheitsversprechen verdeckt.

Die App funktioniert ohne Login, Cloud-Dienst oder Telemetrie. Laufzeit-Netzwerkzugriffe sind für Version 1 nicht erforderlich. Logs enthalten keine kopierten Bildinhalte oder unnötigen privaten Vollpfade.

## 20. Desktop-Bedienung und Qualitätsziele

### 20.1 Desktop-Layout

Planungsgröße ist ein gut nutzbares Fenster von ungefähr 1440 × 900 px; Mindestlayout wird bei 1280 × 720 px geprüft. Das sind Layoutziele, keine festgeschriebene Monitorauflösung. Panels sind verstellbar oder einklappbar.

Die Oberfläche skaliert für Desktop-DPI unabhängig von der Pixelart-Zeichenfläche. Das gesamte Studio wird nicht einfach wie ein niedrig aufgelöstes Spiel hochgezogen. Rasteransicht und 1:1-Vorschau verwenden kontrollierte ganzzahlige Pixelvergrößerung.

Das Theme soll ruhig, kontrastreich und werkzeugorientiert sein. Status braucht immer Text oder Form zusätzlich zur Farbe. Unvollständige und nicht verfügbare Aktionen erklären ihren Grund.

### 20.2 Tastatur und Maus

Wichtige Aktionen funktionieren ohne Rechtsklick. Tab-Reihenfolge, sichtbarer Fokus, Esc zum Schließen eines Dialogs und Enter zum Bestätigen sind konsistent.

Vorgesehene Kürzel sind Strg/Cmd+S zum Speichern, Strg/Cmd+Z für Undo, eine plattformpassende Redo-Kombination, Leertaste für Wiedergabe und Links/Rechts für Frame-Schritte außerhalb von Texteingaben. Mittlere Maustaste verschiebt die Zeichenfläche; Strg/Cmd+Mausrad verändert den Zoom. Ein aktives Textfeld fängt seine eigenen Tasten ab, statt versehentlich die Timeline zu verändern.

### 20.3 Messbare, noch nicht nachgewiesene Ziele

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

## 21. Tests und Abnahmeszenarien

### 21.1 Testebenen

Fachtests prüfen IDs, Verträge, Referenzen, Zustände, Rundung, Sampling, Spiegelungen und Export-Fingerabdrücke. Dateisystemtests verwenden ausschließlich temporäre Test-Vaults. UI-Tests und manuelle Desktop-Checks ergänzen die fachlichen Prüfungen. Goldens vergleichen kleine, bekannte RGBA-Bilder. Native Smoke-Tests prüfen Start, Dateidialog und einen minimalen Workflow auf jeder zugesicherten Desktop-Plattform.

Neue Testpakete werden nur begründet übernommen. Die vorhandene Testinfrastruktur bleibt Ausgangspunkt. „Nicht ausgeführt“ wird als solcher Status dokumentiert, niemals als bestanden.

### 21.2 Verbindliche Ende-zu-Ende-Abnahmen

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

### 21.3 Zusätzliche Negativtests

Unbekannte Schema-Version, ungültiges JSON, doppelte IDs, zyklische Elternbeziehung, zyklische Spiegelung, Null-FPS, leere Framefolge, übergroßes PNG, außerhalb liegendes Atlasrechteck, fehlender Asset-Hash, ungültiger Ressourcenname, Unicode-/Großschreibungs-Kollision, `../`-Pfad und externe symbolische Verknüpfung.

Die Abwesenheit unerwünschter Architektur wird ebenfalls geprüft: kein SQL-Backend, keine notwendige Bone-/Skeleton-Komponente, keine mobile/webbasierte Studio-Ausgabe und keine Laufzeit-Pflicht zu einem Python-Prozess.

## 22. Lieferumfang, Meilensteine und Risiken

### 22.1 Vollständige erste Version

Zur ersten vollständigen Version gehören Arbeitsordner, Projekt-/Bereichsverwaltung, Labels und Dropdown-Filter, humanoide Profile, Dummy-Editor, Timeline, acht Richtungen, Startbewegungen, Inventar, Ausstattung, Feinschliff, Equipmentoptionen, NPC-Sammlung, Revisionen, PNG-/JSON-Ausgabe, Godot-Paket, Autosave, Undo/Redo, Recovery und geprüfte Desktop-Builds.

Ein frühes Inkrement darf nur eine Richtung und eine Bewegung enthalten, um die Pipeline zu beweisen. Es wird dann als Inkrement gekennzeichnet und nicht als Erfüllung der Acht-Richtungs-Anforderung ausgegeben.

### 22.2 Reihenfolge ohne Zeitversprechen

| Meilenstein | Phasen | Beobachtbares Ergebnis |
|---|---|---|
| A — Grundlage | P00–P06 | Repository angepasst, Desktop-Shell, Datenverträge, Vault, Dashboards, Bereiche, Animationskarten. |
| B — Bewegungen | P07–P11 | Gemeinsamer Rasterer, Dummy, Timeline, acht Richtungen und editierbare Bewegungspresets. |
| C — Figuren | P12–P15 | Inventar, Anziehen, Feinschliff, Equipment und NPCs mit mehreren Bewegungen. |
| D — Spieleinbindung | P16–P17 | Portabler PNG-/JSON-Export und validiertes Godot-Paket. |
| E — belastbare Version | P18–P22 | Recovery-Härtung, Desktop-Qualität, native Builds, Anleitung, vollständige Abnahme. |

### 22.3 Bewusst spätere Funktionen

Andere Körperformen und Bäume, getrennte Augen-/Gesichtsebenen, vollständiger Pixel-Painter, automatische Generierung neuer Perspektiven, 3D-Rendering als Quelle, KI-Generierung, komplexe Stoffsimulation, Mehrbenutzer-Synchronisation, Marktplatz, Plugin-Ausführung aus Nutzerpaketen und direkte Anbindung an weitere Game-Engines gehören nicht in den ersten Pflichtumfang.

Die Profil- und Export-Schnittstellen werden erweiterbar gehalten. Es werden jedoch keine leeren, großflächigen Frameworks für noch unbestimmte Erweiterungen gebaut.

### 22.4 Wichtigste Risiken und Gegenmaßnahmen

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

## 23. Rückverfolgbarkeit der Anforderungen

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

## 24. Umsetzung mit den Phasenprompts

Die Begleitdateien enthalten **23 aufeinander aufbauende Phasen P00 bis P22**, einen übergeordneten Arbeitsauftrag und einen Fortsetzungsauftrag. Jede Phase nennt Abhängigkeiten, konkreten Auftrag, erwartete Dateien/Ergebnisse und ein überprüfbares Gate.

Die Reihenfolge ist verbindlich, sofern ein dokumentierter Grund keine Abhängigkeiten verletzt. Tests werden in jeder Phase geschrieben; P19 und P22 sind zusätzliche umfassende Prüfungen, kein Ersatz für frühere Tests.

Jede Phase aktualisiert den lebenden Plan unter `docs/developer/plans/pixelcutoutsprite-execplan.md` gemäß dem vorhandenen `.agent/PLANS.md`-Standard. Der Status enthält tatsächlich erledigte Arbeit, ausgeführte Prüfungen und offene Punkte. Ein Kontrollkästchen ist erst erledigt, wenn das Gate nachweisbar bestanden ist oder ausdrücklich als durch den Nutzer abgenommene Ausnahme dokumentiert wurde.

Ein Coding-Agent darf mehrere Phasen in einer Sitzung nacheinander ausführen. Er überspringt dabei keine Gates und behauptet nicht, später im Hintergrund weiterzuarbeiten. Wenn der Arbeitskontext endet, hinterlässt er den exakten nächsten Schritt. Ein technischer Blocker wird beschrieben, ohne durch gelöschte Tests oder eine andere unerwünschte Architektur kaschiert zu werden.

## 25. Quellen und Recherchegrenzen

### Repository-Quellen

Die Dateien wurden am 5. September 2026 über die GitHub-Verbindung gelesen. Der Stand war nicht Gegenstand eines vollständigen Code-, Sicherheits- oder Laufzeitaudits. Vor der Implementierung sind weitere komponentenbezogene Regeln und Tests zu lesen.

- **R1:** `README.md` — vorhandenes Godot-Template, Befehle, Tooling und Exportabläufe. https://github.com/kleiveist/PixelCutoutSprite/blob/main/README.md
- **R2:** `AGENTS.md` — Repository-Regeln und Prüfpflichten. https://github.com/kleiveist/PixelCutoutSprite/blob/main/AGENTS.md
- **R3:** `.agent/PLANS.md` — Standard für lebende ExecPlans. https://github.com/kleiveist/PixelCutoutSprite/blob/main/.agent/PLANS.md
- **R4:** `config/toolchain.toml` — Godot-/Python-Vorgaben und Abhängigkeiten. https://github.com/kleiveist/PixelCutoutSprite/blob/main/config/toolchain.toml
- **R5:** `game/project.godot` — existierender Projekteinstieg und Desktop-/Renderer-Konfiguration. https://github.com/kleiveist/PixelCutoutSprite/blob/main/game/project.godot

### Offizielle technische Quellen

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
