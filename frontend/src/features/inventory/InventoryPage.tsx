import { useEffect, useRef, useState, type DragEvent } from "react";

import { useModalFocus } from "../../components/useModalFocus";
import type { AssetInventoryFacets, InventoryLabel } from "../../domain/inventory";
import "./InventoryPage.css";
import { emptyInventoryFilter, type InventoryFilter, type InventoryItem } from "./inventory-filter";

interface InventoryPageProps {
  facets?: AssetInventoryFacets;
  filter?: InventoryFilter;
  items: readonly InventoryItem[];
  labels?: readonly InventoryLabel[];
  onChoosePackage: () => void;
  onDropFiles: (files: File[]) => void;
  onArchive: (item: InventoryItem) => void;
  onFilterChange?: (filter: InventoryFilter) => void;
  onThumbnailRequest?: (item: InventoryItem) => Promise<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalItems?: number;
  busy?: boolean;
  writable?: boolean;
}

export function InventoryPage({
  facets,
  filter: controlledFilter,
  items,
  labels: inventoryLabels = [],
  onChoosePackage,
  onDropFiles,
  onArchive,
  onFilterChange,
  onThumbnailRequest,
  onLoadMore,
  hasMore = false,
  totalItems = items.length,
  busy = false,
  writable = true,
}: InventoryPageProps) {
  const [localFilter, setLocalFilter] = useState<InventoryFilter>(emptyInventoryFilter);
  const filter = controlledFilter ?? localFilter;
  const [removing, setRemoving] = useState<InventoryItem | null>(null);
  const cancelRemoveButton = useRef<HTMLButtonElement>(null);
  const removeModal = useModalFocus<HTMLDivElement>({
    initialFocus: cancelRemoveButton,
    onEscape: () => setRemoving(null),
    open: removing !== null,
  });
  const slots = facets?.slot_ids ?? unique(items.map((item) => item.slotId));
  const directions = facets?.directions ?? unique(items.map((item) => item.direction));
  const kinds = facets?.asset_kinds ?? unique(items.map((item) => item.kind));
  const profiles =
    facets?.profile_refs.map((profile) => ({
      value: `${profile.id}@${profile.revision}`,
      label: `${profile.id.slice(0, 8)} · r${profile.revision}`,
    })) ??
    unique(items.map((item) => item.profile)).map((profile) => ({
      value: profile,
      label: profile,
    }));
  const labelNames = new Map(inventoryLabels.map((label) => [label.id, label.name]));
  const labels =
    facets?.label_ids.map((id) => ({ value: id, label: labelNames.get(id) ?? id })) ??
    unique(items.flatMap((item) => item.labels)).map((label) => ({ value: label, label }));

  function update<K extends keyof InventoryFilter>(key: K, value: InventoryFilter[K]): void {
    const next = { ...filter, [key]: value };
    if (onFilterChange) onFilterChange(next);
    else setLocalFilter(next);
  }

  function resetFilters(): void {
    const next = emptyInventoryFilter();
    if (onFilterChange) onFilterChange(next);
    else setLocalFilter(next);
  }

  function dropped(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!writable || busy) return;
    onDropFiles([...event.dataTransfer.files]);
  }

  return (
    <section className="inventory-page" aria-labelledby="inventory-title">
      <header className="inventory-header">
        <div>
          <span>Area sources</span>
          <h1 id="inventory-title">PNG inventory</h1>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={busy || !writable}
          onClick={onChoosePackage}
        >
          Import PNG or package
        </button>
      </header>
      <div className="inventory-filters" aria-label="Inventory filters">
        <label>
          Search
          <input
            type="search"
            value={filter.query}
            onChange={(event) => update("query", event.target.value)}
          />
        </label>
        <Filter
          label="Slot"
          value={filter.slot}
          options={["all", ...slots]}
          onChange={(value) => update("slot", value)}
        />
        <Filter
          label="Direction"
          value={filter.direction}
          options={["all", ...directions]}
          onChange={(value) => update("direction", value as InventoryFilter["direction"])}
        />
        <Filter
          label="Type"
          value={filter.kind}
          options={["all", ...kinds]}
          onChange={(value) => update("kind", value as InventoryFilter["kind"])}
        />
        <Filter
          label="Profile"
          value={filter.profile}
          options={[{ value: "all", label: "all" }, ...profiles]}
          onChange={(value) => update("profile", value)}
        />
        <Filter
          label="Labels"
          value={filter.label}
          options={[{ value: "all", label: "all" }, ...labels]}
          onChange={(value) => update("label", value)}
        />
        <Filter
          label="Usage"
          value={filter.usage}
          options={[
            "all",
            ...(facets?.has_used === false ? [] : ["used"]),
            ...(facets?.has_unused === false ? [] : ["unused"]),
          ]}
          onChange={(value) => update("usage", value as InventoryFilter["usage"])}
        />
        <Filter
          label="Sort"
          value={filter.sort}
          options={[
            { value: "name_asc", label: "Name A–Z" },
            { value: "name_desc", label: "Name Z–A" },
            { value: "updated_newest", label: "Newest updated" },
            { value: "updated_oldest", label: "Oldest updated" },
          ]}
          onChange={(value) => update("sort", value as InventoryFilter["sort"])}
        />
        <button type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </div>
      <div
        className="inventory-drop"
        aria-disabled={!writable || busy}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = writable && !busy ? "copy" : "none";
        }}
        onDrop={dropped}
      >
        {writable
          ? "Drop local PNG files or a package JSON here. Sources are copied into this area."
          : "Read-only vault · PNG imports and file drops are disabled."}
      </div>
      {items.length === 0 ? (
        <p className="inventory-empty">No assets match these filters.</p>
      ) : (
        <div className="inventory-grid">
          {items.map((item) => (
            <article key={item.id} className="inventory-card">
              <InventoryThumbnail item={item} onRequest={onThumbnailRequest} />
              <h2>{item.name}</h2>
              {item.archived && <span className="inventory-card__state">Archived</span>}
              <p>
                {item.slotId} · {item.direction.toUpperCase()} · {item.kind}
              </p>
              <small>
                {formatProfile(item.profile)} · {item.usageCount} use
                {item.usageCount === 1 ? "" : "s"}
              </small>
              <button
                type="button"
                disabled={busy || !writable || item.archived}
                onClick={() => setRemoving(item)}
              >
                Archive…
              </button>
            </article>
          ))}
        </div>
      )}
      <footer className="inventory-pagination">
        <output aria-live="polite">
          Showing {items.length} of {totalItems} asset metadata records
        </output>
        {hasMore && (
          <button type="button" disabled={busy} onClick={onLoadMore}>
            {busy ? "Loading…" : "Load more assets"}
          </button>
        )}
      </footer>
      {removing && (
        <div
          ref={removeModal.dialogRef}
          className="inventory-remove"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-asset-title"
          onKeyDown={removeModal.onDialogKeyDown}
        >
          <strong id="remove-asset-title">Archive {removing.name}?</strong>
          <p>
            {removing.usageCount > 0
              ? `Used by ${removing.usageCount} saved assignment(s). Archiving preserves those references and the immutable image revision.`
              : "This asset is not used. Archiving keeps it recoverable and hides it from new assignments."}
          </p>
          {removing.usageDescriptions.length > 0 && (
            <ul>
              {removing.usageDescriptions.map((description) => (
                <li key={description}>{description}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={busy || !writable}
            onClick={() => {
              onArchive(removing);
              setRemoving(null);
            }}
          >
            Archive asset
          </button>
          <button ref={cancelRemoveButton} type="button" onClick={() => setRemoving(null)}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

function InventoryThumbnail({
  item,
  onRequest,
}: {
  item: InventoryItem;
  onRequest?: (item: InventoryItem) => Promise<string>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [url, setUrl] = useState(item.thumbnailUrl ?? "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting === true),
      { rootMargin: "96px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setUrl(item.thumbnailUrl ?? "");
    setFailed(false);
  }, [item.id, item.thumbnailRevision, item.thumbnailUrl]);

  useEffect(() => {
    if (!visible && !item.thumbnailUrl) {
      setUrl("");
      setFailed(false);
    }
  }, [item.thumbnailUrl, visible]);

  useEffect(() => {
    if (!visible || url || !onRequest) return;
    let active = true;
    void onRequest(item)
      .then((thumbnail) => {
        if (active) setUrl(thumbnail);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [item, onRequest, url, visible]);

  return (
    <div ref={host} className="inventory-thumbnail">
      {url ? (
        <img src={url} alt={`${item.name} source thumbnail`} width={48} height={48} />
      ) : (
        <span
          role="img"
          aria-label={`${item.name} thumbnail ${failed ? "unavailable" : "loading"}`}
        >
          {failed ? "Preview unavailable" : "Preview loads when visible"}
        </span>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option value={value} key={value}>
              {value === "all" ? `All ${label.toLowerCase()}` : optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatProfile(profile: string): string {
  const separator = profile.lastIndexOf("@");
  if (separator < 0) return profile;
  return `${profile.slice(0, separator).slice(0, 8)} · r${profile.slice(separator + 1)}`;
}
