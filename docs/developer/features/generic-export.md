<!-- PYGINDEX:NAVIGATION START -->
[Back to overview](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Deterministischer PNG-/JSON-Export

P16 verbindet die in P07–P15 aufgebauten Quellen mit einem erreichbaren Desktop-Export. Der
Arbeitsbereich ist sowohl über die Hauptnavigation als auch aus einem ausgewählten NPC heraus
erreichbar. Die Oberfläche übermittelt ausschließlich stabile Bereichs-, Figuren- und Binding-IDs;
Profil-, Motion-, Appearance-, Equipment- und Bildrevisionen werden im nativen Dienst erneut aus
der geöffneten Vault aufgelöst und geprüft.

## Ausgabe und Ablage

Ein Export erzeugt einen regelmäßigen, zeilenweise gefüllten RGBA8-Atlas. Alle Frames behalten
eine gemeinsame feste Fläche und einen gemeinsamen Bodenanker. Transparente Ränder werden weder
beschnitten noch rotiert oder skaliert. Bei unterschiedlicher Aktionsgeometrie ist ein
ausdrücklich gewähltes transparentes Padding erforderlich. Konfigurierbares Padding kann optional
mit extrudierten Randpixeln gefüllt werden.

Je nach Seitenlimit entstehen mehrere `sheet-*.png`. `animation.json` beschreibt Seiten,
explizite Rechtecke, Inhalts-Hashes, Aktion, Richtung, Frameindex, Framezahl, FPS, Loop-, Root- und
Sprungmodus, Spiegelquelle, Clippingmeldungen und Bodenanker. Richtungsgetrennte Einzelbilder sind
standardmäßig aus und werden nur durch die Profiloption erzeugt.

Der kanonische Zielbaum liegt bei genau einem Binding in dessen `exports`-Ordner und bei einem
NPC-Paket unter `_exports` des NPCs:

```text
exports/ oder _exports/
├── current.json
└── build-<source-fingerprint>/
    ├── animation.json
    ├── sheet-000.png
    └── frames/                 # nur auf ausdrücklichen Wunsch
```

Das Studio nimmt keinen frei über IPC gelieferten Schreibpfad an. Es publiziert in seinem
verwalteten, portablen Vault-Baum. P17 ergänzt dort das abgeleitete
[Godot-Paket](../formats/godot-package.md), ohne den generischen Vertrag zu ersetzen.

## Profile und Vorprüfung

Exportprofile gehören zum Bereich und liegen als normale, streng validierte JSON-Dateien unter
`.area/export-profiles`. Erstellen und Ändern verwenden stabile IDs, monotone Revisionen und einen
Inhaltsstempel; Read-only-Sitzungen können Profile lesen, aber weder speichern noch exportieren.
Ein Profil hält unter anderem Richtungen, Seitengröße und -anzahl, ein dekodiertes Speicherbudget,
Padding, Extrusion, Einzelbilder, Schatten, Geometrienormalisierung sowie Clipping- und
Unvollständigkeitsregeln.

Vor dem Job zeigt die UI die aus den tatsächlichen Bindings berechnete Frame-, Seiten- und
Speicherschätzung. Der native Dienst prüft die Eigentümerschaft aller IDs, eindeutige Aktionen,
gepinntes Profil, Freigaberevisionen, Richtungsabdeckung, gemeinsame Geometrie, Bilddatei,
Inhalts-Hash und dekodierte Maße erneut. Fehlende Richtungen oder Quellteile blockieren einen
normalen Export. Nur ein ausdrücklich aktivierter Testexport darf sie auslassen; Manifest und
`current.json` kennzeichnen ihn als unvollständig, und das NPC-Dashboard behandelt ihn nie als
aktuellen vollständigen Build. Beschädigte, hashfalsche oder falsch dimensionierte PNGs bleiben
auch in diesem Modus harte Fehler.

## Determinismus und Veröffentlichung

Der Export verwendet denselben `AnimationSampler`, `DirectionResolver`, gespeicherten
Outfit-/Equipment-Aufbau und `PixelCompositor` wie die Vorschau. Der Quellen-Fingerabdruck enthält
nur effektiv verwendete semantische Quellen und Exportoptionen: reine Zeitstempel,
Prüfzustandsänderungen oder eine Wiederholung verändern ihn nicht. Eine tatsächlich andere
Profil-, Motion-, Bild-, Fitting-, Equipment- oder Bindingquelle erzeugt dagegen einen neuen
Fingerabdruck.

Frames werden zuerst in einem jobspezifischen Staging-Verzeichnis gerendert, gepackt, vollständig
dekodiert und gegen Rechtecke sowie RGBA-Hashes geprüft. Erst danach wird der inhaltsadressierte
Build publiziert. Ein normaler PNG-/JSON-Job ersetzt zuletzt `current.json`; ein Godot-Job wartet
damit zusätzlich, bis alle abgeleiteten Ressourcen validiert und publiziert sind. Ein gleicher
Fingerabdruck darf nur einen bereits vollständig validierten, pixelgleichen Build beziehungsweise
ein bytegleiches Godot-Paket wiederverwenden. Verwaiste Build-/Paketordner und beliebige neuere
JSON-Dateien werden nicht als aktuelle Ausgabe interpretiert.

P18 pinnt den rohen SHA-256 des beim Jobstart beobachteten `current.json`. Das gilt sowohl für den
transaktionalen NPC-Desktoppfad als auch für die öffentliche generische Service-API. Verändert ein
externes Werkzeug den gültigen Pointer während Rendering oder Publishing-Callback, endet der Job
mit einem Konflikt und erhält die externen Bytes exakt; ein ursprünglich fehlender Pointer wird
collision-sicher erzeugt.

## Fortschritt und Abbruch

Der Tauri-Composition-Root hält eine sitzungsgebundene Job-Registry. Pro verwaltetem Ziel ist nur
ein aktiver Writer erlaubt; Vault-Schließen und NPC-Umbenennen sind während eines betroffenen Jobs
gesperrt. Fortschritt wird für Vorprüfung, Rasterung, Atlasaufbau, Validierung und Veröffentlichung
als Desktop-Ereignis gemeldet und zusätzlich pollbar gehalten. Ein UI-Abbruch wird genau einmal an
den nativen Job geleitet und wartet auf dessen terminalen Zustand. Vor der Veröffentlichung
entfernt ein Abbruch ausschließlich das eigene Staging-Verzeichnis und erhält den letzten gültigen
Pointer.

## Belegte Grenzen

- Atlasachsen: `1..=4096` Pixel; Padding: `0..=64` Pixel.
- Seitenzahl: `1..=1024`; dekodiertes Profilbudget: höchstens 4 GiB.
- Acht Richtungen sind für einen vollständigen Build erforderlich; Teilmengen sind markierte
  Testausgaben.
- Ein Manifest-Tick entspricht `1 / fps`; ausgegebene Samples werden nicht heimlich
  zusammengezogen.
- Die belegten Publikations- und Abbruchtests laufen auf Linux. P18 unterbricht zusätzlich den
  produktiven letzten Pointer-Austausch und beweist nach Reopen sowohl Resume als auch Rollback;
  die nativen Windows-/macOS-Dateisystem- und Paketgates gehören weiterhin zu P20.

Die nativen P16-Tests dekodieren Atlas- und Einzelbildpixel, prüfen Mehrseitenrechtecke,
Extrusion, Budgets, gemeinsame Geometrie, vollständige Multi-Action-/Acht-Richtungs-NPCs,
Fingerprint-Aktualität, aktuelle Pointer, korrupte Quellen und Abbruch. Die Frontendtests prüfen
Profilpersistenz, Vorprüfung, stabile IDs, Event-/Polling-Rennen, genau einen nativen Abbruch,
Navigation und Read-only-Verhalten.
