const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "area[href]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='link']",
  "[role='listbox']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[role='option']",
  "[role='radio']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const TEXT_EDITING_SELECTOR = [
  "textarea",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='searchbox']",
].join(",");

const NATIVE_SPACE_SELECTOR = [
  "button",
  "a[href]",
  "area[href]",
  "summary",
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='link']",
  "[role='listbox']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[role='option']",
  "[role='radio']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
].join(",");

/**
 * Returns true when the event belongs to a native or ARIA control.
 *
 * App/editor shortcuts must not borrow Space, arrows, Delete, or command
 * combinations from the control that currently owns keyboard interaction.
 */
export function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

/** Returns true only for controls where command-key input may modify entered text. */
export function isTextEditingKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(TEXT_EDITING_SELECTOR)) return true;
  const input = target.closest("input");
  if (!(input instanceof HTMLInputElement)) return false;
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(input.type);
}

/** Returns true when Space has native activation/editing semantics at the event target. */
export function ownsNativeSpaceKey(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NATIVE_SPACE_SELECTOR) !== null;
}
