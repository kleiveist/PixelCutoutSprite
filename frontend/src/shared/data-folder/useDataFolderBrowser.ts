import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveVault } from "../vault";
import { useDataFolder, type ImageModule } from "./DataFolderProvider";
import type { DirectoryPage, DirectoryQuery, WorkspaceEntry } from "./dataFolderClient";

export interface FolderPage {
  readonly data: DirectoryPage | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly cursors: readonly (string | null)[];
}
export function useDataFolderBrowser(module: ImageModule) {
  const { repository, select } = useDataFolder();
  const { activeVault, saveQueue, session } = useActiveVault();
  const [rootPath, setRootPath] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DirectoryQuery["filter"]>("all");
  const [showTechnical, setShowTechnical] = useState(false);
  const [previews, setPreviews] = useState(true);
  const [pages, setPages] = useState<Record<string, FolderPage>>({});
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<WorkspaceEntry | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const epoch = useRef(0);
  const activation = useRef(0);
  const requestSequence = useRef(0);
  const requests = useRef(new Map<string, number>());
  const state = useRef({ expanded, pages });
  state.current = { expanded, pages };

  const load = useCallback(
    async (path: string, cursors: readonly (string | null)[] = [null]) => {
      if (!repository) return;
      const generation = epoch.current;
      const request = ++requestSequence.current;
      requests.current.set(path, request);
      const cachePage = (current: Record<string, FolderPage>, page: FolderPage) => {
        const next = { ...current, [path]: page };
        for (const key of Object.keys(next)) {
          if (Object.keys(next).length <= 24) break;
          if (key !== rootPath && key !== path && !state.current.expanded.has(key))
            delete next[key];
        }
        return next;
      };
      setPages((current) =>
        cachePage(current, {
          data: current[path]?.data ?? null,
          loading: true,
          error: null,
          cursors,
        }),
      );
      try {
        const data = await repository.list({
          relativePath: path,
          search,
          filter,
          showTechnical,
          limit: 50,
          cursor: cursors.at(-1) ?? null,
        });
        if (epoch.current !== generation || requests.current.get(path) !== request) return;
        setPages((current) => cachePage(current, { data, loading: false, error: null, cursors }));
      } catch (reason) {
        if (epoch.current !== generation || requests.current.get(path) !== request) return;
        setPages((current) =>
          cachePage(current, {
            data: null,
            loading: false,
            error: String(reason instanceof Error ? reason.message : reason),
            cursors,
          }),
        );
      } finally {
        if (requests.current.get(path) === request) requests.current.delete(path);
      }
    },
    [filter, repository, rootPath, search, showTechnical],
  );

  useEffect(() => {
    epoch.current += 1;
    activation.current += 1;
    requests.current.clear();
    setPages({});
    setExpanded(new Set());
    setFocusPath(null);
    setSelected(null);
    setBusy(false);
    void load(rootPath);
    return () => {
      epoch.current += 1;
      activation.current += 1;
    };
  }, [load, rootPath, refreshVersion]);

  const refresh = useCallback(async () => {
    if (!repository || !session) return;
    const generation = epoch.current;
    setError(null);
    try {
      await saveQueue.flush(session);
      if (generation !== epoch.current) return;
      repository.invalidate();
      setMessage("Dateibaum neu eingelesen; Auswahlen werden beim Öffnen erneut geprüft.");
      setRefreshVersion((value) => value + 1);
    } catch (reason) {
      if (generation === epoch.current)
        setError(String(reason instanceof Error ? reason.message : reason));
    }
  }, [repository, saveQueue, session]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    if (!repository) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState !== "hidden") void latestRefresh.current();
      }, 200);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [repository]);

  function expand(entry: WorkspaceEntry) {
    if (entry.kind !== "directory") return;
    if (!expanded.has(entry.relativePath) && expanded.size >= 12) {
      setError(
        "Maximal zwölf Ordner gleichzeitig aufklappen. Schließe einen Ordner oder öffne den gewünschten Pfad über die Brotkrumen.",
      );
      return;
    }
    setExpanded((current) => new Set(current).add(entry.relativePath));
    if (!pages[entry.relativePath]) void load(entry.relativePath);
  }
  function collapse(path: string) {
    setExpanded(
      (current) =>
        new Set([...current].filter((entry) => entry !== path && !entry.startsWith(`${path}/`))),
    );
  }
  async function activate(entry: WorkspaceEntry) {
    setSelected(entry);
    setFocusPath(entry.relativePath);
    setError(null);
    setMessage(null);
    setBusy(false);
    const request = ++activation.current;
    if (entry.kind === "directory") {
      if (expanded.has(entry.relativePath)) collapse(entry.relativePath);
      else expand(entry);
    }
    if (entry.technical || entry.kind === "unsupported") {
      setMessage(
        entry.technical
          ? "Technischer Inhalt · keine Originalbildquelle."
          : "Nicht unterstützter Dateityp · wird nicht geöffnet.",
      );
      return;
    }
    if (!repository || !session) return;
    setBusy(true);
    try {
      await saveQueue.flush(session);
      if (request !== activation.current) return;
      const result = await repository.inspect(entry);
      if (request !== activation.current) return;
      if (result.kind === "directory") {
        setMessage(
          result.message ??
            "Ordner geöffnet. Wähle PNG, JPEG, WebP oder einen geprüften Teileordner.",
        );
      } else {
        select(module, { ...result, session: repository.identity });
        setMessage(
          result.kind === "image"
            ? `Bild geprüft · ${result.width} × ${result.height} px`
            : `Teile-Set geprüft · ${result.partCount} Teile${result.complete ? "" : " · ausdrücklich ausgelassene Pflichtteile"}`,
        );
      }
    } catch (reason) {
      if (request === activation.current)
        setError(String(reason instanceof Error ? reason.message : reason));
    } finally {
      if (request === activation.current) setBusy(false);
    }
  }
  function navigate(path: string) {
    setRootPath(path);
    setError(null);
    setMessage(null);
  }
  return {
    repository,
    activeVault,
    rootPath,
    navigate,
    searchInput,
    setSearchInput,
    search,
    setSearch,
    filter,
    setFilter,
    showTechnical,
    setShowTechnical,
    previews,
    setPreviews,
    pages,
    expanded,
    selected,
    focusPath,
    setFocusPath,
    message,
    error,
    busy,
    refresh,
    load,
    expand,
    collapse,
    activate,
    refreshVersion,
  };
}
export type DataFolderBrowser = ReturnType<typeof useDataFolderBrowser>;
