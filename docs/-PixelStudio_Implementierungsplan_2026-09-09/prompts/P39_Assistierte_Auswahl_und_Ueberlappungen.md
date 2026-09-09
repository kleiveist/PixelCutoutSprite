# P39 · Assistierte Auswahl, automatische Konturanpassung und Anschlusszonen

**Auftrag:** Die ungefähre Markierung lokal verfeinern und eine sichere Handkorrektur/Überlappung beibehalten.

**Voraussetzungen:** P38. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/06_SEGMENTIERUNG_UND_SPRITES.md`
- `docs/09_ABNAHME_TESTS.md`
- `docs/10_ENTSCHEIDUNGEN_UND_RISIKEN.md`
- `docs/11_QUELLEN.md`

## Datei-Anker

`frontend/src/cutout-studio/`, `src-tauri/src/cutout/`, `frontend/src/shared/canvas/`, `vertraege/sprite-parts.catalog.json im Planpaket`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Implementiere die Pipeline ROI → Alpha-Vordergrund → seeded Farb-/Kantenhilfe → manuelle Korrektur. Trenne eindeutige transparente Außenkontur von unsicherer innerer Körperteilgrenze.

2. Erzeuge eine deterministische Baseline mit Positiv-/Negativseeds, begrenztem erlaubten Bereich, Kantenkosten und einstellbarer Toleranz. Nutze das in P28/P38 festgelegte Datenmodell; externe Algorithmen nur mit begründeter Qualitäts-/Paketierungsprüfung hinzufügen.

3. Negative Seeds sind harte Ausschlüsse, gezielt bestätigte Überlappungszugaben sind geschützte manuelle Inklusionen innerhalb sichtbarer Bildinformation. Automatische Verfeinerung darf die bewusst auf den Arm erweiterte Handmaske nicht wieder verkleinern.

4. Ändere ausschließlich die aktive Maske. Bei uneindeutigen Inseln, fehlenden Farbrändern oder unzureichendem Kontrast zeige eine nachvollziehbare Korrekturaufforderung; rücke nicht zufällig auf ein anderes Körperteil aus.

5. Führe aufwendige Berechnungen in Rust-Worker/isoliertem Worker aus. Unterstütze Fortschritt, Cancel, Job-/Maskenrevisionen und Verwerfen veralteter Resultate. Die UI muss währenddessen bedienbar bleiben.

6. Lege einen Fixture-Satz mit transparenter Figur, undurchsichtigem Hintergrund, gleichem Arm-/Torso-Farbton, mehrfarbigem Teil, dünnen Linien, überlappenden Teilen und negativer Korrektur an. Erfasse Qualitätsgrenzen und reale Laufzeit/Speicherbedarf.

7. Prüfe den gesamten Ablauf: größer markieren, sinnvoll verkleinern, Handkorrektur, Überlappung, bestätigen, anderes Teil wählen, zurückkehren, Undo und Neustart. Fehlende Automatikqualität darf nicht durch eine deaktivierte Funktion als erfüllt gemeldet werden.

## Prüftor

- [ ] Überdimensionierte ROI schließt eindeutigen transparenten Hintergrund zuverlässig aus.
- [ ] Bei schwierigen Grenzen führen Positiv-/Negativseeds und manueller Modus zu einer nutzbaren korrigierten Maske.
- [ ] Bewusste Anschlusszugaben bleiben erhalten, Nachbarmasken bleiben unverändert.
- [ ] Abgebrochene oder veraltete Jobs verändern keine neuere Auswahl.
- [ ] Qualitäts-/Performance-Bericht nennt reale Ergebnisse und Grenzen.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine Cloud-Uploads, keine heimlichen Modelldownloads und keine Zusage fehlerfreier semantischer Körperteilerkennung.

## Abschluss

Erwartetes Ergebnis: Lokale Auswahlhilfe, Überlappungswerkzeug, anspruchsvoller Fixture-Satz und ehrlicher Qualitätsnachweis.

Zugeordnete Anforderungen: R-G07, R-C06, R-C08, R-C12.

Lege den Bericht unter `docs/developer/acceptance/P39-assistierte_auswahl_und_ueberlappungen.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
