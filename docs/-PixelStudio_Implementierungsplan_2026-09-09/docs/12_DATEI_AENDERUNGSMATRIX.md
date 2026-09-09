# 12 · Datei- und Änderungsmatrix

**„Bestehend“** bedeutet, dass die Datei gelesen oder ihr Pfad in der Repository-Struktur/Imports bestätigt wurde. **„Neu“** bedeutet vorgeschlagene Neuanlage. Vor Löschungen sind Import- und Command-Graph zu prüfen. Ein Verzeichnispfad ist kein Freibrief für unkontrolliertes rekursives Löschen.

| Anker | Status | Geplante Änderung | Phase |
|---|---|---|---|
| `frontend/src/app/App.tsx` | bestehend | Shell/Vault-Koordination entkoppeln; alte Fachrouter und Handoff entfernen | P29, P30, P37 |
| `frontend/src/app/navigation.ts` | bestehend | `sprite` ergänzen, Prompt-`settings` entfernen, neue Cutout-/Sprite-Routen | P29, P35, P37, P41 |
| `frontend/src/main.tsx` | bestehend | Globalen Bootstrap vom fachlichen Prompt-Storage lösen | P29–P32 |
| `frontend/src/components/AppHeader.tsx` | bestehend | Drei Studio-Schalter, Zahnrad neben Hilfe | P29 |
| `frontend/src/components/DialogLayer.tsx` | bestehender Import-Anker | Auf Wiederverwendung prüfen oder durch gemeinsamen ModalHost ersetzen | P29 |
| `frontend/src/styles/global.css` | bestehender Import-Anker | Responsive Shell, Tokens, Mindestgrößen, Modulkonsistenz | P29, P43 |
| `frontend/src/shared/navigation/ModuleNavigationRow.tsx` | neu | Gemeinsame immer vorhandene Modulzeile | P29 |
| `frontend/src/shared/dialogs/Modal.tsx` | neu | Einheitliche X-/Escape-/Außenklick-Logik und Fokussteuerung | P29 |
| `frontend/src/shared/settings/` | neu | Globale Einstellungen; keine Profilfelder | P31 |
| `frontend/src/shared/vault/` | neu | ActiveVaultProvider, SessionCoordinator, sichere Wechsel | P30 |
| `frontend/src/shared/storage/` | neu | Asynchrone Repositories, SaveQueue, Fehlercodes, Revisionen | P30, P32 |
| `frontend/src/prompt-studio/app/{AppShell,PromptGeneratorRoot}.tsx` | bestehend | Settings-Provider/Routing, Bibliothek und doppelte Navigation lösen | P29, P32–P35 |
| `frontend/src/prompt-studio/app/appViewConfig.ts` | bestehender Struktur-Anker | Nur vier Prompt-Menüpunkte | P35 |
| `frontend/src/prompt-studio/services/{promptWorkspaceStorage,storageAdapter,workspaceBootstrap}.ts` | bestehend/Struktur-Anker | Produktiven V2-/Browser-Speicher ersetzen; Legacy-Lesen isolieren | P31, P32 |
| `frontend/src/prompt-studio/features/profiles/` | bestehender Import-Anker | Vaultanzeige und ein Basisprofil-Button statt Bibliotheksverwaltung | P33 |
| `frontend/src/prompt-studio/features/wizard/{WizardView,WizardEngine}.tsx` | bestehend | V3-Hydration, Name, Seitenfolge ohne Basisprofil | P34 |
| `frontend/src/prompt-studio/features/wizard/{GuidedWizardEngine,WizardCoreStepContent}.tsx` | bestehende Import-Anker | Fragegruppen wirklich seitenweise, stabile IDs, Werteerhalt | P34 |
| `frontend/src/prompt-studio/features/dashboard/dashboardCatalog.ts` | bestehend | Neun Typen beibehalten, Pflicht-Untertypen ergänzen | P28, P35 |
| `frontend/src/prompt-studio/features/dashboard/` | bestehend | Vault-Scan, Typkarten, Namens-Popup, vollständiges Laden | P35 |
| `frontend/src/prompt-studio/features/review-output/` | bestehender Import-Anker | Alle Ausgaben behalten, Export-/Kopier-/Handoff-Aktionen entfernen | P35 |
| `frontend/src/prompt-studio/features/settings/` | bestehender Import-Anker | Fachseite abbauen, geeignete allgemeine Controls global übernehmen | P31, P35 |
| `frontend/src/prompt-studio/schemas/` | bestehend | V2-Leseadapter bewahren; neue V3-Hüllen und partielle Draft-Validierung | P28, P32–P34 |
| `frontend/src/api/prompt-studio-client.ts` | bestehend | Alten Area-Handoff entfernen/ersetzen | P32, P37 |
| `frontend/src/shared/data-folder/` | neu | Gemeinsamer Datei-/Ordnerbaum und optionale View-Erweiterung | P36 |
| `frontend/src/shared/canvas/` | neu | Quellpixel-Koordinaten, Fit/Zoom/Pan, begrenzte Rendering-Adapter | P38 |
| `frontend/src/cutout-studio/` | neu | Willkommen, Editor, Masken, Werkzeuggruppen, Generierung | P37–P40 |
| `frontend/src/sprite-studio/` | neu | Willkommen, Manifestloader, Canvas, View-Ebenen, Szene | P41, P42 |
| `frontend/src/features/{animations,areas,directions,dummy-editor,export,inventory,npcs,outfit,projects,timeline}/` | bestehende Struktur | Alte Fachfunktionen aus produktivem Build entfernen; benötigte allgemeine Helfer vorher extrahieren | P37 |
| `frontend/src/features/{editing,vault}/` | bestehend | Allgemeine Guard-/Recovery-Funktionen prüfen, fachlich gekoppelte Teile ersetzen | P30, P37 |
| `src-tauri/src/lib.rs` | bestehend | App-Data-Prompt-Setup und alte Commands/Registries abbauen, neue Services registrieren | P30, P31, P37–P42 |
| `src-tauri/src/storage/` | bestehend | Safe-Path/Lock/Transaction prüfen und allgemein weiterverwenden; prompt_workspace nur Legacy | P30, P31 |
| `src-tauri/src/workspace/` | neu | Session-/Pfad-/Dateibaum-/Transaktionsservice | P30, P36 |
| `src-tauri/src/prompt_vault/` | neu | Einzeldateiprofile, Basis, Output-Commit, Migration | P31, P32 |
| `src-tauri/src/cutout/` | neu | Decoder, Masken, Auswahlhilfe, PNG-Generation | P38–P40 |
| `src-tauri/src/sprite/` | neu | Manifestprüfung, Szenenpersistenz | P41, P42 |
| `src-tauri/tauri.conf.json` | bestehend | Fenstergrenzen, gezielte Asset-/Worker-CSP-Anpassungen | P29, P36, P38 |
| `src-tauri/Cargo.toml`, `frontend/package.json` und Lockfiles | bestehend | Nur notwendige Plugin-/Decoderänderungen, keine pauschalen Upgrades | P35, P38–P40 |
| `frontend/src/app/App.*.test.tsx`, `frontend/e2e/` | bestehende Test-Anker | Neue Zielabläufe; alte Fachtests dokumentiert ablösen | alle, P43 |
| `.github/workflows/ci-studio.yml` | bestehender README-/Struktur-Anker | Neue native Mindestgrößen und produktbezogene Prüfliste | P43 |
| `tools/`, `docs/toolingdocs/` | bestehend | Portables Tooling nicht zum Kollateralschaden des Rückbaus machen | alle |

## Was nicht still geändert werden darf

Keine automatischen Umbenennungen des GitHub-Repositories, der nativen App-ID oder aller Paketnamen. Keine erneute Lizenzierung übernommenen Codes. Keine Abschaltung bestehender Sicherheitschecks zur Vereinfachung der neuen Funktionen. Keine Umwandlung des Plans in einen ungeprüften „Rewrite alles“-Auftrag. Neue Dateinamen können an Projektkonventionen angepasst werden, sofern die Module und Zuständigkeiten gleich bleiben und die Abweichung dokumentiert ist.
