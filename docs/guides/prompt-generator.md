<!-- PYGINDEX:NAVIGATION START -->
[Zur Übersicht](index.md)
<!-- PYGINDEX:NAVIGATION END -->

# PixelPromptStudio Generator verwenden

Stand: P35, 2026-09-10. PixelPromptStudio arbeitet direkt mit den Dateien des geöffneten Vaults.
Der Studiobutton im gemeinsamen Header wechselt zwischen Generator und Cutout-Bereich.

## Einen Prompt erstellen

1. Öffne einen schreibbaren Vault und wähle im Header **PixelPromptStudio**.
2. Lege unter **Profile → Basisprofil anlegen** die gemeinsame Weltbasis an. Pro Vault gibt es
   genau ein Basisprofil; im Wizard ist es schreibgeschützter Kontext.
3. Wähle auf dem Dashboard **Neues Asset** oder öffne eine der neun Kategorie-Karten und wähle
   **Neues Asset in dieser Kategorie**. Auch leere Kategorien sind nutzbar.
4. Vergib den Assetnamen und wähle Kategorie und Untertyp. Bearbeite die passenden Wizard-Seiten
   mit **Weiter** und **Zurück**. Antworten und Position werden automatisch gesichert; auch
   unvollständige Eingaben bleiben als Entwurf erhalten.
5. Bestätige die abschließende Review-Seite. Für ein fertiges Profil werden die Markdown-Ausgaben
   automatisch im Vault erzeugt. Warte bei laufender Speicherung oder Generierung auf den Status.
6. Öffne **Ausgabe**. Wähle Profil, Stil, Sprache und Ausgabeteil. Die Ansicht liest die tatsächlich
   gespeicherten Dateien, nicht einen unabhängig neu berechneten Vorschautext.

Es gibt zwei Stile (Classic/Dark), zwei Sprachen (Deutsch/Englisch) und vier Ausgabeteile
(Hauptprompt, Negativprompt, technische Spezifikation, kombinierte Ausgabe): insgesamt 16
Markdown-Dateien pro vollständig generiertem Profil. Dafür ist keine Exporthandlung nötig.
Normale Textauswahl bleibt möglich; Export-, Download-, Kopier- und Area-Übergabe-Buttons gibt es
auf den produktiven Prompt-Seiten nicht mehr.

## Gespeicherte Profile wieder öffnen

Die neun Dashboard-Karten zeigen die Anzahl der Profil-JSONs und bis zu drei Profilnamen aus dem
aktuellen Vault. Markdown-Dateien erhöhen diese Zählung nicht.

Ein Kartenklick öffnet das gemeinsame Kategorie-Popup. Die Namen sind nach Untertyp gruppiert;
die Suche berücksichtigt Namen und Untertypen. Zu jedem Profil stehen Änderungsdatum und Status.
**Laden** sichert zunächst die aktive Sitzung und lädt dann Antworten, unvollständige Rohwerte
und Wizard-Position. Erst bei Erfolg schließt das Popup und wechselt zum Wizard. Bei einem Fehler
bleibt der bisherige Arbeitsstand erhalten.

Das Popup lässt sich mit Escape, dem Schließen-Button oder einem Klick auf den Hintergrund
schließen. Während einer laufenden Lade-/Dateimanager-Aktion ist das Schließen gesperrt.
**Aktualisieren** wartet auf ausstehende Schreibvorgänge und scannt den Vault erneut. Beschädigte
Einzeldateien werden mit ihrem Pfad gemeldet; lesbare Profile bleiben verfügbar.

## Dateien im Dateimanager anzeigen

Im Kategorie-Popup lassen sich Profil-JSON und Profilordner anzeigen. Unter **Ausgabe** kommt die
aktuell ausgewählte Markdown-Datei hinzu. Der angezeigte relative Pfad gehört genau zur gewählten
Stil-/Sprach-/Teil-Kombination.

Die Desktop-App übergibt nur geprüfte bestehende Ziele aus dem aktiven Vault an den
System-Dateimanager. Fehlende Dateien, Pfade außerhalb des Vaults und Symlinks werden abgewiesen.
Windows verwendet Explorer, macOS Finder und Linux den System-Dateimanager. Ob Windows dabei
eine zusätzliche Fensterinstanz öffnet, ist noch manuell zu prüfen; das wird nicht garantiert.

## Speicherung, Fehler und bestehende Daten

Das Basisprofil liegt unter `.PixelPrompt/basisprofil.json`, unvollständige Draft-Journale unter
`.PixelPrompt/.drafts/`. Profil-JSON und zugehörige Markdown-Dateien liegen gemeinsam unter
`.PixelPrompt/<Kategorie>/<Untertyp>/<Profilordner>/`. Die Profil-JSON enthält unter anderem
Antworten, Wizard-Position und das Manifest der generierten Ausgaben samt Prüfsummen.

Die Statusanzeige unterscheidet Entwurf, laufende Aktualisierung, veraltete Ausgabe und Fehler.
Eine veraltete, aber unveränderte Datei kann als letzter gespeicherter Stand angezeigt werden;
sie wird nicht als aktuell ausgegeben. Fehlende oder veränderte Markdown-Dateien führen beim
Lesen beziehungsweise **Aktualisieren** zu einem Fehler. Nach einer externen Reparatur erneut
aktualisieren. Beschädigte Dateien werden nicht automatisch mit Standardwerten überschrieben.

Für alte AppData-/Browserbestände gibt es unter **Profile → Legacy-Daten prüfen und übernehmen**
eine gesonderte Vorschau und ausdrückliche Übernahme. Eine produktive Prompt-Einstellungen-Seite
oder eine zweite zentrale Profilbibliothek gibt es nicht mehr. Alte Daten werden nicht allein
durch das Öffnen des Dashboards übernommen.

In schreibgeschützten Vaults sind Lesen und Dateianzeige möglich, nicht das Anlegen oder Ändern
von Profilen. Meldet die Anwendung einen Speicher- oder Flush-Fehler, behebe diesen vor dem
Vault-/Studiowechsel. Der Generator benötigt für die lokale Arbeit keine Netzwerkverbindung.
