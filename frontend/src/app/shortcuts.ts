import { isTextEditingKeyboardTarget, ownsNativeSpaceKey } from "../components/keyboard";

export type KeyboardAction = "save" | "undo" | "redo" | "toggle-playback" | "dismiss" | "help";

export interface KeyboardInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

export function resolveShortcut(input: KeyboardInput): KeyboardAction | null {
  const key = input.key.toLowerCase();
  if (key === "escape") return "dismiss";

  const command = input.ctrlKey || input.metaKey;
  if (command && isTextEditingKeyboardTarget(input.target)) return null;
  if (command && key === "s") return "save";
  if (command && key === "z" && input.shiftKey) return "redo";
  if (command && key === "z") return "undo";
  if (command && key === "y") return "redo";
  if (!command && !input.altKey && key === " ") {
    return ownsNativeSpaceKey(input.target) ? null : "toggle-playback";
  }
  if (!command && !input.altKey && key === "?") {
    return isTextEditingKeyboardTarget(input.target) ? null : "help";
  }
  return null;
}
