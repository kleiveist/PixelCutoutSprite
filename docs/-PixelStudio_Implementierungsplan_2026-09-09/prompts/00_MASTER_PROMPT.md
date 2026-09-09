# Master-Prompt · PixelStudio-Umbau

Du arbeitest im vorhandenen Repository `kleiveist/PixelCutoutSprite`. Setze ausschließlich die anschließend genannte Phase aus diesem Planpaket um. Der Plan bezieht sich auf den untersuchten main-Commit `9efa821bc21b0099dc2f0d51895e472fc02b737f`; prüfe den tatsächlichen Arbeitsbaum und integriere Abweichungen, ohne fremde Änderungen zurückzusetzen.

## Vor jeder Phase

Lies `START_HERE.md`, den Phasen-Prompt, dessen angegebene Dokumente und die realen betroffenen Repository-Dateien. Ermittle den relativen Paketpfad einmal; alle Pfadangaben im Plan sind von diesem Paket oder ausdrücklich vom Repository-Root aus gemeint. Lies den Bericht der Vorphase. Bereits gemachte Entscheidungen nicht unnötig erneut erfragen. Neue Unklarheiten im Entscheidungsprotokoll mit einer sicheren, begründeten Auslegung dokumentieren.

## Unverhandelbare Zielgrenzen

Eine Tauri-/React-App mit PixelPromptStudio, neuem PixelCutoutSprite und neuem PixelSpriteStudio. Gemeinsamer Header mit globalen Einstellungen, gemeinsame Navigation-Row und dieselbe DataFolderToolbar für die Bildmodule. Der ausgewählte Vault ist die einzige fachliche Quelle der Wahrheit. Es gibt pro Vault genau ein aktives Basisprofil. Profile, Antworten, Masken und Szenen gehören nicht in App-Data, localStorage oder IndexedDB.

PromptStudio hat Dashboard, Profile, Wizard und Ausgabe, aber keine eigene Settings-Seite. Der Wizard besitzt Name und echte Katalogseiten, keinen Basisprofil-Editor. Seine Dateien entstehen automatisch. Alte Prompt-Export-/Kopier-/Handoff-Strecken entfallen.

Die alte Cutout-Fachbasis wird tatsächlich entfernt. Erhalten werden ausschließlich begründet benötigte allgemeine Infrastruktur und Nutzerdaten. Die neue Cutout-Funktion liefert unabhängige überlappende Masken und normierte PNGs. SpriteStudio verwendet die Manifest-Koordinaten und speichert Ebenen-/Szenenänderungen im Vault. Keine erneute Einführung von Timeline, NPC-Bindings, Game-Engine-Export oder zentraler Projektbibliothek.

## Arbeitsweise

Implementiere die Phase vollständig einschließlich Tests und Dokumentation. Keine bloßen TODO-Platzhalter als fertige Funktion. Vorhandene Toolchain und reine geeignete Domänenlogik wiederverwenden; keine pauschalen Dependency-Upgrades oder Architekturwechsel. Rust validiert Pfade, Größen, Revisionen und Schemas unabhängig von der UI. Native Berechtigungen und CSP nicht zum Umgehen von Fehlern pauschal lockern.

Arbeite nicht destruktiv an Nutzerdaten. Kein `git reset --hard`, keine rekursive Vault-Löschung, kein automatischer Push/Release und keine Paketveröffentlichung. Fremde Dateien und modifizierte generierte Dateien gehören in einen Konfliktablauf. Ein nicht gelöster Konflikt wird nicht als erfolgreich gespeichert ausgegeben.

Führe die vorhandenen Test-/Build-Einstiege aus, soweit die Umgebung es erlaubt. Nutze die paketierten Testfälle zusätzlich, nicht statt vorhandener relevanter Tests. Dokumentiere Befehle, Exit-Codes und echte Ergebnisse. Browser-Mocks sind keine native Desktop-Abnahme. Nicht verfügbare Zielplattformen ehrlich als ungeprüft kennzeichnen.

## Abschlussformat

Lege `docs/developer/acceptance/<PHASE>-<kurzer-name>.md` an. Dokumentiere Ziel, erfüllte Anforderungs-IDs, tatsächliche Änderungen, neue/entfernte APIs, Tests mit Ergebnissen, Persistenz-/Migrationsauswirkungen, bekannte Grenzen und Gate-Status. Gib eine kurze Zusammenfassung mit denselben Informationen aus. Bearbeite nicht automatisch die nächste Phase, bevor das aktuelle Gate geprüft ist.

Bei einem echten Umgebungsblocker liefere den bereits überprüften Teil und den konkreten Blocker. Erfinde weder erfolgreiche Builds noch implementierte Funktionen. Eine offene Qualitätsgrenze der Segmentierung ist sichtbar zu machen und durch bedienbare Korrekturwerkzeuge abzufangen.
