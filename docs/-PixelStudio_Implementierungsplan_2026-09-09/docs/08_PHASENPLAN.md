# 08 · Phasenplan P28–P43

Die Reihenfolge setzt die im Repository dokumentierte Reihe P00–P27 fort. Jede Phase ist ein abgrenzbarer Implementierungsauftrag mit eigenem Bericht und Prüftor. Die Reihenfolge ist bewusst konservativ: allgemeine Infrastruktur vor Produktmigration, manuelles Schneiden vor Automatik, Manifest vor Zusammensetzung.

```text
P28 → P29 → P30 → P31 → P32 → P33 → P34 → P35
                                               ↓
P43 ← P42 ← P41 ← P40 ← P39 ← P38 ← P37 ← P36
```

Die Pfeile bilden die empfohlene sequenzielle Bearbeitung ab. Einzelne reine Schema-/Fixture-Arbeiten können nach P28 vorbereitet werden; produktive Phasen gelten dadurch nicht automatisch als freigegeben.

| Phase | Inhalt | Eingangstor | Ergebnis |
|---|---|---|---|
| P28 | [Bestandsaufnahme, Zielverträge und Baseline](../prompts/P28_Bestandsaufnahme_und_Vertraege.md) | Untersuchung des aktuellen Arbeitsbaums | Baseline-Bericht, Abhängigkeitsmatrix, Feld-/Schritt-Mapping, Vertragstests und aktualisierte Umsetzungsreferenz. |
| P29 | [Gemeinsame Shell, Navigation, Dialoge und Responsive-Grundlage](../prompts/P29_Gemeinsame_Shell_Dialoge_Responsive.md) | P28 | Dreiteilige Shell, gemeinsame UI-Primitives, Responsive-Basis, aktualisierte Fenster-/Dialogtests. |
| P30 | [Gemeinsamer Vault-Core und sichere Dateitransaktionen](../prompts/P30_Vault_Core_und_sichere_Dateien.md) | P28, P29 | Workspace-Service, SaveQueue, Transaktions-/Recovery-Protokoll und belastbare Fehler-/Sicherheitstests. |
| P31 | [Globale Einstellungen und Legacy-Migrationsvorbereitung](../prompts/P31_Globale_Settings_und_Legacy_Vorbereitung.md) | P30 | Globaler Settings-Service/-Dialog, isolierter Legacy-Leser und getesteter Migrationsplan/Konverter. |
| P32 | [Prompt-Dateirepository, Autosave und bestätigte Migration](../prompts/P32_Prompt_Vault_Persistenz_Autosave_Migration.md) | P30, P31 | V3-Prompt-Writer/-Reader, Autosave/Generator-Queue, Migration-Apply und Dateisystemintegrationstests. |
| P33 | [Profile-Seite mit genau einem Vault-Basisprofil](../prompts/P33_Vault_Profile_und_Basisprofil_Popup.md) | P32 | Neue Profile-Seite, vollständiger kompakter Basisdialog und Tests für die Singleton-Invariante. |
| P34 | [Geführter Wizard mit Name und echten Katalogseiten](../prompts/P34_Wizard_Katalog_Seitenweise.md) | P33 | Neue Schrittdefinitionen, vollständiges Fragen-Mapping, V3-Wizard-Hydration und kategorieübergreifende Tests. |
| P35 | [Dashboard, Profil-Popups, Ausgabe und Dateimanager](../prompts/P35_Dashboard_Popups_Ausgabe_Explorer.md) | P34 | Vollständiger Prompt-End-to-End-Ablauf, Datei-Reveal und UI-/Native-Abnahmetests. |
| P36 | [Gemeinsame DataFolderToolbar und Dateinavigation](../prompts/P36_Gemeinsame_DataFolderToolbar.md) | P35 | Gemeinsame Datei-Toolbar, sichere Listing-API, Responsive-/Tastatur- und Dateiereignistests. |
| P37 | [Alte Cutout-Fachbasis entfernen und Willkommen neu aufbauen](../prompts/P37_Cutout_Altbasis_entfernen_Willkommen.md) | P36 | Bereinigter produktiver Cutout-Unterbau, neue Willkommen-Seite und dokumentierter Entfernen-/Bewahren-Nachweis. |
| P38 | [Cutout-Editor, Quellbild und manuelle Masken](../prompts/P38_Cutout_Editor_Manuelle_Masken.md) | P37 | Nutzbarer manueller Cutout-Editor, Quellen-/Maskenpersistenz und Koordinaten-/Historytests. |
| P39 | [Assistierte Auswahl, automatische Konturanpassung und Anschlusszonen](../prompts/P39_Assistierte_Auswahl_und_Ueberlappungen.md) | P38 | Lokale Auswahlhilfe, Überlappungswerkzeug, anspruchsvoller Fixture-Satz und ehrlicher Qualitätsnachweis. |
| P40 | [PNG-Teile, Schnittprojekt und manifestgestützte Ausgabe](../prompts/P40_PNG_Teile_und_Manifest.md) | P39 | Produktive Teilegenerierung, vollständiges Manifest, kanonische Schnittprojektablage und Dateisystem-/Pixeltests. |
| P41 | [PixelSpriteStudio mit Ordner-Autoload und Originalanordnung](../prompts/P41_PixelSpriteStudio_Autoload_und_Assembly.md) | P40 | Neues SpriteStudio, sicherer Set-Loader, automatische Platzierung und Assembly-Tests. |
| P42 | [View-Ebenen, Transformationen und Szenen-Autosave](../prompts/P42_View_Ebenen_Szenen_Autosave.md) | P41 | Vollständiger Kompositionseditor mit View, Transformationen, Szenenpersistenz und Reconcile-Tests. |
| P43 | [Gesamtabnahme, Desktop-Härtung und aktualisierte Dokumentation](../prompts/P43_Gesamtabnahme_Haertung_Dokumentation.md) | P42 | Finaler Abnahmebericht, aktuelle Anleitungen, nachvollziehbare Build-Artefaktreferenzen und offene-Punkte-Liste. |

