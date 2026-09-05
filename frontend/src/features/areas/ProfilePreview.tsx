import type { HumanoidProfilePreview } from "../../domain/areas";
import type { Direction } from "../../domain/common";

interface ProfilePreviewProps {
  preview: HumanoidProfilePreview | null;
  activeDirection: HumanoidProfilePreview["direction_previews"][number] | null;
  direction: Direction;
  validHeight: boolean;
}

export function ProfilePreview({
  preview,
  activeDirection,
  direction,
  validHeight,
}: ProfilePreviewProps) {
  if (!validHeight) {
    return (
      <div className="humanoid-preview humanoid-preview-empty" role="status">
        Enter a whole height from 16 to 512 px.
      </div>
    );
  }
  if (!preview || !activeDirection) {
    return (
      <div className="humanoid-preview humanoid-preview-empty" role="status">
        Calculating exact slot geometry…
      </div>
    );
  }
  const [frameWidth, frameHeight] = preview.suggested_frame_size_px;
  const [groundX, groundY] = preview.suggested_ground_origin_px;
  return (
    <section className="humanoid-preview" aria-labelledby="profile-preview-heading">
      <header>
        <div>
          <span>EXACT NEUTRAL HEIGHT</span>
          <h2 id="profile-preview-heading">{preview.measured_height_px} px exact</h2>
        </div>
        <strong>{direction.toUpperCase()}</strong>
      </header>
      <div className="humanoid-preview-canvas">
        <svg
          aria-label={`${direction.toUpperCase()} humanoid slot preview`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        >
          <line className="preview-ground" x1="0" x2={frameWidth} y1={groundY} y2={groundY} />
          {activeDirection.slots.map((slot) => (
            <rect
              className={`preview-slot preview-slot-${slotClass(slot.slot_id)}`}
              data-testid="profile-slot"
              height={slot.height}
              key={slot.slot_id}
              width={slot.width}
              x={groundX + slot.x}
              y={groundY + slot.y}
            >
              <title>
                {slot.slot_id}: {slot.width}×{slot.height}px
              </title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="profile-contract-summary">
        <span>{preview.slots.length} slots</span>
        <span>{preview.views.length} views</span>
        <span>{preview.mirror_pairs.length} mirror pairs</span>
      </div>
      <ul className="slot-dimension-list" aria-label="Calculated slot dimensions">
        {preview.slots.map((slot) => (
          <li key={slot.id}>
            <span>{slot.id.replaceAll("_", " ")}</span>
            <strong>
              {slot.size_px[0]}×{slot.size_px[1]}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function slotClass(slotId: string): string {
  if (slotId === "hair") return "hair";
  if (slotId === "head" || slotId.startsWith("hand")) return "skin";
  if (slotId.startsWith("torso")) return "torso";
  return slotId.endsWith("_l") ? "left" : "right";
}
