import { useEffect, useId, useRef, useState } from "react";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface SingleSelectFilterProps<T extends string> {
  disabled?: boolean;
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
}

export function SingleSelectFilter<T extends string>({
  disabled = false,
  label,
  value,
  options,
  onChange,
}: SingleSelectFilterProps<T>) {
  const id = useId();
  return (
    <label className="filter-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface MultiSelectFilterProps<T extends string> {
  autoFocus?: boolean;
  disabled?: boolean;
  label: string;
  values: readonly T[];
  options: readonly FilterOption<T>[];
  onChange: (values: T[]) => void;
}

export function MultiSelectFilter<T extends string>({
  autoFocus = false,
  disabled = false,
  label,
  values,
  options,
  onChange,
}: MultiSelectFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const firstOption = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstOption.current?.focus();
  }, [open]);

  function toggle(value: T): void {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div
      className="filter-field multi-filter"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      <button
        autoFocus={autoFocus}
        disabled={disabled}
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((current) => !current)}
      >
        <span id={`${id}-value`}>{values.length === 0 ? "Any" : `${values.length} selected`}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="filter-popover" role="group" aria-label={`${label} options`}>
          {options.length === 0 ? (
            <span className="empty-option">No options yet</span>
          ) : (
            options.map((option, index) => (
              <label key={option.value}>
                <input
                  ref={index === 0 ? firstOption : undefined}
                  disabled={disabled}
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))
          )}
          {values.length > 0 && (
            <button
              type="button"
              className="filter-clear"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
