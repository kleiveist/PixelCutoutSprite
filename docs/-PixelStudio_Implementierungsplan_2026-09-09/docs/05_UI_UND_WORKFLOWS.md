# 05 · Oberfläche und Arbeitsabläufe

## Gemeinsamer Rahmen

```text
┌──────────────────────────────────────────────────────────────────┐
│ PixelPromptStudio | PixelCutoutSprite | PixelSpriteStudio    ⚙  ? │
├──────────────────────────────────────────────────────────────────┤
│ Gemeinsame ModuleNavigationRow + modulbezogene Aktionen          │
├──────────────────────────────────────────────────────────────────┤
│ Aktiver Vault / kompakte Kontextanzeige                           │
│ Modulinhalt                                                      │
├──────────────────────────────────────────────────────────────────┤
│ Speicherstatus / verständliche Fehlermeldung                      │
└──────────────────────────────────────────────────────────────────┘
```

`AppHeader` bleibt der einzige globale Header. Zahnrad und Hilfe liegen unmittelbar nebeneinander rechts. Die gemeinsame Navigation-Row wird in jedem Modul genau einmal gerendert, auch auf einer Willkommen-Seite ohne weitere Aktionen. Eine leere Row enthält keine leeren, irreführenden Navigations-Landmarks. Stabile Kennzeichnung: `data-module-navigation="prompt|cutout|sprite"`.

Die folgenden Skizzen sind Strukturvorgaben, keine pixelgenauen Entwürfe. Bestehende gestalterische Tokens dürfen weiterverwendet werden; eine komplette visuelle Neugestaltung ist nicht Voraussetzung.

## Globale Einstellungen

Das Zahnrad öffnet einen globalen modalen Dialog. Darin stehen Theme, Sprache, Darstellungsdichte und sinnvolle allgemeine Bedienoptionen. Basisprofil, Assetname und Wizard-Antworten gehören ausdrücklich nicht hinein. Werte gelten in allen drei Bereichen sofort nach erfolgreichem Speichern. Es gibt keine Prompt-Unterseite „Einstellungen“ mehr und keinen versteckten Fallback darauf.

Ein gemeinsamer `Modal`-/`DialogHost` behandelt alle fachlichen Popups. Jedes besitzt ein sichtbares, beschriftetes X, reagiert auf Escape und schließt beim Klick auf den tatsächlichen Hintergrund. Ein Klick innerhalb des Panels darf nicht schließen. Bei Pointer-Drags von innen nach außen zählt nicht allein ein außen endendes Mouse-up als Hintergrundklick. Modale Dialoge halten den Tastaturfokus im Dialog, deaktivieren den Hintergrund und geben den Fokus beim Schließen an den Auslöser zurück. Grundlage ist T03; zusätzliche Pointer-Regeln sind Zielentscheidungen dieses Plans.

Basisprofil- und Einstellungsdialoge arbeiten mit einem lokalen Formularentwurf. X, Escape und Außenklick schließen die Ansicht ohne implizites Commit. Bereits gespeicherte Werte bleiben bestehen. Ein noch nicht gespeicherter Formularentwurf darf für das erneute Öffnen derselben Vault-Sitzung im Speicher gehalten werden; er ist als ungespeichert erkennbar und wird nie heimlich zum aktiven Basisprofil. Ein ausdrücklich betätigtes „Speichern“ validiert und schreibt. Unvollständige Entwürfe werden nicht beim Schließen auf magische Weise „gültig“.

## PixelPromptStudio: Dashboard

Navigation: **Dashboard · Profile · Wizard · Ausgabe**. Alle neun Typkarten bleiben sichtbar, einschließlich leerer Kategorien mit Zahl 0. Jede Karte zeigt Icon, Typbezeichnung, Anzahl der gespeicherten Profile und eine kurze Namensvorschau. Die Zahl zählt Assetprofile, nicht die vier MD-Ausgaben eines einzelnen Assets. Zusätzlich darf „Ausgaben aktuell/veraltet“ angezeigt werden.

Klick auf eine Karte öffnet ein Kategorie-Popup. Darin werden Namen nach Untertyp gruppiert, mit Suchfeld, Datum und Speicher-/Validierungsstatus. „Laden“ liest das betreffende `<Name>-profile.json` vollständig aus dem aktiven Vault, schließt das Popup und öffnet den Wizard mit Antworten und gespeicherter Schrittposition. Es wird nicht nur der fertige Prompt in ein Textfeld kopiert. Ein Ladefehler verändert den bisherigen Entwurf nicht.

„Neues Asset“ öffnet den Wizard mit dem gewählten Typ als Vorschlag, aber ohne erfundene Antworten. Ungespeicherte Änderungen am bisher aktiven Entwurf werden vorher geflusht. Fehlerhafte Dateien werden als fehlerhafte Einträge kenntlich gemacht statt den kompletten Dashboard-Scan abzubrechen.

## PixelPromptStudio: Profile

