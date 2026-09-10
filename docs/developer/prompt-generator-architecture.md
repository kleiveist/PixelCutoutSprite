# Gemeinsame Studio- und Prompt-Architektur

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

Stand: P43 · 10. September 2026.

## Produktiver Aufbau

```text
App
└── GlobalSettingsProvider → ActiveVaultProvider / SaveQueue
    └── DataFolderProvider → VaultPromptProvider
        ├── AppHeader + eine ModuleNavigationRow
        ├── exklusiver RecoveryPanel bei offenen alten Journalen
        ├── Cutout: DataFolderWorkspace → CutoutStudio / CutoutController / MaskCanvas
        ├── Prompt: PromptGeneratorRoot → vier PromptView-Ziele
        └── Sprite: SpriteStudio / SpriteController → DataFolderWorkspace / View / Canvas
```

Nur das aktive Modul ist sichtbar/montiert. Sitzung, Generation, SaveQueue und getrennte
Bild-/Set-Auswahlen bleiben oberhalb der Module. Es gibt keine `WorkspaceRoute`,
Projekt-/Area-Auswahl oder alten Editorcontroller mehr. Gemeinsame Vault- und Recovery-Komponenten
liegen unter `frontend/src/shared/vault/`; die generische Fehlerklassifikation liegt unter
`shared/storage/nativeErrors.ts`.
Vault-Client/DTOs gehören ebenfalls `shared/vault`, StudioMode der gemeinsamen Navigation
und der Modal-Fokus-Hook `shared/dialogs`; Shared importiert keine App-/API-/UI-Schicht.

## Speicherung und Lebenszyklus

Die produktive Prompt-Persistenz verwendet `VaultPromptRepository`,
`VaultPromptAutosave` und die sitzungsgebundene `SaveQueue`.
Rust prüft Session-ID/Generation, Schreibrecht, Pfade, Revisionen und Prüfsummen.
Basis, Drafts, Profile und Markdown-Generationen liegen unter `.PixelPrompt/`.
Neue gemeinsame Metadaten liegen unter `.PixelStudio/`.

Der V2-Wizard erhält eine validierte In-Memory-Kompatibilitätssicht. Sie ist kein
AppData-/LocalStorage-Fallback. Der alte native AppData-Schreibadapter sowie native
Paketimport-/Download-Commands wurden entfernt. `read_legacy_prompt_workspace` bleibt
als begrenzte, nicht reparierende Read-only-Quelle für die ausdrücklich bestätigte Migration.

Studio-/Vault-Wechsel warten auf den Flush. Ein Fehler hält den bisherigen Kontext fest.
Ein erfolglos aktivierter neuer Vault wird geschlossen. Native Close-Requests sichern
zuerst die Queue und schließen anschließend die Vault-Sitzung.
Fehler aus Datei- und Prompt-Clients können einen neuen Journalfund an den gemeinsamen
Recovery-Dialog melden; verspätete Antworten einer anderen Sitzung werden ignoriert.

## Entfernte Verbindung

Kein `PromptHandoff`, Area-Handoff-Client oder registrierter Handoff-Command bleibt übrig.
Vorhandene `prompt-references/` sind normale alte Nutzerdateien. Die Verbindung der Module
ist die gemeinsame Dateistruktur. P38–P42 ergänzen die beiden neuen Bildeditoren auf diesem Rahmen.

## Native Grenze

Produktiv bleiben Vault-/Recovery-, globale Settings-, Workspace-Dateilese- und
Prompt-Vault-, Cutout-/Auswahlhilfe-/Generierungs- und Sprite-Commands.
`src-tauri/src/lib.rs` ist die einzige Handler-Komposition.
Die früheren Animations-/Render-/Export-/Asset-Import-Registries und Fachservices fehlen.
`JsonStore<T: StoredJson>` braucht keinen Dispatcher alter Fachmodelle.

`cutout/` besitzt normalisierte Quellbilder, RLE-Masken, lokale Segmentierungsjobs und
kanonische PNG-Generationen. `sprite/` validiert vollständige Sets und Szenen-CAS, ohne PNGs
bei einer Transformation zu ändern. Der gemeinsame `WorkspaceWriter` publiziert Dateisätze
mit Prepared-/Applying-/Committed-Journal; Manifest bzw. Szene stehen am Ende der Veröffentlichung.
P43 ergänzt create-only Publikation nach dem Backup und bewahrende Recovery bei Fremddaten.

Die frontendseitige Fensterfreigabe wartet auf alle SaveQueue-Owner. Nur das Hauptfenster
besitzt `core:window:allow-destroy`, damit es danach geschlossen werden kann. Die zusätzliche,
auf `main` begrenzte `core:webview:allow-set-webview-zoom` erlaubt Tauri-Oberflächenzoom per
Tastatur. Es gibt keine zusätzliche Shell-/Dateisystem-/Remote-Capability und keine globale
CSP-Abschaltung.

Passive alte Dokumentdiscriminators und Scope-Regeln dienen ausschließlich dazu, bestehende
Transaktionsjournale sicher zu prüfen. Sie sind keine CRUD- oder Editor-API.
Der Handler-Negativtest verwendet die echte `compose`-Funktion mit Tauri-Testtransport,
einschließlich positiver Identitätskontrolle und 72 abgewiesener alter Commands.

## Bundle und Nachweise

Die bestehende WebKit-sichere Gruppierung der Prompt-Domain-/Feature-/Store-Module bleibt
erhalten; keine erzwungene zyklische Chunk-Aufteilung wurde eingeführt.
Ein einzelner Header, gemeinsame Dialoge und scoped Prompt-CSS bleiben erhalten.

Tests und native Abgrenzungen:
[P43-Abnahme](acceptance/P43-gesamtabnahme_haertung_dokumentation.md) und
[P37-Rückbau](acceptance/P37-cutout_altbasis_entfernen_willkommen.md).
Die [P27-Architekturabnahme](acceptance/prompt-studio-integration.md) ist historisch.
