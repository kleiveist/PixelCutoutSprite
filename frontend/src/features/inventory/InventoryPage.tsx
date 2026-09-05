import { useMemo, useState, type DragEvent } from "react";

import "./InventoryPage.css";
import {
  emptyInventoryFilter,
  filterInventory,
  type InventoryFilter,
  type InventoryItem,
} from "./inventory-filter";

interface InventoryPageProps {
  items: readonly InventoryItem[];
  onChoosePackage: () => void;
  onDropFiles: (files: File[]) => void;
  onArchive: (item: InventoryItem) => void;
  busy?: boolean;
  writable?: boolean;
}

export function InventoryPage({
  items,
  onChoosePackage,
  onDropFiles,
  onArchive,
  busy = false,
  writable = true,
}: InventoryPageProps) {
  const [filter, setFilter] = useState<InventoryFilter>(emptyInventoryFilter);
  const [removing, setRemoving] = useState<InventoryItem | null>(null);
  const visible = useMemo(() => filterInventory(items, filter), [filter, items]);
  const slots = unique(items.map((item) => item.slotId));
  const profiles = unique(items.map((item) => item.profile));
  const labels = unique(items.flatMap((item) => item.labels));

  function update<K extends keyof InventoryFilter>(key: K, value: InventoryFilter[K]): void {
    setFilter((current) => ({ ...current, [key]: value }));
  }

  function dropped(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
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
          options={["all", "n", "ne", "e", "se", "s", "sw", "w", "nw"]}
          onChange={(value) => update("direction", value as InventoryFilter["direction"])}
        />
        <Filter
          label="Type"
          value={filter.kind}
          options={["all", "body", "clothing", "armour", "accessory", "equipment"]}
          onChange={(value) => update("kind", value as InventoryFilter["kind"])}
        />
        <Filter
          label="Profile"
          value={filter.profile}
          options={["all", ...profiles]}
          onChange={(value) => update("profile", value)}
        />
        <Filter
          label="Labels"
          value={filter.label}
          options={["all", ...labels]}
          onChange={(value) => update("label", value)}
        />
        <Filter
          label="Usage"
          value={filter.usage}
          options={["all", "used", "unused"]}
          onChange={(value) => update("usage", value as InventoryFilter["usage"])}
        />
        <button type="button" onClick={() => setFilter(emptyInventoryFilter())}>
          Reset filters
        </button>
      </div>
      <div
        className="inventory-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropped}
      >
        Drop local PNG files or a package JSON here. Sources are copied into this area.
      </div>
      {visible.length === 0 ? (
        <p className="inventory-empty">No assets match these filters.</p>
      ) : (
        <div className="inventory-grid">
          {visible.map((item) => (
            <article key={item.id} className="inventory-card">
              <img src={item.thumbnailUrl} alt={`${item.name} source`} />
              <h2>{item.name}</h2>
              {item.archived && <span className="inventory-card__state">Archived</span>}
              <p>
                {item.slotId} · {item.direction.toUpperCase()} · {item.kind}
              </p>
              <small>
                {item.profile} · {item.usageCount} use{item.usageCount === 1 ? "" : "s"}
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
      {removing && (
        <div
          className="inventory-remove"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-asset-title"
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
          <button type="button" onClick={() => setRemoving(null)}>
            Cancel
          </button>
        </div>
      )}
    </section>
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
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option} key={option}>
            {option === "all" ? `All ${label.toLowerCase()}` : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