```text
Profile
Aktueller Vault: VaultProjekt1
Pfad: …/VaultProjekt1                 [Vault wechseln]

[ BASISPROFIL – noch nicht festgelegt                    > ]

Nach dem Speichern:
[ BASISPROFIL · Classic · 32 px · Dreiviertel · transparent > ]
```

„Projekt“ wird nicht mehr als eigene Entität angelegt. Angezeigt wird ausschließlich der Vault-Kontext. Darunter steht ein großer, kompakter Basisprofil-Button. Der Button ist zugleich Statuszusammenfassung und Zugang zum Editor-Popup. Es gibt keine Sammlung auswählbarer Basisprofile, kein „duplizieren“ und keine globale Active-Base-ID.

Ohne Basisprofil können Namen und vorbereitende Angaben als Entwurf gesichert werden; eine fertige Prompt-Generierung ist gesperrt. Ein Hinweis führt zu „Profile → Basisprofil“. Der Wizard bettet den Basisprofil-Editor nicht erneut ein.

## PixelPromptStudio: Wizard

Über dem geführten Abfragekatalog steht immer das Feld **Name**. Darunter erscheinen Typ/Untertyp und die sichtbare Schrittanzeige. Namen gelten dem Asset, nicht einem zweiten Projekt. Der Basisprofil-Kontext wird höchstens als kompakte, nicht editierbare Zusammenfassung mit Link nach „Profile“ angezeigt.

Die Schrittfolge besitzt stabile IDs, keine bloßen Array-Indizes: `identity`, danach eine zur Kategorie passende Folge `catalog/<sectionId>`, anschließend `review`. Der bisherige Projekt-/Basisprofil-Schritt entfällt. Eine Katalogseite rendert nur die zugehörige Fragengruppe; andere Gruppen werden nicht als eine lange Seite bloß per Überschrift getrennt.

„Zurück“ erhält alle Eingaben und darf bei unvollständigen Feldern zurückgehen. „Weiter“ prüft die aktive Seite und fokussiert den ersten Fehler. Fertige spätere Schritte werden bei relevanten Änderungen als erneut zu prüfen markiert. Persistente Formzustände bleiben beim Unmount einer Seite erhalten; bei React Hook Form entsprechend kein unbeabsichtigtes Unregister mit Datenverlust.

Vorhandene Fragen, fachliche Verzweigungen und Ausgabequalität bleiben erhalten. Der Flow wird aus dem aktuellen Katalog abgeleitet und um fehlende Pflicht-Untertypen ergänzt. Beim Typwechsel erhalten kompatible allgemeine Antworten ihren Wert; inkompatible Antworten werden nicht unbemerkt auf einen anderen Typ übertragen. Die UI zeigt die Auswirkung vor einer destruktiven Verwerfung; vorherige Rohantworten bleiben im lokalen Draft-Journal wiederherstellbar.

Jede Änderung erzeugt den Speicherstatus „Änderungen vorhanden“, „Speichert“, „Gespeichert“, „Ausgabe wird aktualisiert“, „Fehler“ oder „Konflikt“. „Gespeichert“ und „Ausgaben aktuell“ sind unterschiedliche Zustände. Auf der Seite ist kein Export- oder Kopierbutton nötig.

## PixelPromptStudio: Ausgabe

Alle bisher verfügbaren Textausgaben und Varianten bleiben erreichbar. Tabs oder kompakte Auswahlfelder wechseln Stil, Sprache und `main/negative/technical/combined`. Die Texte sind lesbar und auswählbar; dedizierte Kopier-/Download-/JSON-Exportbuttons entfallen. Manuelles Markieren von Text wird nicht künstlich verhindert.

Ein zulässiger Button heißt **Im Dateimanager öffnen** (unter Windows gegebenenfalls „Im Explorer öffnen“). Für einen Ausgabetab zeigt er die zugehörige MD-Datei, für das Profil die JSON-Datei oder deren Ordner. Der native Pfad wird serverseitig geprüft. T02 garantiert das Anzeigen im Dateimanager, nicht auf jedem Betriebssystem zwingend ein neues Fenster. Die strengere Windows-Fensteranforderung wird deshalb als eigener Plattformtest behandelt, nicht als automatisch erfüllte Plugin-Eigenschaft.

## Gemeinsame DataFolderToolbar

Auf Cutout- und Sprite-Seiten existiert links dieselbe Dateinavigation: Vault-Root, Breadcrumb, Ordnerbaum, Aktualisieren, Such-/Dateifilter und ausgewähltes Element. Große Ordner werden paginiert oder virtuell gerendert, Thumbnails nach Bedarf geladen. Technische Ordner sind standardmäßig ausgeblendet, aber über eine Option sichtbar. `.PixelPrompt` kann als fachlicher Ordner sichtbar sein; `.masks`, `.source` und Transaktionsjournale werden nicht mit auswählbaren Originalbildern verwechselt.

