# P29 · Gemeinsame Shell, Dialoge und Responsive-Grundlage

Datum: 2026-09-09
Status: Frontend umgesetzt; Browser- und native Laufzeitprüfung umgebungsbedingt offen
Anforderungen: R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G08, R-S01

## Ergebnis

- `StudioMode` kennt `cutout`, `prompt` und `sprite`. PixelSpriteStudio besitzt einen ausdrücklich
  als unfertig markierten Willkommen-Zustand.
- [`ModuleNavigationRow.tsx`](../../../frontend/src/shared/navigation/ModuleNavigationRow.tsx)
  bildet für jedes aktive Modul genau eine Zeile unmittelbar unter dem gemeinsamen Header ab.
  Der produktive Prompt-Pfad rendert keine interne zweite Navigation.
- Das beschriftete Zahnrad steht in `header-actions` direkt neben Hilfe und öffnet den zentralen
  Einstellungsdialog.
- [`Modal.tsx`](../../../frontend/src/shared/dialogs/Modal.tsx) und
  [`ModalHost.tsx`](../../../frontend/src/shared/dialogs/ModalHost.tsx) vereinheitlichen X, Escape,
  echten Backdrop-Klick, Fokusfalle, Fokus-Rückgabe, Hintergrund-Inertheit und scrollbare Höhe.
  Ein Innenklick sowie ein innen begonnener Pointer-Drag schließen nicht.
- CSS nutzt Reflow, begrenzte Scrollbereiche und `min-width: 0`; es gibt keinen globalen Scale.
  `tauri.conf.json` und der Debug-Acceptance-Parser erlauben mindestens 480×360 und testen außerdem
  720×450.
- Der Renderer startet synchron in die gemeinsame Shell. Beschädigte oder fehlende fachliche
  Prompt-Daten verhindern den Welcome-Rahmen nicht mehr.

## Nachweise

| Nachweis | Ergebnis |
| --- | --- |
| [`App.prompt-studio.test.tsx`](../../../frontend/src/app/App.prompt-studio.test.tsx) | ein Header/eine Modulzeile, vier Prompt-Views, Kontext-Rückkehr und Flush-Sperre |
| [`Modal.test.tsx`](../../../frontend/src/shared/dialogs/Modal.test.tsx) | X, Escape, Backdrop, Innenklick, Drag, Inertheit und Fokus-Rückgabe |
| [`useModalFocus.test.tsx`](../../../frontend/src/components/useModalFocus.test.tsx) | Tab/Shift+Tab und nicht schließbarer Zustand |
| [`prompt-studio-integration.spec.ts`](../../../frontend/e2e/prompt-studio-integration.spec.ts) | drei Module sowie Layout bei 720×450 und 480×360 definiert |
| `npm --prefix frontend run build` | Exit 0 |
| `npm --prefix frontend run test:e2e` | Exit 1 vor Testbeginn: Playwright-Chromium fehlt |

## Abweichungen/Blocker

Der Browser-Layouttest ist implementiert, konnte ohne das Chromium-Binary aber nicht ausgeführt
werden. Die Rust-Parser-/Konfigurationsprüfungen liegen im Quellbaum, konnten ohne `cargo` nicht
kompiliert oder ausgeführt werden. Beide Punkte gelten ausdrücklich nicht als bestanden.
