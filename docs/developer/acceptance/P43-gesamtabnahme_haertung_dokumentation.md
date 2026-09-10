# P43 — Gesamtabnahme, Desktop-Härtung und Dokumentation

Stand: 10. September 2026 · Basis `f85e24d41197fe74dd64a9d8e2670c382b3f65b8` plus
uncommitteter Arbeitsstand P37–P43. Kein Commit, Push, Signieren oder Veröffentlichen.

## Ergebnis und Reichweite

Die neue gemeinsame App enthält Prompt-Vault, Cutout-Maskeneditor und Sprite-Komposition.
P37–P42 haben eigene [Phasenberichte](index.md); P43 überprüft den aktuellen Gesamtstand
erneut und ergänzt die unten genannten Korrekturen. Historische P00–P27-Berichte ersetzen
keinen dieser Tests. Das gelieferte Planpaket wurde nicht umgeschrieben.

Die ausgeführten Gates, Exit-Codes, Log-Hashes, Build-Referenzen und nativen Messwerte stehen
in [P43-checks.json](P43-checks.json). **Keine plattformübergreifende Releasefreigabe:**
Windows/macOS sind nicht nativ geprüft. Die verbleibenden Sicherheits- und Umgebungsgrenzen
stehen ausdrücklich unter „Offene Punkte“.

## In P43 tatsächlich korrigiert

- Native Close/Flush: `window.destroy` war trotz erfolgreichem Flush nicht erlaubt. Die
  eng auf `main` begrenzte Capability erlaubt jetzt das abschließende Schließen. Ungültige
  Zahlen bzw. fehlgeschlagene Saves halten das Fenster weiter offen.
- Nativer Oberflächenzoom: Tauri-Zoom-Tastenkürzel und nur die dafür nötige
  `core:webview:allow-set-webview-zoom` aktiviert. CSP, Shell- und Dateisystemrechte bleiben eng.
- Explizite Snapshot-Fortsetzung bei fehlender/veränderter Originaldatei: bestehende Masken
  bleiben erhalten; Snapshot-Integrität und CAS werden weiterhin geprüft. Keine stille
  Neuverknüpfung mit einem anderen Original.
- Maskenstriche werden bei Resize verworfen. Bestätigte, positive, negative und geschützte
  Pixelzahlen sind zusätzlich lesbar. Ein abgewiesenes Undo/Redo verliert keinen History-Eintrag.
- Die Teilwahl-Flyouts besitzen neben Escape/Außenklick ein beschriftetes X; Rückkehrfokus
  und alle sechs Fenstergrößen sind im P38-Browsertest abgedeckt.
- Ein schneller Teilwechsel konnte eine gerade getippte „nicht vorhanden“-Begründung durch
  einen nachlaufenden Effect leeren. Die Eingabe ist nun während des Renderns an Teil und
  gespeicherten Ausgangswert gebunden; der integrierte Browsertest schließt alle 15 Teile.
- Dashboard → Profil laden → Weiterbearbeiten: ein eingebetteter Wizard erhielt eine neue
  Arbeitsentwurfs-ID, verlor aber die Zuordnung zur kanonischen Profil-ID. Diese wird jetzt
  ausdrücklich erhalten. Service-Regression und nativer Ein-Profil-Nachweis decken das ab.
- Sprite-Autosave behält verifizierte Pixel-/Manifest-Referenzen statt wiederholt große
  RGBA-Texturen aufzubauen. Ungültige Zahlen blockieren auch History-/Reset-Aktionen.
- Dateisatz-Publikation verwendet nach dem Backup create-only Veröffentlichung. Geänderte
  Backups, neue Fremddateien, ausgetauschte Elternpfade und fremde Recovery-Mitglieder werden
  in den injizierten Fehlerfenstern bewahrend abgewiesen. Recovery löscht nur inventarisierte
  eigene Mitglieder, nicht rekursiv unbekannte Inhalte. Speicher-/Renamefehler melden keinen Erfolg.

Die Produktanleitung ist [Gesamtworkflow](../../guides/gesamtworkflow.md), ergänzt durch
[Cutout](../../guides/cutout-willkommen.md), [Sprite](../../guides/sprite-studio.md),
[Speicherlayout](../storage/vault-storage.md), [Recovery](../storage/recovery.md) und
[Architektur](../prompt-generator-architecture.md). README, Startseite und Produktbeschreibung
beschreiben keine alte Area-/NPC-/Godot-Produktstrecke mehr. Historische Unterlagen sind markiert.