Ein Ordnerklick selektiert und expandiert ihn. In PixelSpriteStudio lädt ein **erkannter Teileordner mit gültigem Manifest** bei derselben Auswahl automatisch die Teile; ein gewöhnlicher Ordner wird nur geöffnet. In PixelCutoutSprite lädt der Klick auf eine unterstützte Bilddatei diese in den Editor. Kein Drag-and-drop-Zwang. Tastaturbedienung mit Pfeilen, Enter und klarer Auswahlkennzeichnung ist mitzuprüfen.

Externe Dateien werden über eine bewusste Kopieraktion in den Vault aufgenommen, bevor sie als schreibbares Projekt bearbeitet werden. Ein nicht autorisierter Pfad wird nicht allein durch einen Dateinamen im Frontend zugänglich.

## PixelCutoutSprite

Startzustand ist eine neue Willkommen-Seite mit kurzen Schritten: Vault öffnen, Bild wählen, Teile markieren, Teile erzeugen. Die alte Projekt-/Area-/NPC-/Animationsbasis ist vollständig aus dem produktiven Ablauf entfernt.

Im Editor bleiben links der Dateibereich und ein kompakter Werkzeugbereich. Die Hauptgruppen werden als horizontale Icon-Button-Leiste dargestellt: **Körper, rechter Arm, linker Arm, rechtes Bein, linkes Bein, Extras**. Auf schmalen Flächen darf die Leiste umbrechen. Ein Klick öffnet ein Flyout mit genau drei Untereinträgen. Bevorzugt öffnet es links; fehlt dort Platz, wird es innerhalb des Fensters auf die rechte Seite oder in ein kompaktes Panel umpositioniert. Es darf niemals abgeschnitten außerhalb des Fensters liegen.

Die aktive Maske wird kräftiger dargestellt, bestätigte Masken blasser. Labels, Konturen oder Muster ergänzen die Farbe. Überlappende Pixel dürfen mehreren Teilen gehören. Auswahlwerkzeuge: Rechteck/Lasso, Vordergrund hinzufügen, Hintergrund abziehen, gezielt Überlappung malen, Undo/Redo. Enter bzw. ein sichtbarer Button bestätigt die aktive Maske; Wechsel zu einem anderen Teil sichert deren Zustand, ohne fremde Masken zu löschen.

Die Fußzeile zeigt 15 Pflichtteile sowie optionale Extras getrennt. „Teile erzeugen“ wird erst aktiv, wenn alle Pflichtteile entweder eine bestätigte, nicht leere Maske besitzen oder ausdrücklich als nicht im Bild vorhanden markiert sind. Der zweite Fall erzeugt ein als unvollständig gekennzeichnetes Set und eine Warnung, niemals heimliche Leer-PNGs.

## PixelSpriteStudio

Die linke Toolbar besitzt **Dateien** und **View**. Dateien wählt den Teileordner. View zeigt Ebenen mit Thumbnail, Name, Sichtbarkeit, Sperre und Zeichenreihenfolge. Drag-and-drop und tastaturbedienbare Nach-vorn-/Nach-hinten-Aktionen verändern Z-Werte. Der Canvas zeigt die automatisch rekonstruierte Originalanordnung.

Auswahl, Verschieben, Pivot, Rotation und Skalierung gehören zur Zusammenstellung. Ganzzahlige Verschiebung und Nearest-Neighbor sind die Voreinstellung für Pixelgrafik. Freie Transformationen sind bewusst aktivierbar. Es entsteht in dieser Phase kein neuer Timeline-, Rigging-, Godot- oder Animationseditor.

Änderungen werden automatisch in `sprite.scene.json` gespeichert. Auf Wiederöffnung hat eine valide Szene Vorrang vor der Originalanordnung des Teilemanifests. Eine geänderte Teilegeneration wird erkennbar abgeglichen, nicht still übernommen.

## Responsive-Verhalten

Die App passt das Layout an, nicht den gesamten DOM per `transform: scale`. Vorgeschlagene native Untergrenze: **480×360 logische Pixel**. Zu prüfen sind 1920×1080, 1440×900, 960×540, 720×450, 640×480 und 480×360 sowie 200 % Text-/UI-Zoom. Das erlaubt auch die Halbierung des bisherigen 1440×900-Fensters.

Ab etwa 1200 px sind Datei- und View-Seitenbereiche angedockt. Zwischen 800 und 1199 px werden sie kompakter. Darunter wird die Dateinavigation zu einem zugänglichen Drawer; unter etwa 560 px werden Modulschalter kurz beschriftet oder iconbasiert mit vollständigen zugänglichen Namen. Alle Funktionen bleiben erreichbar.

Grid-Kinder erhalten `min-width: 0`, Editorflächen `min-height: 0`, Dialoge viewportbezogene Maximalhöhen und eigene Scrollbereiche. Keine globale horizontale Überbreite; Navigation darf kontrolliert umbrechen. Canvas-Fit richtet sich nach dem verfügbaren Bereich, während Zoom und Auswahlkoordinaten in Quellpixeln bleiben. Resize darf weder Masken noch Schwenk-/Zoomzustand unkontrolliert verändern.