## Meilensteine

**M1 nach P30:** Gemeinsame Shell und gesicherter Vault-Core funktionieren ohne alte Projekt-/Area-Pflicht. **M2 nach P35:** Der neue Prompt-Workflow ist vollständig dateibasiert, inklusive einer Basis, paginiertem Wizard, Dashboard-Laden und automatischen Ausgaben. **M3 nach P40:** Die alte Cutout-Fachbasis ist entfernt, der neue Maskeneditor erzeugt vollständige, geprüfte PNG-/Manifest-Sets. **M4 nach P42:** SpriteStudio setzt Sets zusammen und speichert View-/Szenenänderungen. **M5 nach P43:** Integrations-, Desktop- und Dokumentationsabnahme ist mit tatsächlichen Nachweisen abgeschlossen oder zeigt klar benannte Blocker.

## Phasenübergreifende Eingangstore

Eine Phase beginnt nur mit lesbaren Vorphasenberichten und verträglichen Verträgen. Fehlgeschlagene Pflichtprüfungen werden nicht durch neue Features überdeckt. Bei abweichendem Repository-Stand wird die konkrete Dateizuordnung aktualisiert; die fachlichen Anforderungen bleiben bestehen. Neue Abhängigkeiten brauchen Begründung, Lizenz-/Paketierungsprüfung und reproduzierbare Lockfileänderungen.

Der Coding-Agent bearbeitet den Code der Phase, nicht bloß eine weitere abstrakte Planung. Ein Abschlussbericht enthält geänderte Dateien, Anforderungen, Tests mit Befehlen/Exit-Codes, Datenverträglichkeit, bekannte Grenzen und das Ergebnis des Prüftors. Ein nicht ausgeführter Native-Test heißt „nicht ausgeführt“, nicht „bestanden durch Mock“.
