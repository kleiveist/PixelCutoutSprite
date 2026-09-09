# 03 · Zielarchitektur

## Eine Shell, drei Fachmodule

```text
DesktopShell
├── AppHeader: Prompt | Cutout | Sprite              ⚙  ?
├── ModuleNavigationRow: immer vorhanden, nur einmal
├── ActiveVaultProvider / SessionCoordinator
├── GlobalSettingsProvider / ModalHost / SaveStatus
└── ActiveModule
    ├── PromptModule: Dashboard | Profile | Wizard | Ausgabe
    ├── CutoutModule: Willkommen | Editor
    └── SpriteModule: Willkommen | Studio
```

Die Shell ist Eigentümerin des aktiven Vaults, der globalen Darstellung, des Dialog-Hosts und des Modulwechsels. Module besitzen keine zweite Vault-Auswahl, keine eigene globale Theme-Verwaltung und keine voneinander abweichenden Navigation-Rows. Auf den beiden Bildseiten wird dieselbe `DataFolderToolbar` verwendet; PixelSpriteStudio ergänzt deren Register `View`.

## Persistenzgrenzen

| Bereich | Erlaubte Inhalte | Nicht erlaubt |
|---|---|---|
| Native App-Konfiguration | Theme, UI-Sprache, Dichte, Fensterzustand, optional zuletzt gewählter Vault-Pfad | Profile, Wizard-Antworten, Basisprofile, Masken, Bildteile, Szenen oder fachliche Backup-Kopien |
| Aktiver Vault | Sämtliche fachlichen Dateien, lokale Recovery-Daten, optional wiederaufbaubarer Index | Abhängigkeit von einer zentralen Profilbibliothek außerhalb des Vaults |
| Arbeitsspeicher | Geladene Dokumente, Thumbnails, temporäre Auswahl, Undo-Puffer, Index-Cache | Behauptung einer dauerhaften Speicherung vor bestätigtem Backend-Schreibvorgang |
| Browser-Testadapter | Expliziter In-Memory-Testzustand | Produktives Persistenz-Fallback in localStorage oder IndexedDB |

Der technische Vollzug darf weiterhin über Rust/Tauri erfolgen. „Nicht mehr in der Tauri-App speichern“ bedeutet hier: kein fachlicher App-Data-Speicher, nicht „keine nativen Dateisystembefehle“.

## Vorgeschlagene Modulgrenzen

Frontend-Neuanlagen: `frontend/src/shared/{vault,storage,settings,dialogs,navigation,data-folder,canvas}/`, `frontend/src/cutout-studio/`, `frontend/src/sprite-studio/`. Das bestehende `frontend/src/prompt-studio/` wird gezielt angepasst. Diese Pfade sind Vorschläge für neue Dateien, keine Behauptung über schon vorhandenen Code.

Rust-Neuanlagen bzw. extrahierte Module: `src-tauri/src/workspace/`, `src-tauri/src/prompt_vault/`, `src-tauri/src/cutout/`, `src-tauri/src/sprite/`. Allgemeine Funktionen aus `storage/` werden nur übernommen, wenn sie keine versteckten alten Projekt-/Area-Annahmen besitzen. Neue `WorkspaceService`-Sitzungen ersetzen die alten Fachobjekt-Dashboards.

Reine Domänenlogik kennt weder React noch Tauri. Komponenten sprechen Repository-Interfaces an. Native Clients kapseln IPC. Rust validiert erneut und ist alleinige Schreibinstanz. PNG-Decodierung und große Segmentierungsaufgaben laufen außerhalb des UI-Threads. Ein neuer globaler State-Manager ist nicht Voraussetzung; bestehende React-Provider plus zustandsorientierte Services reichen als Ausgangspunkt.

## Sitzungs- und Lebenszyklusmodell

`ActiveVault` enthält mindestens `vaultId`, einen kurzlebigen `sessionId`, eine `sessionGeneration`, den Anzeigenamen und Schreibmodus. Absolute Pfade bleiben in Rust; das Frontend erhält bei Bedarf einen ausschließlich zur Anzeige bestimmten Pfad. Fachdateien verwenden relative Pfade mit `/` als serialisiertem Trenner.

Jeder Auftrag erfasst seine Sitzung **beim Erstellen**. Debounce-Timer, Renderer-Aufträge, Watcher und Commit-Antworten dürfen sich nicht nachträglich den inzwischen aktiven Vault holen. Bei Vault-Wechsel wird zuerst die bisherige Schreibwarteschlange abgeschlossen; ein Fehlschlag hält den bisherigen Kontext sichtbar. Erst danach werden Listener abgemeldet, Bild-URLs freigegeben und neue Provider mit neuer Sitzungskennung aufgebaut.