## Ausgeführte Testeinstiege

Umgebung: Debian-12-/Linux-x86_64-Container, Node 24.19.0, npm 11.17.0, Rust 1.97.1,
Python 3.11.2; temporär bereitgestellte GTK/WebKit-Abhängigkeiten, Chromium und Xvfb.
`source /tmp/p37-validation.qSyRWN/native-env.sh` aktiviert die lokale Validierungsumgebung.
Die folgenden Kürzel werden in der Nachweismatrix verwendet. Endgültige Ergebnisse/Hashes:
[maschinenlesbares Protokoll](P43-checks.json).

| Kürzel | Befehl / Ebene | Ergebnis |
|---|---|---|
| F | `npm --prefix frontend run test -- --reporter=verbose` | 741 Tests / 140 Dateien bestanden |
| B | `npm --prefix frontend run test:e2e -- --output=/tmp/p38-p43-validation.Xozjjs/p43-browser-final5` | 21 Tests bestanden; produktives Frontend mit ausdrücklich kontrolliertem IPC |
| N | `CARGO_BUILD_JOBS=1 cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features` | 134 Tests bestanden: 103 Lib + 1 Composition + 18 Recovery + 12 Vault; Kindprozess nicht doppelt gezählt |
| Q | `npm --prefix frontend run typecheck`, `run lint`, `run format:check`; `cargo fmt … --check`; `cargo clippy … --all-targets --all-features -- -D warnings` | bestanden |
| S | `python -m pytest -v -p no:cacheprovider` auf den sieben in checks.json benannten Source-/Tooling-Dateien | 110 bestanden, 2 bestehende profilabhängige Skips ausdrücklich erfasst |
| A | `python tools/control.py quality architecture` | TypeScript-AST-/Architekturgate bestanden |
| E | `python tools/control.py test --suite frontend`; `python tools/control.py tauri test --cargo` | vorhandene Einstiegspunkte erfolgreich genutzt |
| L | `python tools/control.py tauri build --target linux --bundles deb --no-clean` | unsigniertes Linux-DEB erstellt und Payload/Manifest geprüft |
| G | `python3 src-tauri/tests/native_desktop_roundtrip.py --executable … --offline-launcher … --desktop-checks --evidence …` | echte native Aktionen und Dateien; Details/Artefakte in checks.json |

Der erste zusätzliche parallele Rust-Lauf scheiterte im Linker mit
`std::system_error: Resource temporarily unavailable`, nicht in einem Test. Der vollständige
erneute Lauf mit `CARGO_BUILD_JOBS=1` bestand. Die fehlgeschlagene Diagnose bleibt im Log erhalten.
Der Rust-WASI-Architekturprüfer erreichte mit dem gewachsenen `workspace/mod.rs` sein Fuel-Limit.
Die unveränderten eingebetteten Tests wurden nach `workspace/tests.rs` ausgelagert; danach
bestand das unveränderte Architekturgate (406 TypeScript-Dateien, keine Warnungen/Suppressions).
Auch anfänglich fehlerhafte Automatisierungsannahmen (AT-SPI-Textnamen, asynchroner Dialogabschluss,
CSS-`zoom` als falscher Ersatz für Browserzoom) sind keine grünen Nachweise; maßgeblich sind die
abschließenden Läufe. Die beiden dabei gefundenen Produktfehler sind oben separat beschrieben.

## Nativer Ablauf und Beweisgrenzen

`native_desktop_roundtrip.py`, `native_desktop_support.py`, `native_fixture_image.py` und
`native_offline_launcher.c` unter `src-tauri/tests/` sind Testwerkzeuge, kein Produkt-/Sidecarcode.
Der Launcher blockiert IPv4-/IPv6-Sockets im Kernel mittels Seccomp, kontrolliert die Sperre
beim Start und lässt Unix-IPC für GTK/D-Bus zu. App und Kindprozesse erben die Sperre.
Externe Systemdienste werden dadurch nicht pauschal netzlos gemacht.

