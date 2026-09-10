import { useEffect, useRef } from "react";
import type { PartId } from "../shared/image/contracts";
import { partDefinition } from "../shared/image/parts";
import { backToFront } from "./geometry";
import type { SpriteController, SpriteState } from "./controller";
import styles from "./SpriteStudio.module.css";

function Thumbnail({ texture }: { readonly texture: HTMLCanvasElement | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 40, 40);
    context.imageSmoothingEnabled = false;
    if (texture?.width && texture.height) {
      const scale = Math.min(38 / texture.width, 38 / texture.height);
      context.drawImage(
        texture,
        (40 - texture.width * scale) / 2,
        (40 - texture.height * scale) / 2,
        texture.width * scale,
        texture.height * scale,
      );
    }
  }, [texture]);
  return (
    <canvas ref={ref} width={40} height={40} className={styles.thumbnail} aria-hidden="true" />
  );
}
export function SpriteLayers({
  controller,
  state,
  textures,
}: {
  readonly controller: SpriteController;
  readonly state: SpriteState;
  readonly textures: ReadonlyMap<string, HTMLCanvasElement>;
}) {
  const dragged = useRef<PartId | null>(null),
    scene = state.scene;
  const layers = backToFront(scene?.layers ?? []).reverse();
  const editable = controller.editable && !state.inputError;
  return (
    <section aria-label="Sprite-View">
      <h2>View</h2>
      {scene ? (
        <p>
          {scene.layers.length} geprüfte Teile · {scene.generationId}
        </p>
      ) : null}
      <p>Vorderste Ebene oben · größere Z-Werte vorne</p>
      {scene ? (
        <ol className={styles.layers} aria-label="Sprite-Ebenen">
          {layers.map((layer, index) => {
            const label = partDefinition(layer.partId).label;
            return (
              <li
                key={layer.partId}
                draggable={editable && !layer.locked}
                onDragStart={(event) => {
                  if (!editable || layer.locked) {
                    event.preventDefault();
                    return;
                  }
                  dragged.current = layer.partId;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", layer.partId);
                }}
                onDragOver={(event) => {
                  if (dragged.current && editable) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged.current && editable)
                    controller.reorder(dragged.current, layer.partId);
                  dragged.current = null;
                }}
                onDragEnd={() => {
                  dragged.current = null;
                }}
              >
                <button
                  type="button"
                  aria-label={`${label} auswählen`}
                  aria-pressed={state.selected === layer.partId}
                  onClick={() => controller.select(layer.partId)}
                >
                  <Thumbnail texture={textures.get(layer.partId)} />
                  {label}
                  <small>
                    Z {layer.zIndex} · {layer.visible ? "sichtbar" : "ausgeblendet"} ·{" "}
                    {layer.locked ? "gesperrt" : "entsperrt"}
                  </small>
                </button>
                <div className={styles.layerActions}>
                  <label>
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      disabled={!editable}
                      onChange={(event) =>
                        controller.updateLayer(layer.partId, { visible: event.target.checked })
                      }
                    />
                    {label} sichtbar
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={layer.locked}
                      disabled={!editable}
                      onChange={(event) =>
                        controller.updateLayer(layer.partId, { locked: event.target.checked })
                      }
                    />
                    {label} sperren
                  </label>
                  <button
                    type="button"
                    aria-label={`${label} nach vorn`}
                    disabled={!editable || layer.locked || index === 0}
                    onClick={() => controller.moveOrder(layer.partId, "front")}
                  >
                    ↑ Nach vorn
                  </button>
                  <button
                    type="button"
                    aria-label={`${label} nach hinten`}
                    disabled={!editable || layer.locked || index === layers.length - 1}
                    onClick={() => controller.moveOrder(layer.partId, "back")}
                  >
                    ↓ Nach hinten
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>Wähle im Dateien-Register einen Teileordner.</p>
      )}
    </section>
  );
}
