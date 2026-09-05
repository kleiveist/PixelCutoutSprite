import { useMemo, useState } from "react";

import { MultiSelectFilter, SingleSelectFilter } from "../../components/DropdownFilter";
import type { AreaCard } from "../../domain/areas";
import { emptyAreaFilters, filterAreaCards, profileRevisionKey } from "./area-filter";
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
  const [filters, setFilters] = useState(emptyAreaFilters);
  const areas = model.dashboard?.areas ?? [];
  const visibleAreas = useMemo(() => filterAreaCards(areas, filters), [areas, filters]);
  const labels = model.dashboard?.labels ?? [];
  const profiles = unique(areas.map(profileRevisionKey));
  const heights = unique(areas.map((area) => String(area.reference_height_px))).sort(
    (left, right) => Number(left) - Number(right),
  );
  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <section className="area-library" aria-labelledby="area-library-heading">
      <div>
        <p className="view-eyebrow">Project library</p>
        <h2 id="area-library-heading">Area cards</h2>
      </div>
      <div className="area-filters" aria-label="Area filters">
        <SingleSelectFilter
          label="Object type"
          value={filters.objectType}
          options={[
            { value: "any", label: "Any object type" },
            { value: "humanoid", label: "Humanoid" },
          ]}
          onChange={(value) => set("objectType", value)}
        />
        <SingleSelectFilter
          label="Profile revision"
          value={filters.profile}
          options={[
            { value: "any", label: "Any profile revision" },
            ...profiles.map((value) => ({
              value,
              label: `${value.split("@")[0].slice(0, 8)} · r${value.split("@")[1]}`,
            })),
          ]}
          onChange={(value) => set("profile", value)}
        />
        <SingleSelectFilter
          label="Reference height"
          value={filters.referenceHeight}
          options={[
            { value: "any", label: "Any height" },
            ...heights.map((value) => ({ value, label: `${value} px` })),
          ]}
          onChange={(value) => set("referenceHeight", value)}
        />
        <MultiSelectFilter
          label="Labels"
          values={filters.labelIds}
          options={labels.map((label) => ({ value: label.id, label: label.name }))}
          onChange={(value) => set("labelIds", value)}
        />
        <SingleSelectFilter
          label="Label match"
          value={filters.labelMatch}
          options={[
            { value: "any", label: "At least one selected" },
            { value: "all", label: "All selected" },
          ]}
          onChange={(value) => set("labelMatch", value)}
        />
        <SingleSelectFilter
          label="Sort areas"
          value={filters.sort}
          options={[
            { value: "updated_desc", label: "Recently updated" },
            { value: "updated_asc", label: "Oldest updated" },
            { value: "name_asc", label: "Name A–Z" },
            { value: "name_desc", label: "Name Z–A" },
          ]}
          onChange={(value) => set("sort", value)}
        />
        <button
          type="button"
          className="filter-reset"
          onClick={() => setFilters(emptyAreaFilters())}
        >
          Reset filters
        </button>
      </div>
      <AreaLibraryContent
        model={model}
        areas={visibleAreas}
        totalAreas={areas.length}
        onOpenAnimations={onOpenAnimations}
        onOpenInventory={onOpenInventory}
      />
    </section>
  );
}

function AreaLibraryContent({
  model,
  areas,
  totalAreas,
  onOpenAnimations,
  onOpenInventory,
}: {
  model: AreaDashboardModel;
  areas: readonly AreaCard[];
  totalAreas: number;
  onOpenAnimations?: (area: AreaCard) => void;
  onOpenInventory?: (area: AreaCard) => void;
}) {
  if (model.loadingAreas) return <p role="status">Loading areas…</p>;
  if (!model.hasProjectContext) {
    return <p>Project context is supplied by the completed Projects phase.</p>;
  }
  if (totalAreas === 0) {
    return <p>No areas yet. Create “NPCs” from the profile workbench.</p>;
  }
  if (areas.length === 0) return <p>No areas match these filters.</p>;
  return (
    <div className="area-card-grid">
      {areas.map((area) => (
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
          <p className="area-card-labels" aria-label={`${area.name} labels`}>
            {area.label_ids.length === 0
              ? "No labels"
              : area.label_ids
                  .map((id) => model.dashboard?.labels.find((label) => label.id === id)?.name ?? id)
                  .join(" · ")}
          </p>
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
