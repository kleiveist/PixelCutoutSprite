export type KeyboardAction = "save" | "undo" | "redo" | "toggle-playback" | "dismiss" | "help";

export interface KeyboardInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function resolveShortcut(input: KeyboardInput): KeyboardAction | null {
  const key = input.key.toLowerCase();
  if (key === "escape") return "dismiss";
  if (isEditableTarget(input.target)) return null;

  const command = input.ctrlKey || input.metaKey;
  if (command && key === "s") return "save";
  if (command && key === "z" && input.shiftKey) return "redo";
  if (command && key === "z") return "undo";
  if (command && key === "y") return "redo";
  if (!command && !input.altKey && key === " ") return "toggle-playback";
  if (!command && !input.altKey && key === "?") return "help";
  return null;
}
