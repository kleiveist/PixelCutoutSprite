import { MultiSelectFilter, SingleSelectFilter } from "../../components/DropdownFilter";
import type {
  LabelMatch,
  LabelSummary,
  ProjectQuery,
  ProjectSort,
  ProjectStatusFilter,
} from "../../domain/projects";

interface ProjectFiltersProps {
  labels: readonly LabelSummary[];
  query: ProjectQuery;
  onChange: (query: ProjectQuery) => void;
  onReset: () => void;
}

const statusOptions: readonly { value: ProjectStatusFilter; label: string }[] = [
  { value: "any", label: "Active and archived" },
  { value: "active", label: "Active only" },
  { value: "archived", label: "Archived only" },
];

const matchOptions: readonly { value: LabelMatch; label: string }[] = [
  { value: "any", label: "At least one" },
  { value: "all", label: "All selected" },
];

const sortOptions: readonly { value: ProjectSort; label: string }[] = [
  { value: "updated_desc", label: "Recently changed" },
  { value: "updated_asc", label: "Oldest change" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

export function ProjectFilters({ labels, query, onChange, onReset }: ProjectFiltersProps) {
  return (
    <section className="project-filters" aria-label="Project filters">
      <label className="search-field">
        <span>Search</span>
        <input
          type="search"
          value={query.search}
          placeholder="Project name"
          onChange={(event) => onChange({ ...query, search: event.target.value })}
        />
      </label>
      <MultiSelectFilter
        label="Labels"
        values={query.label_ids}
        options={labels.map((label) => ({ value: label.id, label: label.name }))}
        onChange={(label_ids) => onChange({ ...query, label_ids })}
      />
      <SingleSelectFilter
        label="Label match"
        value={query.label_match}
        options={matchOptions}
        onChange={(label_match) => onChange({ ...query, label_match })}
      />
      <SingleSelectFilter
        label="Status"
        value={query.status}
        options={statusOptions}
        onChange={(status) => onChange({ ...query, status })}
      />
      <SingleSelectFilter
        label="Sort"
        value={query.sort}
        options={sortOptions}
        onChange={(sort) => onChange({ ...query, sort })}
      />
      <button className="reset-filters" type="button" onClick={onReset}>
        Reset filters
      </button>
    </section>
  );
}
