import { useEffect } from "react";

import { type KeyboardAction, resolveShortcut } from "./shortcuts";

export function useKeyboardActions(onAction: (action: KeyboardAction) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const action = resolveShortcut(event);
      if (!action) return;
      event.preventDefault();
      onAction(action);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAction]);
}
