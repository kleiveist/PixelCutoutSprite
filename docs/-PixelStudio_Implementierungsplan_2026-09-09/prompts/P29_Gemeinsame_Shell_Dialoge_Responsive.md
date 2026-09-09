# P29 · Gemeinsame Shell, Navigation, Dialoge und Responsive-Grundlage

**Auftrag:** Einheitlichen Rahmen für drei Bereiche schaffen, ohne fachliche Daten zu verändern.

**Voraussetzungen:** P28. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/05_UI_UND_WORKFLOWS.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`frontend/src/components/AppHeader.tsx`, `frontend/src/components/DialogLayer.tsx`, `frontend/src/app/App.tsx`, `frontend/src/app/navigation.ts`, `frontend/src/prompt-studio/app/AppShell.tsx`, `frontend/src/styles/global.css`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Erweitere StudioMode um sprite. Füge PixelSpriteStudio als gleichberechtigten Schalter mit ehrlichem Willkommen-Platzhalter hinzu. Der bisherige Cutout-Code wird in dieser Phase noch nicht entfernt.

2. Ergänze rechts in header-actions ein beschriftetes Zahnrad unmittelbar neben dem Hilfe-Button. Öffne einen zentralen GlobalSettingsDialog; dessen dauerhafte Werteanbindung folgt in P31. Kein zweiter Header und keine externe Website.

3. Extrahiere ModuleNavigationRow. Rendere sie für prompt, cutout und sprite genau einmal direkt unter dem Header. Passe die Prompt-Einbettung an, damit die alte interne Row nicht zusätzlich erscheint. Nutze stabile Rollen und data-module-navigation statt generierter CSS-Klassennamen.

4. Implementiere einen gemeinsamen ModalHost mit X, Escape, echtem Backdrop-Klick, Fokusbegrenzung, Hintergrund-Inertheit, scrollbarer Panelhöhe und Fokus-Rückgabe. Trenne Modal und kleines Flyout semantisch, halte die Schließregeln konsistent.

5. Baue Responsive-Reflow statt globalem CSS-Scale. Reduziere native Mindestgröße auf 480×360, passe den Debug-Acceptance-Parser samt Tests an. Header, Navigation und Dialoge müssen bei 720×450 und 480×360 erreichbar bleiben.

6. Entkopple den Shell-Start vom erfolgreichen Lesen fachlicher Prompt-App-Data. Der Welcome-Rahmen muss auch ohne Vault oder bei einer beschädigten Legacy-Bibliothek sichtbar werden; Fehler erscheinen im betreffenden Modul.

7. Ergänze Komponententests und Browser-Layouttests für drei Module, leere Navigation-Row, alle Dismiss-Wege, Fokus und Resize. Mache temporär noch nicht angebundene Bereiche sichtbar als nicht fertig, statt Funktionsfähigkeit vorzutäuschen.

## Prüftor

- [ ] Ein Header, eine Modulzeile und ein zentraler ModalHost pro aktivem Bereich.
- [ ] X/Escape/Außenklick funktionieren; Innenklick und ein von innen gestarteter Drag schließen nicht.
- [ ] 720×450 und 480×360 sind nativ konfigurierbar; keine feste 1280-px-Barriere bleibt im Parser.
- [ ] Globale Bedienelemente sind mit Tastatur und verständlichen zugänglichen Namen erreichbar.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Kein vollständiger fachlicher Cutout-Rückbau, keine Migration und kein produktives Cloud-/Browser-Storage-Fallback.

## Abschluss

Erwartetes Ergebnis: Dreiteilige Shell, gemeinsame UI-Primitives, Responsive-Basis, aktualisierte Fenster-/Dialogtests.

Zugeordnete Anforderungen: R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G08, R-S01.

Lege den Bericht unter `docs/developer/acceptance/P29-gemeinsame_shell_dialoge_responsive.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
