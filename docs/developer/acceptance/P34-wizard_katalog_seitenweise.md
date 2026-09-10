# P34 · Wizard-Katalog seitenweise

> Historischer Stand vor P37. Frühere Cutout-Funktionen und damalige Quellpfade sind keine
> aktuelle Produktzusage. Gültiger Stand und fortgeltende Storage-/Prompt-Nachweise:
> [P37-Abnahme](P37-cutout_altbasis_entfernen_willkommen.md).

Datum: 2026-09-09
Status: Frontend vollständig umgesetzt und automatisiert geprüft; native/echte Browser-Gates sind
umgebungsbedingt offen
Anforderungen: R-D04, R-P01, R-P04, R-P05, R-P06, R-P11

## Ergebnis

Der produktive PixelPromptStudio-Wizard verwendet jetzt die stabile Folge `identity`,
`catalog/<sectionId>` und `review`. Die 51 Katalogseiten decken alle neun Assetkategorien sowie die
Capability-Seiten für Richtungen und Animation ab. Im aktiven Schritt wird jeweils nur das
zugehörige Fieldset montiert; die bisherigen Kompletteditoren bleiben als rückwärtskompatible
Darstellung für bestehende isolierte Aufrufer erhalten.

Das Pflichtfeld **Name des Assets** und ein kompakter, schreibgeschützter Basiskontext stehen über
jeder Katalogseite. Der produktive Flow enthält keinen Basisprofil-Editor und keinen
Basisprofil-Auswahlschritt. Ist noch keine Vault-Basis vorhanden, führt der sichtbare Button in das
bereits in P33 umgesetzte Singleton-Basisprofil-Popup. Die einzige vorhandene Vault-Basis wird in
den Formzustand übernommen, ohne sie im Wizard editierbar zu machen.

`Weiter` validiert die aktuelle Seite und fokussiert das erste zugehörige Fehlerfeld. `Zurück`
behält auch unvollständige, noch nicht validierte Eingaben im React-Hook-Form-Zustand. Fortschritt,
Speicherstatus, `catalogVersion`, `currentStep` und `completedStepIds` werden mit stabilen IDs statt
einer Seitenzahl geführt. Erst die bestätigte `review`-Seite markiert ein V3-Profil als `ready`.

Ein bestätigter Typ-/Untertypwechsel leert ausschließlich klassifikationsabhängige Felder. Name
und Basiswerte bleiben bestehen; der vorherige vollständige Rohzustand wird vor dem Wechsel in der
auf acht Einträge begrenzten `selectionHistory` gesichert. Dadurch werden inkompatible Antworten
weder umbenannt noch still einem anderen Feld zugeordnet.

Gespeicherte V3-Drafts und -Profile werden als vollständige Wizard-Sitzung geladen. Rohwerte,
Profil-ID, aktuelle Seite und abgeschlossene Seiten funktionieren auch dann, wenn kein
`legacyV2Draft` eingebettet ist. Bekannte alte IDs wie `characterDetails`, `baseProfile` oder
`tileability` werden abhängig von der Kategorie auf eine nachvollziehbare aktuelle Seite
abgebildet; Antworten bleiben erhalten.

## Was wurde geändert?

- [`wizardCatalog.ts`](../../../frontend/src/prompt-studio/features/wizard/wizardCatalog.ts)
  definiert Katalogversion, 51 Seiten, Anwendbarkeit, seitenbezogene Zod-Prüfung, alte-ID-Migration
  und die Draft-Projektion einschließlich Rohwert-Backup.
- [`questionnaireInventory.ts`](../../../frontend/src/prompt-studio/domain/catalog/questionnaireInventory.ts)
  ist jetzt ein ausführbarer Vollständigkeitsvertrag: fehlende oder doppelt zugeordnete
  P28-Felder brechen Modulinitialisierung und Tests ab.
- [`GuidedWizardEngine.tsx`](../../../frontend/src/prompt-studio/features/wizard/GuidedWizardEngine.tsx)
  unterstützt permanente Kopfbereiche, persistente Abschluss-IDs, unvollständige Draft-Journale
  und Snapshots vor kontrollierten Klassifikationswechseln.
- [`WizardCoreStepContent.tsx`](../../../frontend/src/prompt-studio/features/wizard/WizardCoreStepContent.tsx)
  stellt den produktiven Katalogflow, den dauerhaften Namen/Basiskontext, die aktive Seitenauflösung
  und die Review-Seite bereit.
- Die neun vorhandenen Kategorieeditoren unter
  [`features`](../../../frontend/src/prompt-studio/features/) erhielten typisierte optionale
  `section`-Props. Ohne Prop rendern sie weiterhin vollständig; im Katalog wird exakt ein echtes
  Fieldset gerendert.
