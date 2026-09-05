import type { NpcWorkspaceContext } from "../../api/npc-client";
import { emptyNpcFilter, filterNpcs, type NpcFilter } from "./npc-filter";

interface NpcDashboardProps {
  context: NpcWorkspaceContext;
  filter: NpcFilter;
  selectedId: string | null;
  onFilterChange: (filter: NpcFilter) => void;
  onSelect: (id: string) => void;
}

export function NpcDashboard({
  context,
  filter,
  selectedId,
  onFilterChange,
  onSelect,
}: NpcDashboardProps) {
  const visible = filterNpcs(context.npcs, filter);
  const actions = unique(
    context.npcs.flatMap((npc) => [
      ...npc.character.required_actions,
      ...npc.bindings.map((view) => view.binding.action_key),
    ]),
  );

  function update<K extends keyof NpcFilter>(key: K, value: NpcFilter[K]): void {
    onFilterChange({ ...filter, [key]: value });
  }

  return (
    <section className="npc-dashboard" aria-labelledby="npc-dashboard-title">
      <header>
        <div>
          <span className="phase-tag">AREA CHARACTERS</span>
          <h1 id="npc-dashboard-title">NPCs</h1>
        </div>
        <span className="npc-count">{visible.length} visible</span>
      </header>
      <div className="npc-filters" aria-label="NPC filters">
        <label>
          Search
          <input
            aria-label="Search NPCs"
            type="search"
            value={filter.query}
            onChange={(event) => update("query", event.target.value)}
          />
        </label>
        <NpcSelect
          label="Label"
          value={filter.label}
          options={[
            ["all", "All labels"],
            ...context.available_labels.map((label) => [label.id, label.name] as const),
          ]}
          onChange={(value) => update("label", value)}
        />
        <NpcSelect
          label="Completeness"
          value={filter.completeness}
          options={[
            ["all", "All completeness"],
            ["complete", "Complete"],
            ["missing_actions", "Missing actions"],
          ]}
          onChange={(value) => update("completeness", value as NpcFilter["completeness"])}
        />
        <NpcSelect
          label="Required motion"
          value={filter.action}
          options={[["all", "All motions"], ...actions.map((action) => [action, action] as const)]}
          onChange={(value) => update("action", value)}
        />
        <NpcSelect
          label="Export status"
          value={filter.exportStatus}
          options={[
            ["all", "All export states"],
            ["current", "Current"],
            ["stale", "Stale"],
            ["not_exported", "Not exported"],
          ]}
          onChange={(value) => update("exportStatus", value as NpcFilter["exportStatus"])}
        />
        <NpcSelect
          label="Approval"
          value={filter.characterStatus}
          options={[
            ["all", "All approvals"],
            ["draft", "Draft"],
            ["reviewed", "Reviewed"],
            ["archived", "Archived"],
          ]}
          onChange={(value) => update("characterStatus", value as NpcFilter["characterStatus"])}
        />
        <NpcSelect
          label="Sort"
          value={filter.sort}
          options={[
            ["name", "Name"],
            ["updated", "Recently updated"],
            ["missing", "Most missing"],
            ["export", "Export attention"],
          ]}
          onChange={(value) => update("sort", value as NpcFilter["sort"])}
        />
        <button type="button" onClick={() => onFilterChange(emptyNpcFilter())}>
          Reset
        </button>
      </div>
      <div className="npc-card-list">
        {visible.length === 0 ? (
          <p className="npc-empty">No NPC matches these filters.</p>
        ) : (
          visible.map((npc) => (
            <button
              type="button"
              className="npc-card"
              data-selected={npc.character.id === selectedId}
              aria-pressed={npc.character.id === selectedId}
              key={npc.character.id}
              onClick={() => onSelect(npc.character.id)}
            >
              <span className="npc-card-heading">
                <strong>{npc.character.name}</strong>
                <StatusChip value={npc.character.status} />
              </span>
              <span className="npc-labels">
                {npc.labels.length === 0
                  ? "No labels"
                  : npc.labels.map((label) => label.name).join(" · ")}
              </span>
              <span className="npc-motion-strip">
                {npc.bindings.map((view) => (
                  <span key={view.binding.id}>
                    {view.binding.action_key} {view.covered_directions.length}/8
                  </span>
                ))}
              </span>
              <span>
                Required: {npc.character.required_actions.join(", ") || "none"}
                <br />
                Missing: {npc.missing_actions.join(", ") || "none"}
              </span>
              <span className="npc-card-footer">
                <StatusChip value={npc.completeness} />
                <StatusChip value={npc.export_status} />
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function NpcSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, name]) => (
          <option value={option} key={option}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusChip({ value }: { value: string }) {
  return <span className={`npc-status npc-status-${value}`}>{value.replaceAll("_", " ")}</span>;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