Für eine Wiederholung werden Linux/X11, GTK/WebKit, Python-GI/AT-SPI und ein laufender
Thunar-`org.freedesktop.FileManager1`-Dienst benötigt. Der Offline-Launcher wird beispielsweise
mit `cc -Wall -Wextra -Werror src-tauri/tests/native_offline_launcher.c -o /tmp/p43-native-offline`
gebaut. Dem Python-Treiber die tatsächlich gebaute ausführbare Datei, diesen Launcher und
ein frisches Evidence-Verzeichnis übergeben; den vollständigen Aufruf enthält G in checks.json.
Der Test erstellt seinen eigenen Vault und öffnet keinen vorhandenen Nutzervault.

Der Test erzeugt ausschließlich einen eigenen synthetischen Vault. Er bedient den realen
GTK-Dateidialog, die Tauri-WebView über AT-SPI und echte X11-Tasten/Pointer. Es gibt weder
`invoke`-Interception noch DOM-Skriptauswertung oder vorgefertigte native Save-Antworten.

1. Neuer Vault im Systemdialog; eine Basis „P43 Offlinebasis“ speichern.
2. „P43 Kleif“, Charakter/NPC; freien Beruf setzen, zurück/vor und alle Katalogseiten bis Review.
3. 16 automatisch erzeugte Markdown-Dateien prüfen; Dashboard lädt Name, Seite und echten
   Antwortzustand. Nach Weiterbearbeitung existiert weiterhin genau ein kanonisches Profil.
4. Synthetisches 32×48-RGBA-Original öffnen. Echter Pointer markiert 144 Kopf-Quellpixel;
   numerisches Rechteck markiert 280 Torso-Pixel. Beide unabhängigen Masken überlappen um 45 Pixel.
   13 nicht dargestellte Pflichtteile werden mit Begründung ausgelassen; das Manifest ist
   deshalb ausdrücklich `complete: false`, nicht ein behauptetes vollständiges 15-PNG-Set.
5. Zwei PNGs und `sprite.parts.json` wirklich generieren; Hashes und Masken auf dem Datenträger
   prüfen. Der separate native Generierungstest N prüft zusätzlich alle 15 Standardteile pixelgenau.
6. Dasselbe Set in Sprite öffnen; Ebenen umordnen, Torso unsichtbar/sperren, Kopf-Position,
   Pivot, Rotation und Skalierung ändern. Ungültige Position hält WM-Close auf und lässt die
   Szenendatei unverändert. Eine noch nicht autosavte Position 42.25 wird durch Close geflusht.
7. Prozessende 0, Neustart, Vault/Set erneut öffnen. Position `(42.25, -5.5)`, Pivot
   `(0.25, 0.75)`, Rotation 90°, Skalierung `(1.5, 2)`, Sichtbarkeit, Sperre und Reihenfolge
   sind erhalten. Original, PNGs und Manifest bleiben byteidentisch.
8. Native Mindestgrößen-Hints 480×360, echte 480×360-/960×540-Resizes, Modal-Tastaturfokus,
   Escape und echter 200-%-WebKit-Zoom werden gesondert gemessen. Browserlayout deckt
   1920×1080, 1440×900, 960×540, 720×450, 640×480, 480×360 plus Zoom-Äquivalent ab.
9. JSON, Profilordner und Markdown im echten Linux-Dateimanager prüfen. Windows-Fensterzahl
   und macOS-Finder sind damit **nicht** nachgewiesen.

Containerbesonderheit: Für die isolierte GUI wurden WebKit-Hilfsprozesspfade auf einen
temporären Bibliotheksbaum umgeleitet; Software-Rendering und prozesslokal
`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` waren nötig. Das wurde **nicht** in Produktcode,
Startskripte oder globale Capability/CSP übernommen. Dies ersetzt keine Sandbox-Abnahme
auf einem regulär installierten Desktop. Native Screenshots/Logs enthalten nur synthetische
Daten; Pfade und Prüfsummen sind im JSON referenziert.

## Nachweismatrix T01–T27

Jede Zeile nennt konkrete aktuelle Testnamen. F/N/B verweisen auf die oben ausgeführten
Befehle; G auf den nativen Treiber. Die vollständigen Namen stehen zusätzlich in den Logs.

