import { MultiSelectFilter, SingleSelectFilter } from "../../components/DropdownFilter";
import type { MotionFilters as MotionFiltersValue } from "../../domain/animations";
import type { Direction, RevisionRef } from "../../domain/common";

interface MotionFiltersProps {
  value: MotionFiltersValue;
  profiles: readonly RevisionRef[];
  actionKeys: readonly string[];
  labels: readonly { id: string; name: string }[];
  onChange: (value: MotionFiltersValue) => void;
}

const directions: readonly { value: "any" | Direction; label: string }[] = [
  { value: "any", label: "Any direction" },
  ...(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const).map((value) => ({
    value,
    label: value.toUpperCase(),
  })),
];

export function MotionFilters({
  value,
  profiles,
  actionKeys,
  labels,
  onChange,
}: MotionFiltersProps) {
  const set = <K extends keyof MotionFiltersValue>(key: K, next: MotionFiltersValue[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <div className="motion-filters" aria-label="Animation filters">
      <label className="filter-field">
        <span>Search</span>
        <input
          type="search"
          value={value.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </label>
      <SingleSelectFilter
        label="Movement / action"
        value={value.action}
        options={[
          { value: "any", label: "Any movement / action" },
          ...actionKeys.map((action) => ({ value: action, label: action })),
        ]}
        onChange={(next) => set("action", next)}
      />
      <SingleSelectFilter
        label="Direction"
        value={value.direction}
        options={directions}
        onChange={(next) => set("direction", next)}
      />
      <SingleSelectFilter
        label="Direction coverage"
        value={value.directionCoverage}
        options={[
          { value: "any", label: "Any coverage" },
          { value: "complete", label: "All eight directions" },
          { value: "partial", label: "Some directions" },
          { value: "missing", label: "No directions" },
        ]}
        onChange={(next) => set("directionCoverage", next)}
      />
      <SingleSelectFilter
        label="Status"
        value={value.status}
        options={[
          { value: "any", label: "Any status" },
          { value: "draft", label: "New draft" },
          { value: "released", label: "Released" },
          { value: "changes", label: "Unpublished changes" },
          { value: "archived", label: "Archived" },
        ]}
        onChange={(next) => set("status", next)}
      />
      <SingleSelectFilter
        label="Profile revision"
        value={value.profile}
        options={[
          { value: "any", label: "Any profile revision" },
          ...profiles.map((profile) => ({
            value: `${profile.id}@${profile.revision}`,
            label: `${profile.id.slice(0, 8)} · r${profile.revision}`,
          })),
        ]}
        onChange={(next) => set("profile", next)}
      />
      <MultiSelectFilter
        label="Labels"
        values={value.labelIds}
        options={labels.map((label) => ({ value: label.id, label: label.name }))}
        onChange={(next) => set("labelIds", next)}
      />
      <SingleSelectFilter
        label="Label match"
        value={value.labelMatch}
        options={[
          { value: "any", label: "At least one selected" },
          { value: "all", label: "All selected" },
        ]}
        onChange={(next) => set("labelMatch", next)}
      />
      <SingleSelectFilter
        label="Sort"
        value={value.sort}
        options={[
          { value: "updated_desc", label: "Recently updated" },
          { value: "updated_asc", label: "Oldest updated" },
          { value: "name_asc", label: "Name A–Z" },
          { value: "name_desc", label: "Name Z–A" },
        ]}
        onChange={(next) => set("sort", next)}
      />
    </div>
  );
}
