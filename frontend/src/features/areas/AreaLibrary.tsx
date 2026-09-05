import type { AreaCard } from "../../domain/areas";
import type { AreaDashboardModel } from "./useAreaDashboard";

export function AreaLibrary({
  model,
  onOpenAnimations,
  onOpenInventory,
}: {
  model: AreaDashboardModel;
  onOpenAnimations?: (area: AreaCard) => void;
  onOpenInventory?: (area: AreaCard) => void;
}) {
  return (
    <section className="area-library" aria-labelledby="area-library-heading">
      <div>
        <p className="view-eyebrow">Project library</p>
        <h2 id="area-library-heading">Area cards</h2>
      </div>
      <AreaLibraryContent
        model={model}
        onOpenAnimations={onOpenAnimations}
        onOpenInventory={onOpenInventory}
      />
    </section>
  );
}

function AreaLibraryContent({
  model,
  onOpenAnimations,
  onOpenInventory,
}: {
  model: AreaDashboardModel;
  onOpenAnimations?: (area: AreaCard) => void;
  onOpenInventory?: (area: AreaCard) => void;
}) {
  if (model.loadingAreas) return <p role="status">Loading areas…</p>;
  if (!model.hasProjectContext) {
    return <p>Project context is supplied by the completed Projects phase.</p>;
  }
  if (model.dashboard?.areas.length === 0) {
    return <p>No areas yet. Create “NPCs” from the profile workbench.</p>;
  }
  return (
    <div className="area-card-grid">
      {model.dashboard?.areas.map((area) => (
        <article className="area-card" key={area.id}>
          <span>HUMANOID · 8-WAY</span>
          <h3>{area.name}</h3>
          <dl>
            <div>
              <dt>Height</dt>
              <dd>{area.reference_height_px}px</dd>
            </div>
            <div>
              <dt>Profile</dt>
              <dd>r{area.profile_ref.revision}</dd>
            </div>
            <div>
              <dt>Frame</dt>
              <dd>
                {area.default_frame_size_px[0]}×{area.default_frame_size_px[1]}
              </dd>
            </div>
          </dl>
          <button disabled={model.busy} onClick={() => void model.openArea(area)} type="button">
            Open profile
          </button>
          <button disabled={model.busy} onClick={() => onOpenInventory?.(area)} type="button">
            Open PNG inventory
          </button>
          <button
            className="primary-button"
            disabled={model.busy}
            onClick={() => onOpenAnimations?.(area)}
            type="button"
          >
            Open animations
          </button>
        </article>
      ))}
    </div>
  );
}