| Test | Konkrete aktuelle Nachweise | Bewertung |
|---|---|---|
| T01 | B `renders one shared shell and retains independent module navigation`; `P37 Welcome cannot reach retired Cutout functions or issue legacy RPCs` | bestanden |
| T02 | F `useModalFocus` / `Modal`-Dismiss- und Fokusfälle; B `global settings commit once and apply to all three modules`; G `desktop_checks` | bestanden im ausgeführten Umfang |
| T03 | B `P38 pointer coordinates, cancelled strokes and responsive flyouts remain usable`; `P43 sprite View and settings remain keyboard accessible across the complete size matrix`; G Resize/Zoom | Linux/Browser, nicht Windows/macOS |
| T04 | F `waits for flush, discards late listing responses on vault switch, and releases listeners`; `rejects a delayed result after a vault generation changes` | bestanden |
| T05 | N `only_global_metadata_and_runtime_coordination_use_the_admin_directory`; `round_trip_contains_only_global_ui_fields`; F produktiver Vault-Adapter/SaveQueue | bestanden; Browser-Fixture-Storage ist ausdrücklich kein Produktstorage |
| T06 | N `base_profile_is_a_single_cas_path`; F `VaultProfileView` / Basis-Dialog; G echte Basisanlage | bestanden |
| T07 | N `raw_drafts_survive_without_a_valid_identity`; F `journals incomplete identity with the lossless V2 draft embedded` / Autosave; G automatische MDs | bestanden |
| T08 | N `interrupted_file_set_resumes_to_one_complete_generation`, `every_critical_migration_boundary_is_blocked_until_recovery_and_yields_one_canonical_set`, `full_disk_before_staging_and_failed_publication_recover_without_false_success` | bestanden in injizierten Fehlerfenstern |
| T09 | N `a_second_process_opens_read_only_until_the_writer_process_exits`, `scene_cas_checks_revision_scene_hash_basis_hash_and_current_manifest`, `external_change_in_backup_window_is_preserved_as_conflicting_backup` | bestanden |
| T10 | N `generic_identity_paths_names_and_vault_schema_stay_validated`, `relocates_a_stable_profile_id_when_its_identity_path_changes`, `foreign_directory_case_alias_and_modified_owned_files_are_never_taken_over` | bestanden |
| T11 | N `confirmed_migration_is_journaled_verified_and_idempotent`, `legacy_preview_never_creates_repairs_or_deletes_source_files`, `legacy_preview_refuses_oversized_and_future_data`; F Migrationsplan/-Dialog | bestanden |
| T12 | N `reveal_accepts_only_existing_portable_vault_targets`, `reveal_rejects_symlinked_files_and_parents`; G echter Thunar | Linux geprüft; Windows/macOS offen |
| T13 | N `tampered_mask_or_snapshot_and_escaping_paths_are_rejected_without_replacement`, `missing_changed_wrong_size_and_unsafe_manifest_members_are_rejected`, `parent_swapped_before_publication_never_redirects_the_write`; S Capability-Policy | geprüfte Fälle bestanden; H1 beachten |
| T14 | N `sorts_pages_filters_and_detects_external_creation_rename_and_deletion`, `corrupt_profiles_are_isolated_and_duplicate_ids_cannot_be_loaded`; F veraltete Scan-/Watcherantworten | bestanden |
| T15 | F `keeps all nine categories, every old subtype, and every required example`, `derives the normative folder and reserves case-insensitive collisions`; B P35-Vaultworkflow | bestanden |
| T16 | F `maps every existing wizard field to a stable page`, `GuidedWizardEngine`, `WizardView`-Rundläufe; G paginierter Wizard und Antwortprüfung | bestanden; native Stichprobe Charakter/NPC, weitere Typen automatisiert |
| T17 | F `counts profiles, keeps nine usable categories, searches subtypes and hydrates full answers after flushing`; `promotes the valid last wizard step and hydrates it again from V3 files` einschließlich P43-ID-Regression; G Ein-Profil-Rundlauf | bestanden |
| T18 | N `reads_all_sixteen_persisted_parts_after_reopening_without_an_index`; F `displays all 16 committed outputs and reveals the selected MD or profile JSON without export actions`; Generatorinventar | bestanden |
| T19 | N `an_updated_base_makes_the_same_saved_generation_stale`; F Vault-Generierung/Regenerierung und fehlgeschlagene Publikation | automatisierte Fälle bestanden |
| T20 | N `removed_commands_are_rejected_by_the_actual_production_handler`, `opening_an_actual_legacy_vault_preserves_every_original_file_hash`; S `test_p37_removes_legacy_product_sources_and_imports`; A | bestanden; 19 Legacy-Dateihashes, keine Löschung von Nutzerdateien |
| T21 | N `native_listing_checks_session_generation_close_and_read_budget`, `large_directory_is_paged_without_decoding_pixels_and_limits_are_enforced`; F `DataFolderWorkflow`; G Dateiauswahl/Set | bestanden |
| T22 | N `catalog_preserves_anatomical_side_filenames_and_optional_slot_numbers`; F Masken-/Viewport-Tests; B P38 DPR 1.25/2, Zoom/Pan/Resize; G Pointer-Rechteck | bestanden |
| T23 | N `touching_same_color_parts_have_a_deterministic_seed_boundary_and_an_honest_warning`, `protected_overlaps_survive_outside_roi_but_not_invisible_or_hard_negative_pixels`, `cancellation_interrupts_real_work_and_reports_measured_latency`; B P39 | synthetische Qualitäts-/Abbruchfälle bestanden; keine allgemeine Segmentierungsgarantie |
| T24 | N `all_fifteen_names_pixels_alpha_hashes_coordinates_and_canonical_reopen_are_exact`, `crop_preserves_invisible_rgb_clamps_padding_and_allows_independent_overlap`, `regeneration_deletes_only_owned_extras_preserves_scene_and_switches_slot_without_renumbering`; G Zweiteilebild | bestanden |
| T25 | N `scene_roundtrip_preserves_every_transform_without_writing_parts_or_manifest`, `new_generation_requires_confirmation_and_preserves_source_anchors_and_stable_parts`, `legacy_requires_manual_alignment_even_for_equal_sized_parts_and_never_falls_back_from_bad_manifest`; B P41/P42/P43; G Restart | bestanden |
| T26 | F Fokus-/Tastaturtests; B P38-Flyout, P42 Tastaturreihenfolge, P43 Modal-Tab/Shift+Tab und View; G Fokus/200 % | Kernbedienung geprüft; keine vollständige Screenreader-/WCAG-Zertifizierung |
| T27 | G vollständiger Seccomp-Offline-Rundlauf; L geprüftes DEB; vorhandener `tauri smoke`-Einstieg | Linux-Nachweis; übrige Plattformen offen |

