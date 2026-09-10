import { useActiveVault } from "../shared/vault";
import { VaultWelcome } from "../shared/vault/VaultWelcome";
import type { ComponentProps } from "react";

export function SpriteStudioWelcome(
  props: Omit<ComponentProps<typeof VaultWelcome>, "currentVault">,
) {
  const { activeVault } = useActiveVault();
  return (
    <section className="studio-welcome" aria-labelledby="sprite-studio-title">
      <p className="view-eyebrow">PIXELSPRITESTUDIO</p>
      <h1 id="sprite-studio-title">Sprites aus geprüften Teilen zusammensetzen.</h1>
      <p>
        Wähle im Data Folder einen Teileordner mit sprite.parts.json. Die Originalanordnung wird aus
        Crop-Ursprung, Pivot und Standard-Z geladen. Eine gespeicherte gültige Szene hat Vorrang.
      </p>
      <VaultWelcome {...props} currentVault={activeVault} />
      <p>
        Legacy-PNGs mit bekannten Teilenamen können ohne Manifest betrachtet werden; fehlende
        ursprüngliche Offsets verlangen manuelles Ausrichten. Fremde PNGs und abgewählte Extras
        werden nicht hinzugefügt.
      </p>
      <p>
        Die Ansicht verwendet Source-over: halbtransparente Überlappungen können deckender wirken.
        Einzel-PNGs bleiben unverändert.
      </p>
    </section>
  );
}
