# P30 · Gemeinsamer Vault-Core und sichere Dateitransaktionen

**Auftrag:** Vault-Sitzungen und zuverlässige, begrenzte Dateizugriffe als Grundlage aller Module implementieren.

**Voraussetzungen:** P28, P29. Lies zuerst `00_MASTER_PROMPT.md`. Arbeite auf dem bestehenden Code und führe diese Phase tatsächlich aus.

## Kontext lesen

- `docs/03_ZIELARCHITEKTUR.md`
- `docs/04_DATENVERTRAEGE.md`
- `docs/07_MIGRATION_UND_RUECKBAU.md`
- `docs/09_ABNAHME_TESTS.md`

## Datei-Anker

`src-tauri/src/storage/`, `src-tauri/src/lib.rs`, `frontend/src/api/vault-client.ts`, `frontend/src/shared/vault/ (neu)`, `frontend/src/shared/storage/ (neu)`, `src-tauri/src/workspace/ (neu)`.

Existierende Anker vor Änderungen vollständig prüfen. Als neu markierte Pfade sind Zielvorschläge; an vorhandene Projektkonventionen angepasste Namen im Bericht festhalten.

## Umsetzung

1. Implementiere ActiveVaultProvider und nativen WorkspaceService mit vaultId, sessionId, sessionGeneration, Modus und Writer-Lock. Ein ausgewählter normaler Ordner genügt; neue Arbeit darf nicht von alten Projekten oder Areas abhängen.

2. Lege .PixelStudio/vault.json nur innerhalb eines autorisierten, schreibbaren Vaults an. Stelle .PixelPrompt bei Bedarf her. Vorhandene alte oder unbekannte Metadaten dürfen nicht überschrieben werden.

3. Prüfe jeden relativen Pfad und jedes Ziel im Backend. Schließe Traversal, absolute Pfade, Symlinks/Junctions, nicht reguläre Ziele, Gerätenamen und Umbenennungsrennen aus. Verwende sichere bestehende Helfer nur nach Prüfung ihrer tatsächlichen Grenzen.

4. Baue einen wiederverwendbaren Writer für Einzeldateien und journalgestützte Dateisätze. Unterstütze expectedRevision, Hash-Konflikte, Staging auf demselben Dateisystem, Recovery und fail-closed bei IO-Fehlern. Behaupte keine globale Dateisystem-Atomizität für mehrere Renames.

5. Implementiere asynchrone Repository-Interfaces, eine sitzungsgebundene SaveQueue und typisierte Fehler. Ein erfolgreicher Memory-Update ist kein dauerhaftes Speichern. Der read-only-Modus verweigert Schreibversuche konsistent.

6. Koordiniere Vault-Wechsel und natives App-Schließen über Flush. Verhindere spät eintreffende Ergebnisse aus alten Sitzungen. Ein blockierter Wechsel hält den alten Vault und seine ungesicherten Eingaben zugänglich.

7. Ergänze Fault-Injection-Tests für fehlende Rechte, Datenträgerfehler, externe Dateiänderung, zwei App-Instanzen, unterbrochene Publikation, manipulierte Pfade und einen Wechsel während verzögerter Writes.

## Prüftor

- [ ] Zwei Vaults mit gleichen Namen/Dateien bleiben logisch und physisch getrennt.
- [ ] Ein zweiter Writer erhält keinen unbemerkten Schreibzugriff.
- [ ] Absturz an jedem Publish-Schritt liefert nach Recovery eine konsistente alte oder neue Generation.
- [ ] Path-Escape- und Konflikttests verändern keine Datei außerhalb des Vaults.
- [ ] Die Shell öffnet einen leeren Vault ohne Alt-Projekt/Area.

Führe außerdem die zu den Änderungen passenden bestehenden Frontend-/Rust-Tests und bei UI-Änderungen Typecheck/Lint aus. Die konkreten Befehle und native Zusatzgates stehen in `docs/09_ABNAHME_TESTS.md`. Schreibe keine grüne Bewertung für nicht ausgeführte Tests.

## Grenzen

Keine globale fs-All-Freigabe, kein generischer Frontend-Write-Absolute-Path-Command und keine automatische Löschung alter Daten.

## Abschluss

Erwartetes Ergebnis: Workspace-Service, SaveQueue, Transaktions-/Recovery-Protokoll und belastbare Fehler-/Sicherheitstests.

Zugeordnete Anforderungen: R-G07, R-D01, R-D05, R-D06, R-D09, R-C01.

Lege den Bericht unter `docs/developer/acceptance/P30-vault_core_und_sichere_dateien.md` im Repository an. Verlinke echte Testnachweise, dokumentiere Abweichungen und verbleibende Blocker. Stoppe nach dem Bericht; die nächste Phase ist ein eigener Auftrag.