## Vollständige Zuordnung der 52 Anforderungen

„Geprüft“ bedeutet die oben benannten ausgeführten Fälle, nicht eine unbeschränkte
Plattform-/Angreifergarantie. Einschränkungen sind nicht durch ein grünes Gesamtsymbol verdeckt.

| Anforderung | Nachweis | Status |
|---|---|---|
| R-G01 | T01, T02 | geprüft |
| R-G02 | T02 | geprüft |
| R-G03 | T01, T03 | geprüft |
| R-G04 | T03 | Linux/Browser geprüft; andere Plattformen offen |
| R-G05 | T01, T24, T27 | geprüft |
| R-G06 | T02, T03, T26 | geprüfte Kernbedienung; Zertifizierung nicht behauptet |
| R-G07 | T27 | Linux offline geprüft |
| R-G08 | T01, A | geprüft |
| R-D01 | T04, T05 | geprüft |
| R-D02 | T05 | geprüft |
| R-D03 | T06 | geprüft |
| R-D04 | T07, T16 | geprüft |
| R-D05 | T08, T09 | geprüfte Fehlerfenster; H1 beachten |
| R-D06 | T10 | geprüft |
| R-D07 | T11 | geprüft |
| R-D08 | T12 | teilweise: Windows-Neufenster und Finder offen |
| R-D09 | T13 | geprüfte Fälle; vollständige Race-Härtung H1 offen |
| R-D10 | T14 | geprüft |
| R-P01 | T15 | geprüft |
| R-P02 | T07, T15 | geprüft |
| R-P03 | T06 | geprüft |
| R-P04 | T16 | geprüft |
| R-P05 | T16 | geprüft |
| R-P06 | T16 | geprüft |
| R-P07 | T17 | geprüft |
| R-P08 | T17 | geprüft, inklusive stabiler Weiterbearbeitungs-ID |
| R-P09 | T18 | geprüft |
| R-P10 | T18 | geprüft |
| R-P11 | T16, T17 | geprüft |
| R-P12 | T19 | geprüft |
| R-C01 | T20 | geprüft |
| R-C02 | T20 | geprüft |
| R-C03 | T21 | geprüft |
| R-C04 | T21, T22 | geprüft |
| R-C05 | T22 | geprüft |
| R-C06 | T23 | synthetische Fälle geprüft; manuell korrigierbare Heuristik |
| R-C07 | T22, T26 | geprüft, zusätzlich beschriftete Kanalzahlen |
| R-C08 | T23, T27 | geprüft |
| R-C09 | T24 | geprüft |
| R-C10 | T10, T24 | geprüft |
| R-C11 | T22, T24 | geprüft |
| R-C12 | T23 | geprüft |
| R-C13 | T24, T27 | geprüft |
| R-C14 | T24 | geprüft; Recovery-only-Quellverlust siehe H2 |
| R-S01 | T01, T25 | geprüft |
| R-S02 | T21, T25 | geprüft |
| R-S03 | T25 | geprüft |
| R-S04 | T25 | geprüft |
| R-S05 | T05, T25 | geprüft |
| R-S06 | T24, T25 | geprüft |
| R-S07 | T25 | geprüft |
| R-S08 | T25 | geprüft |

