import { DataFolderWorkspace, useDataFolder } from "../shared/data-folder";

export function SpriteStudioWelcome() {
  const selection = useDataFolder().selections.sprite;
  return (
    <DataFolderWorkspace
      module="sprite"
      viewSlot={{
        content: (
          <section aria-label="Sprite-View">
            <h2>View</h2>
            <p>
              {selection?.kind === "sprite_set"
                ? `${selection.partCount} geprüfte Teile · ${selection.generationId}`
                : "Wähle im Dateien-Register einen Teileordner mit sprite.parts.json."}
            </p>
            <p>
              Der Ebeneneditor folgt in P42. Der Registerwechsel verändert die Dateiauswahl nicht.
            </p>
          </section>
        ),
      }}
    >
      <section className="studio-welcome" aria-labelledby="sprite-studio-title">
        <p className="view-eyebrow">PIXELSPRITESTUDIO</p>
        <h1 id="sprite-studio-title">Sprites aus geprüften Teilen zusammensetzen.</h1>
        <p>
          Die gemeinsame Dateinavigation prüft bereits Bilder und Teilemanifeste. Der automatische
          Zusammenbau und die View-Ebenen folgen in P41/P42.
        </p>
        <p className="implementation-note" role="status">
          Dateiauswahl verfügbar · noch kein Zusammenbau und keine Szenenspeicherung.
        </p>
      </section>
    </DataFolderWorkspace>
  );
}
