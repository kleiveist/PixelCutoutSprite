# P33 · Vault-Profil und Singleton-Basisprofil-Popup

Datum: 2026-09-09
Status: Frontend umgesetzt und getestet; nativer CAS-Lauf offen
Anforderungen: R-G02, R-D03, R-P03, R-P06, R-P12

## Ergebnis

[`VaultProfileView.tsx`](../../../frontend/src/prompt-studio/features/profiles/VaultProfileView.tsx)
ersetzt im produktiven Vault-Pfad die zentrale Bibliothek. Die Seite zeigt den aktuellen
Vault-Namen, Kontext und genau einen großen Basisprofil-Button; es gibt weder Projektanlage noch
frei bearbeitbaren Projektnamen.

[`VaultBaseProfileDialog.tsx`](../../../frontend/src/prompt-studio/features/profiles/VaultBaseProfileDialog.tsx)
verwendet das gemeinsame Modal und enthält sämtliche Basiswerte aus dem P28-Inventar einschließlich
Lichtregeln und einzelner Sperren. Speichern schreibt ausschließlich
`.PixelPrompt/basisprofil.json`, behält die ID bei und erhöht die Revision. Eine zweite ID,
beschädigte/konkurrierende Basis, alte Revision oder externer Hash führen zum Konflikt.

Nach erfolgreichem Speichern stammen Name, Stil, Pixeldichte, Tile-Größe, Perspektive und Revision
im großen Button aus dem zurückgelesenen gespeicherten Dokument. Abbrechen und alle Dismiss-Wege
ändern die aktive Basis nicht. Read-only, kein Vault, keine Basis und beschädigte Basis besitzen
getrennte fail-closed Zustände. Die laufende bzw. fehlgeschlagene Regenerierung ist sichtbar.

Der Basis-Schritt des noch bestehenden Wizard-Rahmens enthält nur Zusammenfassung und Link zur
Profile-Seite; ein zweiter eingebetteter Basis-Editor wird nicht gerendert.

## Nachweise

- [`VaultProfileView.test.tsx`](../../../frontend/src/prompt-studio/features/profiles/VaultProfileView.test.tsx):
  Vault-Anzeige, verworfener Dialogentwurf, stabile ID, Revision 1→2, gespeicherte Zusammenfassung,
  beschädigte Basis und Read-only.
- [`Modal.test.tsx`](../../../frontend/src/shared/dialogs/Modal.test.tsx): gemeinsame X-/Escape-/
  Backdrop-/Fokus-Regeln.
- [`App.prompt-studio.test.tsx`](../../../frontend/src/app/App.prompt-studio.test.tsx): produktive
  Profile-Route und einzige externe Modulnavigation.
- Rust-Tests `base_profile_is_a_single_cas_path` und Scan auf `duplicate_base_profile` sind im
  Quellbaum vorhanden.

## Abschlussgates

Der abschließende Frontend-Lauf bestand 160/160 Testdateien und 806/806 Tests. Typecheck, ESLint,
Prettier und Produktions-Build liefen mit Exit 0. `test:e2e` erreichte wegen des fehlenden
Chromium-Binarys keinen Test. Rust-Gates bleiben mangels `cargo` und `rustc` nicht ausgeführt.
