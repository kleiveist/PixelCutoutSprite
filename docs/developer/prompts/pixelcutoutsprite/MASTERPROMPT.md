<!-- PYGINDEX:NAVIGATION START -->
[Zur Übersicht](README.md)
<!-- PYGINDEX:NAVIGATION END -->

# Übergeordneter Arbeitsauftrag — PixelCutoutSprite Studio

Diesen Auftrag als historischen Implementierungsrahmen verwenden. P00–P22 bilden die
abgeschlossene Cutout-Basis; P23–P27 bilden die ebenfalls abgeschlossene PixelPromptStudio-
Integration. Der ExecPlan und die P27-Integrationsabnahme sind für den tatsächlichen Endstand
maßgeblich.

```text
Arbeite im vorhandenen Repository kleiveist/PixelCutoutSprite an der Tauri-Desktop-App
PixelCutoutSprite Studio. Der tatsächliche Checkout ist das Template-Tooling-Projekt,
nicht Forge2D.

Lies zuerst die tatsächlich vorhandenen Repository-Regeln, `docs/index.md` und
die für die Aufgabe gültigen Python-/TypeScript-/Rust-Regeln. Falls später
`AGENTS.md` oder `.agent/PLANS.md` vorhanden sind, gelten sie ebenfalls. Lies
danach vollständig:
- docs/developer/features/pixelcutoutsprite-studio.md
- docs/developer/plans/pixelcutoutsprite-execplan.md
- den beauftragten Phasenprompt unter docs/developer/prompts/pixelcutoutsprite/

Für P23–P27 lies zusätzlich vollständig:
- docs/developer/plans/prompt-studio-integration.md
- ../PixelForgeStudio/AGENTS.md sowie nur die dort für den portierten
  Prompt-Bereich verlangten technischen Unterlagen

Behandle die Spezifikation als fachlichen Auftrag und ADR-001 als technische
Korrektur der falschen Repository-Annahme im importierten Plan. Das vorhandene
Python-Tooling und sein Profil desktop-local sind der Ausgangspunkt. Baue mit
Vite/React/TypeScript, Tauri 2 und Rust; Godot ist nur Exportziel in P17.
Kein Electron- oder Browserprodukt. Desktop-only. Kein SQL/SQLite. Quellen
bleiben JSON + PNG in normalen Ordnern.
Keine notwendige manuelle Bone-/Skelett-Einrichtung. Trenne Bewegungsvorlagen,
NPC-Aussehen und Animationszuordnungen. Alle strukturierten Filter sind Dropdowns.

P00–P22 sind abgeschlossen und werden nicht ohne konkrete Regression erneut geöffnet.
P23–P27 integrieren PixelPromptStudio als React-Bereich derselben Tauri-App. Kein
iframe, keine externe Webseite, kein zweiter Prozess, keine zweite App-Shell und
kein zweiter Header. `StudioMode` liegt oberhalb der bestehenden `WorkspaceRoute`;
die Prompt-Navigation bleibt davon getrennt. Behandle den benachbarten
PixelForgeStudio-Checkout als Read-only-Quelle und dokumentiere die beim Port
tatsächlich verwendete Revision und Lizenz.

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
Führe noch nicht abgeschlossene Phasen P23 bis P27 nacheinander aus. Im aktuellen Stand sind alle
fünf Phasen abgeschlossen; dieser Absatz bleibt als historischer Serienauftrag erhalten.
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

Die Serie wurde bewusst aufeinander aufgebaut und bleibt als Auftragsnachweis erhalten. Für eine
Fortsetzung sind der übergeordnete Auftrag, Integrationsplan und ExecPlan maßgeblich. Die
vorgeschlagenen Committexte in P23–P27 gelten nur im ausdrücklich freigegebenen phasenweisen
Serienmodus; ein Push oder Release ist dadurch nicht freigegeben.