- [`WizardEngine.tsx`](../../../frontend/src/prompt-studio/features/wizard/WizardEngine.tsx) aktiviert
  im produktiven Popup/Vault-Pfad den Katalogflow und übernimmt die einzige Vault-Basis als
  schreibgeschützten Kontext.
- [`wizardDraft.schema.ts`](../../../frontend/src/prompt-studio/schemas/wizardDraft.schema.ts)
  erweitert den internen Draft abwärtskompatibel um `catalogVersion`, eindeutige
  `completedStepIds` und `selectionHistory`.
- [`vaultWizardBridge.ts`](../../../frontend/src/prompt-studio/services/vaultWizardBridge.ts)
  projiziert die neue Position in V3, setzt `ready` erst nach bestätigtem Review und hydratisiert
  V3-Dokumente einschließlich Rohwerten auch ohne Legacy-Nutzlast.
- [`WizardView.tsx`](../../../frontend/src/prompt-studio/features/wizard/WizardView.tsx) lädt bei
  Profil-/Draft-Anforderungen gezielt das V3-Dokument der angeforderten ID statt nur den zuletzt
  gesehenen Kompatibilitäts-Draft.
- [`wizardLifecycle.ts`](../../../frontend/src/prompt-studio/features/wizard/wizardLifecycle.ts)
  überlässt versionierte Katalog-IDs der Katalogmigration, sodass der alte V2-Fallback beim
  Modulwechsel keine gültige P34-Position mehr ersetzt.
- [`WizardView.module.css`](../../../frontend/src/prompt-studio/features/wizard/WizardView.module.css)
  ergänzt responsive Layouts für Kopfkontext und Review, einschließlich einspaltiger Darstellung
  auf schmalen Fenstern.

## Wie wurde es umgesetzt?

1. Das P28-Formschema wurde in Identität, technischen Basiskontext und eindeutige fachliche
   Seitenfelder zerlegt. Ein automatisierter Mengenvergleich beweist, dass jedes Schemafeld genau
   einmal inventarisiert ist.
2. Die bereits fachlich geprüften Editoren wurden nicht kopiert. Ihre bestehenden Fieldsets sind
   über typisierte Abschnitts-Props selektiv montierbar; dadurch bleibt nur die aktive Seite im DOM
   und Unmount-Werte bleiben im übergeordneten Formular erhalten.
3. Die generische Engine führt Abschlusszustand getrennt von der aktuellen Position. Änderungen
   invalidieren die aktuelle und spätere Fertigstellung, Vorwärtsnavigation schließt die geprüfte
   Seite ab, Rücknavigation verwirft den Abschlusszustand nicht.
4. Der Bridge-Layer hält den validierten Antwort-Snapshot und den verlustfreien Rohzustand getrennt.
   Bei unvollständiger Identität entsteht ein Draft-Journal; erst ein vollständig bestätigter
   Review-Zustand wird ein ausgabefähiges Profil.
5. Die Migration löst alte symbolische IDs gegen Kategorie, Untertyp und Capabilities auf. Nicht
   mehr anwendbare Seiten fallen kontrolliert auf `identity` zurück.

## Wann wurde es erledigt?

- **12:33 UTC:** Sicherheits-/Zwischencommit `c026b65` für P28–P33 vor Freigabe von P34.
- **12:35 UTC:** Repository-HEAD `ee7a377` lag beim tatsächlichen P34-Start vor; P34 selbst blieb
  während der Implementierung bewusst uncommitted.
- **12:36–13:03 UTC:** Inventar, Seitenkomponenten, Navigation, Persistenz, Migration und
  V3-Hydration wurden umgesetzt; Zwischenstände wurden dem Auftraggeber bei 35, 50, 58, 70 und
  76 Prozent gemeldet.
- **13:03–13:31 UTC:** Zieltests, wiederholte Gesamtsuiten, Build, Format/Lint sowie native und
  Browser-Zusatzgates wurden ausgeführt und ausgewertet.

## Automatisierte Nachweise

- [`wizardCatalog.test.ts`](../../../frontend/src/prompt-studio/features/wizard/wizardCatalog.test.ts):
  ausführbare Feldinventur, deterministische/bedingte Seiten, Legacy-ID-Migration,
  Klassifikations-Backup sowie je eine vollständige gültige Folge für **alle neun Kategorien** bis
  zu einem `ready`-V3-Profil und vier Stil-/Sprachpaketen mit je vier Markdown-Teilen
  (2 Stile × 2 Sprachen × 4 Teile).
- [`WizardCatalogFlow.test.tsx`](../../../frontend/src/prompt-studio/features/wizard/WizardCatalogFlow.test.tsx):
  genau ein aktives Fragen-Fieldset, dauerhafter Name/Basiskontext, kein Basisschritt,
  Rücknavigation mit unvollständigem Text und persistierte stabile Abschluss-IDs.
