# P32 · Prompt-Vault-Persistenz, Autosave und bestätigte Migration

Datum: 2026-09-09
Status: Frontend-Gates grün; native Dateisystemtests umgebungsbedingt offen
Anforderungen: R-D01, R-D02, R-D03, R-D04, R-D05, R-D06, R-D07, R-D10, R-P02, R-P09, R-P11, R-P12

## Ergebnis

Der produktive Prompt-Zustand wird über
[`vaultPromptRepository.ts`](../../../frontend/src/prompt-studio/services/vaultPromptRepository.ts)
und die sitzungsgebundenen nativen Commands gelesen/geschrieben. `main.tsx` initialisiert keine
Prompt-App-Data-Collection und keinen Browser-Storage-Fallback mehr. Die verbliebene V2-Schicht ist
nur ein flüchtiger Kompatibilitätsadapter für die noch vorhandene Wizard-Oberfläche.

Der Backend-Writer erzwingt `.PixelPrompt/<Typ>/<Untertyp>/<Name>/<Name>-profile.json`, reserviert
Namen case-insensitiv und blockiert Geräte-/Pfadnamen, fremde Ziele und doppelte IDs. Änderungen an
Name, Typ oder Untertyp verschieben Profil und registrierte MD-Dateien hashgesichert; die stabile
Profil-ID bleibt erhalten.

[`vaultAutosave.ts`](../../../frontend/src/prompt-studio/services/vaultAutosave.ts) verwendet 400 ms
Debounce und expliziten Flush. Vor valider Identität landet der verlustfreie Rohzustand unter
`.PixelPrompt/.drafts/<draftId>.json`. Danach wird das kanonische Profil gespeichert. Wird die
Identität später ungültig, bleibt der letzte gültige Profilpfad bestehen und der neue Rohzustand
wird als Draft geschützt.

Der Snapshot-Generator erzeugt für `classic|dark` × `de|en` ×
`main|negative|technical|combined` bis zu 16 Markdown-Dateien. Profil und Ausgaben werden als ein
journalisierter Satz mit `draftRevision`, `baseRevision`, Generatorversion, Pfaden und Hashes
publiziert. Ungültige Eingaben schreiben keine leeren Texte über eine valide Generation. Eine neue
Basisrevision markiert betroffene Profile stale und stößt die Regenerierungsqueue an.

Die bestätigte Legacy-Migration nutzt denselben Writer, publiziert die ausgewählten Quelldaten mit
Provenienzmarker, liest das Ziel erneut und ist über den Quellhash idempotent. Sie löscht oder
verändert die Quelle nicht.

## Nachweise

- [`vaultAutosave.test.ts`](../../../frontend/src/prompt-studio/services/vaultAutosave.test.ts):
  Debounce, Rohdraft, Revision/CAS, Flush, Fehler und Retry.
- [`vaultWizardBridge.test.ts`](../../../frontend/src/prompt-studio/services/vaultWizardBridge.test.ts):
  V2→V3-Projektion, Rohzustand, Ready-Profil und Neustart-Hydrierung aus V3-Dateien.
- [`vaultPromptGenerator.test.ts`](../../../frontend/src/prompt-studio/services/vaultPromptGenerator.test.ts):
  16 Dateien, Hashmanifest und stale/fresh-Verhalten.
- [`legacyVaultMigration.test.ts`](../../../frontend/src/prompt-studio/services/legacyVaultMigration.test.ts):
  konfliktbehaftete Preview und reproduzierbarer Bundle-Aufbau.
- Rust-Tests in `prompt_vault/mod.rs`: Singleton-Basis/CAS, Rohdraft, normativer Pfad,
  Fremdkollision, Profilrelokation sowie verifizierte/idempotente Migration.

## Blocker

Ohne `cargo` konnten die nativen Datei-, Restart-, Lock-, Relokations- und Crash-Recovery-Tests
nicht ausgeführt werden. Die TypeScript-Repositorytests prüfen die Verträge, sind aber kein Ersatz
für diesen nativen Nachweis.
