import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { WorkspaceEntry, DataFolderSession } from "./dataFolderClient";
import type { DataFolderBrowser } from "./useDataFolderBrowser";
import styles from "./DataFolderToolbar.module.css";

export interface DataFolderViewSlot {
  readonly label?: string;
  readonly content: ReactNode;
}

function Thumbnail({
  entry,
  repository,
  version,
}: {
  entry: WorkspaceEntry;
  repository: DataFolderSession;
  version: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let started = false;
    setImage(null);
    const load = () => {
      if (started) return;
      started = true;
      void repository.thumbnail(entry).then(
        (value) => {
          if (active) setImage(value.dataUrl);
        },
        () => undefined,
      );
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((value) => value.isIntersecting)) {
              load();
              observer?.disconnect();
            }
          });
    if (observer && ref.current) observer.observe(ref.current);
    else load();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [entry, repository, version]);
  return (
    <span className={styles.thumbnail} ref={ref} aria-hidden="true">
      {image ? <img src={image} alt="" width={28} height={28} /> : "▧"}
    </span>
  );
}

export function DataFolderToolbar({
  browser: b,
  viewSlot,
  tab,
  onTabChange,
}: {
  browser: DataFolderBrowser;
  viewSlot?: DataFolderViewSlot;
  tab: "files" | "view";
  onTabChange(tab: "files" | "view"): void;
}) {
  const id = useId();
  const tree = useRef<HTMLUListElement>(null);
  const crumbs = b.rootPath;
  const rows: { entry: WorkspaceEntry; parent: string }[] = [];
  const collect = (path: string) => {
    for (const entry of b.pages[path]?.data?.entries ?? []) {
      rows.push({ entry, parent: path });
      if (b.expanded.has(entry.relativePath)) collect(entry.relativePath);
    }
  };
  collect(b.rootPath);
  const focused = rows.some(({ entry }) => entry.relativePath === b.focusPath)
    ? b.focusPath
    : rows[0]?.entry.relativePath;
  function focus(path: string | undefined) {
    if (!path) return;
    b.setFocusPath(path);
    Array.from(tree.current?.querySelectorAll<HTMLElement>("[data-entry-path]") ?? [])
      .find((element) => element.dataset.entryPath === path)
      ?.focus();
  }
  function keyDown(event: KeyboardEvent, entry: WorkspaceEntry, parent: string) {
    const index = rows.findIndex((row) => row.entry.relativePath === entry.relativePath);
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "ArrowLeft", "ArrowRight", "Enter", " "].includes(
        event.key,
      )
    )
      event.preventDefault();
    if (event.key === "ArrowDown")
      focus(rows[Math.min(rows.length - 1, index + 1)]?.entry.relativePath);
    if (event.key === "ArrowUp") focus(rows[Math.max(0, index - 1)]?.entry.relativePath);
    if (event.key === "Home") focus(rows[0]?.entry.relativePath);
    if (event.key === "End") focus(rows.at(-1)?.entry.relativePath);
    if (event.key === "ArrowRight" && entry.kind === "directory") {
      if (b.expanded.has(entry.relativePath))
        focus(b.pages[entry.relativePath]?.data?.entries[0]?.relativePath);
      else b.expand(entry);
    }
    if (event.key === "ArrowLeft") {
      if (b.expanded.has(entry.relativePath)) b.collapse(entry.relativePath);
      else focus(parent);
    }
    if (event.key === "Enter" || event.key === " ") void b.activate(entry);
  }
  function pageContents(path: string, level: number): ReactNode {
    const page = b.pages[path];
    return (
      <>
        {page?.loading ? (
          <li role="none">
            <p role="status">Ordner wird gelesen …</p>
          </li>
        ) : null}
        {page?.error ? (
          <li role="none">
            <p role="alert">{page.error}</p>
            <button type="button" onClick={() => void b.load(path)}>
              Erneut lesen
            </button>
          </li>
        ) : null}
        {page?.data?.entries.map((entry) => (
          <li key={entry.relativePath} role="none">
            <button
              type="button"
              role="treeitem"
              data-entry-path={entry.relativePath}
              className={styles.entry}
              aria-level={level}
              aria-selected={b.selected?.relativePath === entry.relativePath}
              aria-expanded={
                entry.kind === "directory" ? b.expanded.has(entry.relativePath) : undefined
              }
              aria-disabled={
                entry.kind !== "directory" && (entry.technical || entry.kind === "unsupported")
                  ? true
                  : undefined
              }
              tabIndex={focused === entry.relativePath ? 0 : -1}
              onFocus={() => b.setFocusPath(entry.relativePath)}
              onKeyDown={(event) => keyDown(event, entry, path)}
              onClick={() => void b.activate(entry)}
            >
              {entry.kind === "image" && !entry.technical && b.previews && b.repository ? (
                <Thumbnail entry={entry} repository={b.repository} version={b.refreshVersion} />
              ) : (
                <span aria-hidden="true">
                  {entry.kind === "directory"
                    ? b.expanded.has(entry.relativePath)
                      ? "▾"
                      : "▸"
                    : "◇"}
                </span>
              )}
              <span className={styles.entryText}>
                {entry.name}
                <small>
                  {entry.technical
                    ? "Technisch · keine Quelle"
                    : entry.setCandidate
                      ? "Teile-Set · beim Öffnen prüfen"
                      : entry.kind === "image"
                        ? entry.name.split(".").at(-1)?.toUpperCase()
                        : entry.kind === "unsupported"
                          ? "Nicht unterstützt"
                          : "Ordner"}
                </small>
              </span>
            </button>
            {b.expanded.has(entry.relativePath) ? (
              <ul role="group" className={styles.group}>
                {pageContents(entry.relativePath, level + 1)}
              </ul>
            ) : null}
          </li>
        ))}
        {!page?.loading && page?.data?.totalMatches === 0 ? (
          <li role="none">
            <p>Keine passenden Dateien.</p>
          </li>
        ) : null}
        {page?.data && (page.data.nextCursor || page.cursors.length > 1) ? (
          <li role="none" className={styles.pager}>
            <button
              type="button"
              disabled={page.loading || page.cursors.length <= 1}
              aria-label={`Vorherige Seite: ${path || "Vault"}`}
              onClick={() => void b.load(path, page.cursors.slice(0, -1))}
            >
              Zurück
            </button>
            <span>
              Seite {page.cursors.length} · {page.data.totalMatches} Einträge
            </span>
            <button
              type="button"
              disabled={page.loading || !page.data.nextCursor}
              aria-label={`Nächste Seite: ${path || "Vault"}`}
              onClick={() => void b.load(path, [...page.cursors, page.data!.nextCursor])}
            >
              Weiter
            </button>
          </li>
        ) : null}
        {page?.data?.skippedEntries ? (
          <li role="none">
            <small>
              {page.data.skippedEntries} unsichere oder nicht lesbare Einträge ausgelassen.
            </small>
          </li>
        ) : null}
      </>
    );
  }

  return (
    <section className={styles.toolbar} aria-label="DataFolderToolbar" data-data-folder-toolbar>
      {viewSlot ? (
        <div role="tablist" aria-label="Dateibereich">
          {(["files", "view"] as const).map((value) => (
            <button
              type="button"
              role="tab"
              key={value}
              id={`${id}-${value}-tab`}
              aria-controls={`${id}-${value}`}
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => onTabChange(value)}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "files"
                      : event.key === "End"
                        ? "view"
                        : tab === "files"
                          ? "view"
                          : "files";
                  onTabChange(next);
                  document.getElementById(`${id}-${next}-tab`)?.focus();
                }
              }}
            >
              {value === "files" ? "Dateien" : (viewSlot.label ?? "View")}
            </button>
          ))}
        </div>
      ) : (
        <h2>Dateien</h2>
      )}
      <div
        id={`${id}-files`}
        role={viewSlot ? "tabpanel" : undefined}
        aria-labelledby={viewSlot ? `${id}-files-tab` : undefined}
        hidden={tab !== "files"}
      >
        <nav aria-label="Vault-Dateipfad" className={styles.breadcrumbs}>
          <button type="button" onClick={() => b.navigate("")}>
            {b.activeVault?.display_name ?? "Vault"}
          </button>
          {crumbs
            .split("/")
            .filter(Boolean)
            .map((name, index, parts) => (
              <button
                key={parts.slice(0, index + 1).join("/")}
                type="button"
                onClick={() => b.navigate(parts.slice(0, index + 1).join("/"))}
              >
                / {name}
              </button>
            ))}
        </nav>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            b.setSearch(b.searchInput.trim());
          }}
        >
          <label htmlFor={`${id}-search`}>Suche im aktuellen Ordner</label>
          <input
            id={`${id}-search`}
            type="search"
            maxLength={120}
            value={b.searchInput}
            onChange={(event) => b.setSearchInput(event.target.value)}
          />
          <button type="submit" disabled={!b.repository}>
            Suchen
          </button>
        </form>
        <label className={styles.filter}>
          Dateifilter
          <select
            value={b.filter}
            onChange={(event) => b.setFilter(event.target.value as typeof b.filter)}
          >
            <option value="all">Alle Dateien</option>
            <option value="images">Bilder und Ordner</option>
            <option value="folders">Nur Ordner</option>
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={b.showTechnical}
            onChange={(event) => b.setShowTechnical(event.target.checked)}
          />
          Technische Ordner anzeigen
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={b.previews}
            onChange={(event) => b.setPreviews(event.target.checked)}
          />
          Vorschauen bei Sichtbarkeit laden
        </label>
        <button type="button" disabled={!b.repository || b.busy} onClick={() => void b.refresh()}>
          Dateien aktualisieren
        </button>
        {!b.repository ? (
          <p>Öffne zuerst einen Vault.</p>
        ) : (
          <ul ref={tree} className={styles.tree} role="tree" aria-label="Vault-Dateien">
            {pageContents(b.rootPath, 1)}
          </ul>
        )}
        {b.selected ? (
          <p className={styles.selection}>
            Auswahl: <code>{b.selected.relativePath}</code>
          </p>
        ) : null}
        {b.selected?.kind === "directory" ? (
          <button type="button" onClick={() => b.navigate(b.selected!.relativePath)}>
            Diesen Ordner durchsuchen
          </button>
        ) : null}
        {b.busy ? <p role="status">Auswahl wird geprüft …</p> : null}
        {b.message ? <p role="status">{b.message}</p> : null}
        {b.error ? <p role="alert">{b.error}</p> : null}
      </div>
      {viewSlot ? (
        <div
          id={`${id}-view`}
          role="tabpanel"
          aria-labelledby={`${id}-view-tab`}
          hidden={tab !== "view"}
        >
          {viewSlot.content}
        </div>
      ) : null}
    </section>
  );
}