## Offene Punkte und bekannte Grenzen

| ID | Konkret offen / Grenze | Bedeutung / nächster Nachweis |
|---|---|---|
| W1 | Keine Windows-Desktopumgebung | MSI/NSIS, native Close/DPI/Dialoge und insbesondere **neues Explorer-Fenster mit ausgewählter Datei** nativ messen; kein grünes Windows-Prädikat |
| M1 | Keine macOS-Desktopumgebung | App/DMG, Finder, Close, Retina/Zoom und Dialoge nativ prüfen; kein grünes macOS-Prädikat |
| H1 | Dateisystemzugriff ist nicht durchgehend an geöffnete Verzeichnis-FDs/Handles gebunden | Geprüfte Pfadtauschfenster werden abgewiesen; ein gleichzeitig absichtlich manipulierender lokaler Prozess ist nicht durch eine vollständige TOCTOU-Garantie abgedeckt. Für diese strengere R-D09-Garantie ist zusätzliche plattformgerechte Härtung erforderlich. Keine uneingeschränkte Sicherheits-/Releasefreigabe |
| H2 | Original fehlt und noch kein Set wurde erzeugt | Ein reines Recovery-Cutout ohne Original ist nach Neustart nicht separat auswählbar; unverändertes Original am alten relativen Pfad wiederherstellen. Bereits geladene/kanonische Sets unterstützen die geprüfte explizite Snapshot-Fortsetzung |
| U1 | Minimaler Docker-Desktop benötigt Prozess-Workarounds | Regulär installierten Linux-Desktop mit aktivierter WebKit-Sandbox zusätzlich prüfen; Xvfb ist kein physischer Monitor-/Eingabegeräte-Nachweis |
| D1 | `python tools/control.py docs check` meldet 82 bestehende Tooling-Dokumentationsprobleme | Vor P37 reproduziert: unabhängige Tooling-Dokumentation erwartet andere Indexmarker. `tools/` und `docs/toolingdocs/` bleiben unverändert; keine fachfremde Massenkorrektur. Produktverweise separat prüfen |

Weitere Produktgrenzen: 16 MiB Eingabedatei, 16 MP / 8192 px Kante, begrenzte RLE-Masken und
History; Szene-/Set-Budgets siehe Cutout-/Sprite-Anleitungen. Keine anatomische KI, Ergänzung
verdeckter Körperteile, Timeline oder Godot-Ausgabe. Halbtransparente Überlappung folgt Source-over
und kann dadurch deckender als das Original werden. Unbekannte Formate/Versionen werden nicht
mit Defaults repariert. Fehlgeschlagene Saves müssen gegebenenfalls nach Behebung erneut
bestätigt werden. Harte Prozessabbrüche ersetzen keinen erfolgreichen Flush.

**Abschlussgrenze:** P43 liefert Implementierung, ausgeführte Nachweise und diese offene Liste.
Er ist kein Auftrag zum Publizieren. Windows/macOS-Freigaben und die verbleibende H1-Härtung
werden nicht als erledigt bezeichnet. Rohlogs sind zunächst sitzungsflüchtig; das referenzierte
Evidenzarchiv bewahrt die ausgewählten Abschlussnachweise im lokalen Build-Ausgabebereich.