Ein Modulwechsel innerhalb desselben Vaults verliert keinen bereits gespeicherten Entwurf. Ein Wechsel während einer laufenden Segmentierung verwirft alte Ergebnisantworten anhand von Bild-, Masken- und Auftragsrevision. App-Schließen nutzt den nativen Close-Request und versucht einen expliziten Flush; ein Browser-`beforeunload` allein ist keine zuverlässige Speicherstrategie.

## Vorschlag für native Anwendungsbefehle

| Befehl | Zweck und wichtigste Eingaben |
|---|---|
| `open_workspace`, `close_workspace` | Benutzergewählten Vault öffnen; neue Sitzung bzw. kontrollierter Flush |
| `list_workspace_entries` | Relativer Ordner, Filter und Cursor; begrenzte, sortierte Einträge |
| `read_base_profile`, `save_base_profile` | Genau eine Basisdatei; Compare-and-swap mit `expectedRevision` |
| `list_prompt_profiles`, `read_prompt_profile` | Profile im aktiven Vault suchen bzw. vollständig laden |
| `save_prompt_draft` | Rohzustand dauerhaft sichern; vor gültiger Identität in `.drafts` |
| `commit_prompt_generation` | Validierten Profilsnapshot und alle zugehörigen MDs gemeinsam veröffentlichen |
| `rename_prompt_asset` | Name/Typ/Untertyp als kontrollierte Verzeichnis- und Dateiumbenennung |
| `read_image_asset` | Autorisierte Bilddatei decodieren; begrenzte Metadaten und Bildhandle |
| `save_cutout_project`, `refine_part_selection` | Maskenzustand sichern bzw. revidierbare Auswahlhilfe ausführen |
| `generate_sprite_parts` | PNGs und Teilemanifest aus exakt einer Schnittrevision erzeugen |
| `read_sprite_set`, `save_sprite_scene` | Manifest prüfen, Teile laden, Ebenen/Transformationen sichern |
| `reveal_workspace_path` | Validierte Vault-Datei/Ordner im Betriebssystem-Dateimanager anzeigen |
| `inspect_legacy_prompt_data`, `apply_prompt_migration` | Kontrollierter Einmal-Leseweg und bestätigte Migration |

Die Namen sind Zielvorschläge. P28/P30 legen finale Rust-/TypeScript-DTOs gemeinsam fest. Keine Komponente darf generische „write arbitrary path“-Befehle bekommen.

## Schreib- und Fehlermodell

Jeder schreibbare Datensatz besitzt `revision`. Aufrufe tragen `expectedRevision`; veraltete Änderungen werden nicht still überschrieben. Zusätzlich werden Datei-Hashes geprüft, damit externe Änderungen erkannt werden. `draftRevision` kennzeichnet den fachlichen Wizard-Inhalt; eine reine Ausgabe-Neuberechnung muss ihn nicht verändern.

Fehlercodes werden typisiert: `NO_VAULT`, `READ_ONLY`, `INVALID_NAME`, `PATH_ESCAPE`, `CONFLICT`, `SOURCE_CHANGED`, `INVALID_SCHEMA`, `UNSUPPORTED_VERSION`, `IO_ERROR`, `RECOVERY_REQUIRED`, `CANCELLED`, `IMAGE_TOO_LARGE`. UI-Meldungen sind deutsch und nennen eine sichere nächste Handlung. Logs enthalten nicht automatisch Prompt-Texte oder Bilddaten.

## Sicherheitsgrenzen

Der Root wird kanonisiert. Pfadsegmente werden unabhängig von der UI geprüft. `..`, absolute/manipulierte Pfade, NUL, Symlink-/Junction-Fluchten und nicht reguläre Zieldateien werden abgelehnt. Neue Ziele werden über ihren bestehenden Elternpfad und handle-/verzeichnisgebundene Operationen abgesichert; ein einmaliger String-Präfixvergleich reicht nicht. Umbenennungsrennen und Windows-Reparse-Points gehören in die Tests.

Tauri-Capabilities begrenzen die Frontend-Freigaben; Rust muss eigene Pfad- und Sitzungsprüfungen trotzdem selbst durchführen. Dokumentation: T01 in `11_QUELLEN.md`. Keine globale Freigabe des Dateisystems und kein pauschales Deaktivieren der CSP.

Für Bilder bevorzugt einen sitzungsgebundenen Asset-Zugriff oder eine kontrollierte Binärübertragung verwenden. Keine frei eingebetteten `file://`-URLs. Neue Asset-/Worker-Schemes gezielt in der CSP erlauben; das gegenwärtige CSP aus S17 muss dabei mitgeprüft werden. Dekodiergrenzen gelten vor großer Speicherallokation. Kein Cloud-Upload und kein automatisch nachgeladenes Segmentierungsmodell.
