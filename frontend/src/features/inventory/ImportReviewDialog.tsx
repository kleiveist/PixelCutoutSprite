import { useState } from "react";

import type { AssetImportInspection, ImportDecision, SizeHandling } from "../../domain/inventory";
import type { Direction } from "../../domain/common";

const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

interface DraftDecision {
  entry_index: number;
  slot_id: string;
  direction: Direction | "";
  size_handling: SizeHandling;
}

export function ImportReviewDialog({
  busy,
  inspection,
  onCancel,
  onConfirm,
  writable = true,
}: {
  busy: boolean;
  inspection: AssetImportInspection;
  onCancel: () => void;
  onConfirm: (decisions: ImportDecision[]) => void;
  writable?: boolean;
}) {
  const [decisions, setDecisions] = useState<DraftDecision[]>(() =>
    inspection.entries.map((entry) => ({
      entry_index: entry.entry_index,
      slot_id: entry.declared_slot_id ?? entry.suggested_slot_id ?? "",
      direction: entry.declared_direction ?? entry.suggested_direction ?? "",
      size_handling: "keep_original",
    })),
  );
  const complete = decisions.every((item) => item.slot_id && item.direction);

  function update(index: number, patch: Partial<DraftDecision>): void {
    setDecisions((current) =>
      current.map((decision) =>
        decision.entry_index === index ? { ...decision, ...patch } : decision,
      ),
    );
  }

  return (
    <div className="inventory-import-dialog" role="dialog" aria-modal="true">
      <header>
        <div>
          <span>Review before copying</span>
          <h2>Confirm {inspection.entries.length} import assignment(s)</h2>
        </div>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </header>
      <p>
        File-name matches are suggestions only. Every unassigned image needs an explicit slot and
        direction before its original is copied into this area.
      </p>
      {!writable && <p role="status">Read-only vault · this import cannot be changed or copied.</p>}
      <div className="inventory-import-list">
        {inspection.entries.map((entry) => {
          const decision = decisions.find((item) => item.entry_index === entry.entry_index)!;
          const packageAssigned = Boolean(entry.declared_slot_id && entry.declared_direction);
          return (
            <article key={entry.entry_index}>
              <div>
                <strong>{entry.name}</strong>
                <small>
                  {entry.source_name} · {entry.asset_kind} · {entry.effective_size_px[0]}×
                  {entry.effective_size_px[1]} px · pivot {entry.pivot_px.join(", ")}
                </small>
              </div>
              {entry.suggested_slot_id && !packageAssigned && (
                <p className="inventory-import-note">
                  Suggested from file name: {entry.suggested_slot_id} / {entry.suggested_direction}
                </p>
              )}
              {entry.duplicate_asset_id && (
                <p className="inventory-import-warning">
                  The unchanged PNG bytes already exist in asset {entry.duplicate_asset_id}.
                </p>
              )}
              {entry.size_warning && (
                <p className="inventory-import-warning">{entry.size_warning}</p>
              )}
              <div className="inventory-import-fields">
                <label>
                  Slot for {entry.name}
                  <select
                    disabled={busy || !writable || packageAssigned}
                    value={decision.slot_id}
                    onChange={(event) => update(entry.entry_index, { slot_id: event.target.value })}
                  >
                    <option value="">Choose slot…</option>
                    {inspection.slots.map((slot) => (
                      <option value={slot.id} key={slot.id}>
                        {slot.id} ({slot.size_px[0]}×{slot.size_px[1]})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Direction for {entry.name}
                  <select
                    disabled={busy || !writable || packageAssigned}
                    value={decision.direction}
                    onChange={(event) =>
                      update(entry.entry_index, { direction: event.target.value as Direction })
                    }
                  >
                    <option value="">Choose direction…</option>
                    {directions.map((direction) => (
                      <option value={direction} key={direction}>
                        {direction.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Size handling for {entry.name}
                  <select
                    disabled={busy || !writable}
                    value={decision.size_handling}
                    onChange={(event) =>
                      update(entry.entry_index, {
                        size_handling: event.target.value as SizeHandling,
                      })
                    }
                  >
                    {entry.size_options.map((option) => (
                      <option value={option} key={option}>
                        {sizeLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          );
        })}
      </div>
      <footer>
        {!complete && <span role="status">Assign every entry before importing.</span>}
        <button
          className="primary-button"
          disabled={busy || !writable || !complete}
          type="button"
          onClick={() =>
            onConfirm(
              decisions.map((decision) => ({
                ...decision,
                direction: decision.direction as Direction,
              })),
            )
          }
        >
          {busy ? "Copying…" : "Confirm and copy into vault"}
        </button>
      </footer>
    </div>
  );
}

function sizeLabel(value: SizeHandling): string {
  switch (value) {
    case "keep_original":
      return "Keep original dimensions";
    case "pad_transparent":
      return "Pad transparently to slot";
    case "rescale_nearest":
      return "Explicit nearest-neighbour rescale";
  }
}
