import type { Direction } from "../../domain/common";
import type { AreaDashboardModel } from "./useAreaDashboard";

const DIRECTIONS: readonly { value: Direction; label: string }[] = [
  { value: "n", label: "North" },
  { value: "ne", label: "North-east" },
  { value: "e", label: "East" },
  { value: "se", label: "South-east" },
  { value: "s", label: "South" },
  { value: "sw", label: "South-west" },
  { value: "w", label: "West" },
  { value: "nw", label: "North-west" },
];

export function AreaProfileForm({ model }: { model: AreaDashboardModel }) {
  return (
    <form
      className="area-profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        void model.createArea();
      }}
    >
      <div className="area-form-heading">
        <div>
          <span>PROFILE INPUT</span>
          <h2>Humanoid NPC</h2>
        </div>
        <strong>{model.validHeight ? `${model.height} PX` : "—"}</strong>
      </div>
      <ProfileSettings model={model} />
      <ProfileLabels model={model} />
      <ProfileActions model={model} />
    </form>
  );
}

function ProfileSettings({ model }: { model: AreaDashboardModel }) {
  return (
    <>
      <label>
        Area name
        <input
          maxLength={120}
          onChange={(event) => model.setName(event.target.value)}
          required
          value={model.name}
        />
      </label>
      <div className="area-form-row">
        <label>
          Object type
          <select aria-label="Object type" value="humanoid" disabled>
            <option value="humanoid">Humanoid NPC</option>
          </select>
        </label>
        <label>
          Reference height
          <input
            aria-describedby="height-help"
            max={512}
            min={16}
            onChange={(event) => model.setHeight(event.currentTarget.valueAsNumber)}
            type="number"
            value={Number.isFinite(model.height) ? model.height : ""}
          />
        </label>
      </div>
      <small id="height-help">16–512 px · remainders are distributed deterministically.</small>
      <label>
        Preview direction
        <select
          aria-label="Preview direction"
          onChange={(event) => model.setDirection(event.target.value as Direction)}
          value={model.direction}
        >
          {DIRECTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function ProfileLabels({ model }: { model: AreaDashboardModel }) {
  return (
    <>
      <label>
        Project labels
        <select
          aria-label="Project labels"
          disabled={!model.dashboard || model.dashboard.labels.length === 0}
          multiple
          onChange={(event) =>
            model.setLabelIds(
              Array.from(event.currentTarget.selectedOptions, (option) => option.value),
            )
          }
          value={model.labelIds}
        >
          {model.dashboard?.labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      </label>
      {model.dashboard?.labels.length === 0 && (
        <small>Create project-scoped labels in the Projects workspace to assign them here.</small>
      )}
    </>
  );
}

function ProfileActions({ model }: { model: AreaDashboardModel }) {
  return (
    <>
      <div className="area-form-actions">
        <button
          className="primary-button"
          disabled={!model.canWrite || !model.validHeight || model.name.trim().length === 0}
          type="submit"
        >
          {model.busy ? "Working…" : "Create area"}
        </button>
        {model.selected && (
          <button
            disabled={!model.canWrite || !model.validHeight}
            onClick={() => void model.reviseSelected()}
            type="button"
          >
            Publish profile revision
          </button>
        )}
      </div>
      {model.selected && (
        <p className="area-selection-note">
          Selected: {model.selected.area.name} · profile r{model.selected.profile.revision}.
          Publishing preserves every older snapshot.
        </p>
      )}
    </>
  );
}