- [`vaultWizardBridge.test.ts`](../../../frontend/src/prompt-studio/services/vaultWizardBridge.test.ts):
  V3-Neustart ohne `legacyV2Draft` an der exakten `catalog/character/body`-Position einschließlich
  unvollständiger Rohantworten.
- Bestehende [`App.prompt-studio.test.tsx`](../../../frontend/src/app/App.prompt-studio.test.tsx)
  und Repository-/Autosave-Tests decken blockierten Modulwechsel, Flush, Vault-Sitzungsbindung und
  CAS-Persistenz weiterhin ab.

## Abschlussgates vom 2026-09-09

- Gezielter P34-Abschlusslauf nach der letzten Persistenzkorrektur: **bestanden**, 3/3 Testdateien
  und 19/19 Tests.
- `npm --prefix frontend run typecheck`: **bestanden**, Exit 0.
- `npm --prefix frontend run lint`: **bestanden**, Exit 0.
- `npm --prefix frontend run format:check`: **bestanden**, alle Dateien formatiert.
- `npm --prefix frontend run build`: **bestanden**, 436 Module transformiert. Vite meldet nur den
  bereits nicht blockierenden Chunkgrößen-Hinweis für `prompt-features`.
- `npm test --prefix frontend -- --maxWorkers=1`: **bestanden**, nach der letzten
  Persistenzkorrektur erneut 162/162 Testdateien und 822/822 Tests, normale Datei-Isolation,
  Laufzeit 222,01 Sekunden.
- `npm test --prefix frontend` mit der automatisch gewählten Maximalparallelität: ein früher Lauf
  war mit 162/162 Dateien und 821/821 damaligen Tests grün. Nach Ergänzung des letzten
  Modul-Roundtrips endeten Wiederholungen mit 161/162 Dateien und 821/822 Tests, weil ausschließlich
  der fachfremde Test `App.recovery.test.tsx` den unmittelbar nach UI-Sichtbarkeit erwarteten
  Heartbeat unter 162 Workerstarts noch nicht beobachtet hatte. Derselbe Test bestand isoliert mit
  4/4; der vollständige isolierte Ein-Worker-Lauf oben bestand mit 822/822. Der Test wurde im Rahmen
  von P34 nicht fachfremd verändert.
- `python tools/control.py test --suite frontend`: **nicht startbar**, da der Alias `python` fehlt.
  Der vorhandene Ersatz `python3 tools/control.py test --suite frontend` ist **bestanden** (Exit 0,
  Wrapper-Gesamtstatus OK, 821/821 zu diesem Ausführungszeitpunkt, Laufzeit 80 Sekunden); der danach
  ergänzte Modul-Roundtrip ist im vollständigen 822/822-Lauf oben enthalten.
- `python3 tools/control.py tauri test --cargo`: **blockiert/nicht ausgeführt**, weil `cargo` und
  `rustc` in diesem Container fehlen. Die vorgelagerten Tauri-Strukturprüfungen waren erfolgreich.
- `npm --prefix frontend run test:e2e`: vorgeschalteter Produktionsbuild **bestanden**; alle vier
  Playwright-Fälle konnten **nicht starten**, weil das Chromium-Binary
  `chromium_headless_shell-1243` nicht installiert ist. Das ist kein grünes E2E-Ergebnis.
- Manueller nativer Tastatur-, Zoom-, Neustart- und Zwei-Vault-Durchlauf: **nicht ausgeführt**, da
  weder Tauri-Toolchain noch Browserbinary in dieser Docker-Sitzung vorhanden sind.

Ausführungsumgebung: Node.js 22.23.2, npm 10.9.8, Python 3.11.2, UTC. Es wurden keine
GitHub-Anmeldedaten angelegt oder in einen dauerhaften Workspace-Pfad kopiert.

## Prüftorbewertung

- **Erfüllt:** nie alle Fragen gleichzeitig; echte bedingte Komponentenmontage.
- **Erfüllt:** Name dauerhaft oben und Teil der V2-/V3-Projektion.
- **Erfüllt:** kein Basisprofil-Editor/-Auswahlschritt im produktiven Wizard.
- **Automatisiert erfüllt:** vorwärts, zurück, V3 neu öffnen und Profil laden bewahren Antworten und
  symbolische Position; bestehende Modul-/Vault-Flush-Tests bleiben grün.
- **Automatisiert erfüllt:** alle neun Kategorien erreichen Review, ein `ready`-Profil und die
  Ausgabeerzeugung.
- **Offen als Umgebungsblocker:** echter Chromium-/Tauri-End-to-End- und manueller nativer
  Zwei-Vault-/Neustartdurchlauf.

Die Implementierung stoppt hier wie in P34 gefordert. P35 wurde nicht begonnen.

<!-- PYGINDEX:NAVIGATION START -->
[Übergeordnete Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->
