<!-- AUTO-GENERATED:backlink START -->

[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# PixelPromptStudio Generator verwenden

PixelPromptStudio ist direkt in PixelCutoutSprite Studio eingebaut. Es öffnet keine Webseite,
kein iframe und kein zweites Programm. Der grüne Studiobutton im gemeinsamen Header wechselt zum
Generator; der Cutout-Button kehrt in den zuvor geöffneten Vault-, Projekt-, Area- und
Editor-Kontext zurück.

## Einen Prompt erstellen

1. Wähle im Header **PixelPromptStudio / GENERATOR**.
2. Starte auf dem Dashboard mit **Neues Asset** oder wähle direkt eine der neun Kategorien.
3. Lege Kategorie, Untertyp und Basisprofil fest. Der Wizard zeigt anschließend nur die für das
   Asset gültigen Fragen, beispielsweise Richtungen und Animationsframes für Figuren oder
   Tile-/Footprint-Werte für Weltobjekte.
4. Prüfe vor dem nächsten Schritt die sichtbaren Validierungshinweise. Gültige Änderungen werden
   als aktiver Entwurf gespeichert und können über Dashboard oder Wizard fortgesetzt werden.
5. Öffne **Ausgabe**. Dort stehen Hauptprompt, Negativprompt, technische Spezifikation und die
   kombinierte Ausgabe in den angebotenen Sprach- und Stilvarianten bereit.

Kopieren bleibt vollständig lokal. **MD exportieren** und **JSON exportieren** öffnen in der
Desktop-App den nativen Speicherdialog. Ein abgebrochener Dialog verändert keine bestehende
Datei.

## Profile verwalten und übernehmen

Unter **Profile** lassen sich Basis-, Kategorie- und Assetprofile auswählen, duplizieren,
favorisieren und kontrolliert löschen. Die Einstellungen bieten einen vollständigen validierten
V2-Workspace-Export und -Import.

Bestehende PixelForgeStudio-V2-Exporte können über **Einstellungen → Workspace importieren**
eingelesen werden. Das Paket wird vor der Übernahme vollständig mit den Prompt-Schemas geprüft;
ID-Konflikte benötigen eine ausdrückliche Auswahl. Eine automatische Browser-Migration findet
nur einmal statt, wenn dieselbe WebView-Origin tatsächlich alte V1-/V2-Schlüssel enthält und der
native Prompt-Speicher noch leer ist.

## Lokale Speicherung und Recovery

Die Desktop-App speichert unabhängig von einer geöffneten Vault im App-Datenverzeichnis:

```text
prompt-studio/
├── settings.json
├── profiles.json
├── draft.json
└── migration-backup.json
```

Die Dateien werden zunächst als geprüfte temporäre Datei geschrieben und danach atomar ersetzt.
Bleibt ein gültiger Schreibstand nach einem Abbruch liegen, wird er beim nächsten Lesen
wiederhergestellt; bei einem beschädigten Zwischenstand wird die gültige Vorgängerversion
bevorzugt. Der Generator funktioniert offline. Browser-LocalStorage ist nur der Fallback für die
Browserentwicklung und Tests.

Wenn ein Entwurf gerade ungesicherte oder ungültige Wizard-Eingaben enthält, blockiert der
Studiowechsel. Korrigiere den markierten Schritt beziehungsweise warte auf das Autosave und
wechsle danach erneut. Ein Fehler beim nativen Flush lässt den Generator ebenfalls geöffnet und
zeigt den Grund in der gemeinsamen Statusleiste.

## Prompt an eine Cutout-Area übergeben

In der Ausgabe erscheint **In PixelCutoutSprite übernehmen**. Die Aktion ist nur aktiv, wenn

- eine Vault geöffnet ist,
- eine Area gewählt ist,
- die Vault schreibbar ist und
- keine Vault-Recovery offen ist.

Ohne Vault oder in einer Read-only-Vault bleiben Kopieren und Datei-Export verfügbar; nur die
Übergabe ist deaktiviert. Bei Erfolg legt PixelCutoutSprite eine versionierte JSON-Referenz unter
dem Ordner `prompt-references/` der gewählten Area ab. Der Datensatz enthält Kategorie,
Hauptprompt, Negativprompt, technische Spezifikation, Profilreferenzen und Zeitstempel. Andere
Vault-Daten werden nicht migriert oder verändert. Der vorherige Cutout-Kontext bleibt erhalten.

## Datensicherheit

- Importpfade müssen echte reguläre JSON-Dateien sein und sind auf 10 MiB begrenzt.
- Markdown-/JSON-Ausgaben werden nur an den explizit im nativen Dialog gewählten absoluten Pfad
  geschrieben; JSON wird vor dem Schreiben geparst.
- Symlinks und nicht reguläre Zieldateien werden abgelehnt.
- Prompt-Arbeitsdaten sind größenbegrenzt; die Frontend-Schemas prüfen ihren vollständigen Inhalt.
- Eine bestehende Vault bleibt ohne die ausdrückliche Übergabeaktion unverändert.
