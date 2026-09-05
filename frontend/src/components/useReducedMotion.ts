import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function currentPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY).matches
    : false;
}

/** Tracks the operating-system setting, including changes while the WebView is open. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(currentPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(QUERY);
    const update = (event: MediaQueryListEvent | MediaQueryList): void => setReduced(event.matches);
    update(media);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
