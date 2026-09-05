import { SingleSelectFilter } from "../../components/DropdownFilter";
import type { MotionFilters as MotionFiltersValue } from "../../domain/animations";
import type { Direction } from "../../domain/common";

interface MotionFiltersProps {
  value: MotionFiltersValue;
  profileIds: readonly string[];
  onChange: (value: MotionFiltersValue) => void;
}

const directions: readonly { value: "any" | Direction; label: string }[] = [
  { value: "any", label: "Any direction" },
  ...(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const).map((value) => ({
    value,
    label: value.toUpperCase(),
  })),
];

export function MotionFilters({ value, profileIds, onChange }: MotionFiltersProps) {
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
        label="Direction"
        value={value.direction}
        options={directions}
        onChange={(next) => set("direction", next)}
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
        label="Profile"
        value={value.profile}
        options={[
          { value: "any", label: "Any profile" },
          ...profileIds.map((id, index) => ({ value: id, label: `Profile ${index + 1}` })),
        ]}
        onChange={(next) => set("profile", next)}
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
