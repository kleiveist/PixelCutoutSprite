<!-- AUTO-GENERATED:backlink START -->
[← Back](pixelcutoutsprite.md)
<!-- AUTO-GENERATED:backlink END -->
# Übergeordneter Arbeitsauftrag — PixelCutoutSprite Studio

Diesen Auftrag zu Beginn einer Implementierungssitzung verwenden. Danach die gewünschte Phase P00–P22 anhängen oder den Serienmodus unten wählen.

```text
Arbeite im vorhandenen Repository kleiveist/PixelCutoutSprite an der Tauri-Desktop-App
PixelCutoutSprite Studio. Der tatsächliche Checkout ist das Template-Tooling-Projekt,
nicht Forge2D.

Lies zuerst AGENTS.md, .agent/PLANS.md, docs/index.md und die für die Aufgabe
gültigen Python-/TypeScript-/Rust-Regeln. Lies danach vollständig:
- docs/developer/features/pixelcutoutsprite-studio.md
- docs/developer/plans/pixelcutoutsprite-execplan.md
- den beauftragten Phasenprompt unter docs/developer/prompts/pixelcutoutsprite/

Behandle die Spezifikation als fachlichen Auftrag und ADR-001 als technische
Korrektur der falschen Repository-Annahme im importierten Plan. Das vorhandene
Python-Tooling und sein Profil desktop-local sind der Ausgangspunkt. Baue mit
Vite/React/TypeScript, Tauri 2 und Rust; Godot ist nur Exportziel in P17.
Kein Electron- oder Browserprodukt. Desktop-only. Kein SQL/SQLite. Quellen
bleiben JSON + PNG in normalen Ordnern.
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

## Serienmodus: mehrere oder alle Phasen

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

## Verwendung

Die Einzelphasen sind bewusst aufeinander aufgebaut. Für einen kontrollierten Start werden der übergeordnete Auftrag und P00 verwendet. Ein späterer Auftrag kombiniert den gleichen Rahmen mit der nächsten offenen Phase. Im Serienmodus bleiben die einzelnen Gates genauso verbindlich wie bei separater Ausführung.
