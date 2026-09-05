import type { Direction } from "../../domain/common";
import type { DirectionDefinition, DirectionMode } from "../../domain/motion";
import {
  DIRECTION_LABELS,
  DIRECTION_ORDER,
  directionAvailable,
  directionOrigin,
  horizontalMirror,
  withDirectionMode,
} from "./direction-model";
import "./direction-editor.css";

export interface DirectionEditorProps {
  definitions: readonly DirectionDefinition[];
  issues?: Partial<Record<Direction, readonly string[]>>;
  busyDirection?: Direction | null;
  readOnly?: boolean;
  onChange: (definitions: DirectionDefinition[]) => void;
  onDetach: (direction: Direction) => void;
}

export function DirectionEditor({
  definitions,
  issues = {},
  busyDirection = null,
  readOnly = false,
  onChange,
  onDetach,
}: DirectionEditorProps) {
  const rows = DIRECTION_ORDER.map(
    (direction) =>
      definitions.find((definition) => definition.direction === direction) ?? {
        direction,
        mode: "missing" as const,
        source: null,
      },
  );
  const covered = rows.filter((definition) => directionAvailable(rows, definition)).length;

  function changeMode(direction: Direction, mode: DirectionMode) {
    onChange(withDirectionMode(definitions, direction, mode));
  }

  return (
    <section className="direction-editor" aria-labelledby="direction-editor-title">
      <header className="direction-editor__header">
        <div>
          <p className="direction-editor__eyebrow">Direction coverage</p>
          <h2 id="direction-editor-title">Eight-direction setup</h2>
        </div>
        <p className="direction-editor__coverage" role="status">
          {covered} of 8 available
        </p>
      </header>

      <div className="direction-editor__table-wrap">
        <table className="direction-editor__table">
          <thead>
            <tr>
              <th scope="col">Direction</th>
              <th scope="col">Mode</th>
              <th scope="col">Origin</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((definition) => {
              const derivedIssue =
                definition.mode === "mirrored" && !directionAvailable(rows, definition)
                  ? `Mirror source ${definition.source?.toUpperCase() ?? "?"} is unavailable`
                  : null;
              const rowIssues = [
                ...(issues[definition.direction] ?? []),
                ...(derivedIssue ? [derivedIssue] : []),
              ];
              const isFrontOrBack = definition.direction === "n" || definition.direction === "s";
              return (
                <tr key={definition.direction} data-state={definition.mode}>
                  <th scope="row">{DIRECTION_LABELS[definition.direction]}</th>
                  <td>
                    <label className="direction-editor__field">
                      <span className="direction-editor__sr-only">
                        {definition.direction.toUpperCase()} mode
                      </span>
                      <select
                        aria-label={`${definition.direction.toUpperCase()} mode`}
                        value={definition.mode}
                        disabled={readOnly || busyDirection !== null}
                        onChange={(event) =>
                          changeMode(
                            definition.direction,
                            event.currentTarget.value as DirectionMode,
                          )
                        }
                      >
                        <option value="explicit">Explicit</option>
                        <option value="mirrored" disabled={isFrontOrBack}>
                          Mirrored
                        </option>
                        <option value="missing">Missing</option>
                      </select>
                    </label>
                  </td>
                  <td>
                    <span className="direction-editor__origin" data-mode={definition.mode}>
                      {directionOrigin(definition)}
                    </span>
                    {definition.mode === "mirrored" ? (
                      <label className="direction-editor__source">
                        <span>Source</span>
                        <select
                          aria-label={`${definition.direction.toUpperCase()} mirror source`}
                          value={definition.source ?? horizontalMirror(definition.direction)}
                          disabled
                          onChange={() => undefined}
                        >
                          <option value={horizontalMirror(definition.direction)}>
                            {horizontalMirror(definition.direction).toUpperCase()}
                          </option>
                        </select>
                      </label>
                    ) : null}
                    {rowIssues.map((issue) => (
                      <p className="direction-editor__issue" role="alert" key={issue}>
                        {issue}
                      </p>
                    ))}
                  </td>
                  <td>
                    {definition.mode === "mirrored" ? (
                      <button
                        type="button"
                        disabled={readOnly || busyDirection !== null}
                        onClick={() => onDetach(definition.direction)}
                      >
                        {busyDirection === definition.direction
                          ? "Detaching…"
                          : "Detach as explicit"}
                      </button>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
