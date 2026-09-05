import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assetClient, type AssetClient } from "../../api/asset-client";
import type {
  AssetImportInspection,
  AssetImportJobView,
  AssetInventoryItem,
  AssetInventoryPage,
  AssetInventoryQuery,
  ImportDecision,
} from "../../domain/inventory";
import { ImportReviewDialog } from "./ImportReviewDialog";
import { InventoryPage } from "./InventoryPage";
import { emptyInventoryFilter, type InventoryFilter, type InventoryItem } from "./inventory-filter";

export const THUMBNAIL_CACHE_LIMIT = 256;

export function InventoryWorkspace({
  areaId,
  client = assetClient,
  importJob: managedImportJob,
  onImportJobChange,
  onStatus,
  sessionId,
}: {
  areaId: string;
  client?: AssetClient;
  importJob?: AssetImportJobView | null;
  onImportJobChange?: (job: AssetImportJobView) => void;
  onStatus?: (message: string) => void;
  sessionId: string;
}) {
  const [inventory, setInventory] = useState<AssetInventoryPage | null>(null);
  const [inspection, setInspection] = useState<AssetImportInspection | null>(null);
  const [inspectionRunningId, setInspectionRunningId] = useState<string | null>(null);
  const [localImportJob, setLocalImportJob] = useState<AssetImportJobView | null>(null);
  const [filter, setFilter] = useState<InventoryFilter>(emptyInventoryFilter);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const contextKey = `${sessionId}\u0000${areaId}`;
  const activeContext = useRef(contextKey);
  activeContext.current = contextKey;
  const activeQuery = useRef("");
  const requestGeneration = useRef({ archive: 0, inspect: 0, inventory: 0, more: 0 });
  const handledImport = useRef<string | null>(null);
  const activeInspectionId = useRef<string | null>(null);
  const thumbnailCache = useRef(new Map<string, Promise<string>>());
  const query = useMemo(() => inventoryQuery(filter), [filter]);
  const queryKey = JSON.stringify(query);
  activeQuery.current = queryKey;
  const importJob = managedImportJob === undefined ? localImportJob : managedImportJob;
  const areaImportJob = importJob?.area_id === areaId ? importJob : null;

  const updateImportJob = useCallback(
    (job: AssetImportJobView): void => {
      if (managedImportJob === undefined) setLocalImportJob(job);
      onImportJobChange?.(job);
    },
    [managedImportJob, onImportJobChange],
  );

  const loadFirstPage = useCallback(async (): Promise<AssetInventoryPage> => {
    return client.inventory(sessionId, areaId, null, 50, query);
  }, [areaId, client, query, sessionId]);

  const inspectPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || inventory?.writable !== true) {
        if (paths.length > 0) onStatus?.("Read-only vault · asset imports are disabled");
        return;
      }
      if (activeInspectionId.current) return;
      const requestContext = `${sessionId}\u0000${areaId}`;
      const generation = ++requestGeneration.current.inspect;
      const inspectionId = globalThis.crypto.randomUUID();
      activeInspectionId.current = inspectionId;
      setInspectionRunningId(inspectionId);
      setBusy(true);
      setError(null);
      try {
        const result = await client.inspect(sessionId, areaId, paths, inspectionId);
        if (
          !mounted.current ||
          activeContext.current !== requestContext ||
          requestGeneration.current.inspect !== generation
        )
          return;
        setInspection(result);
        onStatus?.(`${result.entries.length} import assignment(s) ready for review`);
      } catch (reason) {
        if (
          !mounted.current ||
          activeContext.current !== requestContext ||
          requestGeneration.current.inspect !== generation
        )
          return;
        setError(message(reason));
        onStatus?.("Asset import inspection failed; no source was copied");
      } finally {
        if (activeInspectionId.current === inspectionId) {
          activeInspectionId.current = null;
          if (mounted.current && activeContext.current === requestContext) {
            setInspectionRunningId(null);
          }
        }
        if (
          mounted.current &&
          activeContext.current === requestContext &&
          requestGeneration.current.inspect === generation
        )
          setBusy(false);
      }
    },
    [areaId, client, inventory?.writable, onStatus, sessionId],
  );

  useEffect(() => {
    const requestContext = contextKey;
    const requestQuery = queryKey;
    const generation = ++requestGeneration.current.inventory;
    setBusy(true);
    setInventory(null);
    setInspection(null);
    setInspectionRunningId(null);
    setError(null);
    thumbnailCache.current.clear();
    void loadFirstPage()
      .then((result) => {
        if (
          mounted.current &&
          activeContext.current === requestContext &&
          activeQuery.current === requestQuery &&
          requestGeneration.current.inventory === generation
        )
          setInventory(result);
      })
      .catch((reason: unknown) => {
        if (
          mounted.current &&
          activeContext.current === requestContext &&
          activeQuery.current === requestQuery &&
          requestGeneration.current.inventory === generation
        )
          setError(message(reason));
      })
      .finally(() => {
        if (
          mounted.current &&
          activeContext.current === requestContext &&
          activeQuery.current === requestQuery &&
          requestGeneration.current.inventory === generation
        )
          setBusy(false);
      });
    return () => {
      if (requestGeneration.current.inventory === generation) {
        requestGeneration.current.inventory += 1;
      }
    };
  }, [contextKey, loadFirstPage, queryKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      const inspectionId = activeInspectionId.current;
      if (inspectionId && typeof client.cancelInspection === "function") {
        activeInspectionId.current = null;
        void client.cancelInspection(sessionId, inspectionId).catch(() => undefined);
      }
    },
    [areaId, client, sessionId],
  );

  useEffect(() => {
    if (managedImportJob !== undefined || !areaImportJob || !isActiveJob(areaImportJob)) return;
    let disposed = false;
    let timer = 0;
    const poll = (): void => {
      timer = window.setTimeout(() => {
        void client
          .importJob(sessionId, areaImportJob.job_id)
          .then((job) => {
            if (!disposed) updateImportJob(job);
          })
          .catch((reason: unknown) => {
            if (disposed) return;
            setError(`Import progress temporarily unavailable; retrying · ${message(reason)}`);
            poll();
          });
      }, 250);
    };
    poll();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [areaImportJob, client, managedImportJob, sessionId, updateImportJob]);

  useEffect(() => {
    if (!areaImportJob || isActiveJob(areaImportJob)) return;
    const handledKey = `${areaImportJob.job_id}:${areaImportJob.state}`;
    if (handledImport.current === handledKey) return;
    handledImport.current = handledKey;
    const requestContext = contextKey;
    if (areaImportJob.state === "completed") {
      const requestQuery = queryKey;
      setBusy(true);
      void loadFirstPage()
        .then((refreshed) => {
          if (
            !mounted.current ||
            activeContext.current !== requestContext ||
            activeQuery.current !== requestQuery
          )
            return;
          setInventory(refreshed);
          thumbnailCache.current.clear();
          const imported = areaImportJob.result?.imported_assets.length ?? 0;
          onStatus?.(
            areaImportJob.result?.warning
              ? `${imported} asset image(s) committed · ${areaImportJob.result.warning}`
              : `${imported} asset image(s) copied into the area vault`,
          );
        })
        .catch((reason: unknown) => {
          if (
            mounted.current &&
            activeContext.current === requestContext &&
            activeQuery.current === requestQuery
          )
            setError(message(reason));
        })
        .finally(() => {
          if (
            mounted.current &&
            activeContext.current === requestContext &&
            activeQuery.current === requestQuery
          )
            setBusy(false);
        });
    } else if (areaImportJob.state === "cancelled") {
      onStatus?.("Asset import cancelled; completed transaction steps were reconciled safely");
    } else {
      const failure = areaImportJob.error ?? "Asset import failed";
      setError(failure);
      onStatus?.(`Asset import failed · ${failure}`);
    }
  }, [areaImportJob, contextKey, loadFirstPage, onStatus, queryKey]);

  useEffect(() => {
    if (inventory?.writable !== true) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void client
      .listenForDrops((paths) => void inspectPaths(paths))
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [client, inspectPaths, inventory?.writable]);

  const items = useMemo(() => mapInventory(inventory), [inventory]);

  async function chooseSources(): Promise<void> {
    if (inventory?.writable !== true) return;
    const requestContext = contextKey;
    try {
      const paths = await client.chooseSources();
      if (!mounted.current || activeContext.current !== requestContext) return;
      await inspectPaths(paths);
    } catch (reason) {
      if (mounted.current && activeContext.current === requestContext) setError(message(reason));
    }
  }

  async function confirmImport(decisions: ImportDecision[]): Promise<void> {
    if (!inspection || inventory?.writable !== true) return;
    const requestContext = contextKey;
    setBusy(true);
    setError(null);
    try {
      const result = await client.import(sessionId, {
        area_id: areaId,
        inspection_fingerprint: inspection.inspection_fingerprint,
        source: inspection.source,
        decisions,
      });
      if (!mounted.current || activeContext.current !== requestContext) {
        onImportJobChange?.(result);
        return;
      }
      setInspection(null);
      updateImportJob(result);
      onStatus?.("Asset import started · progress remains available across the workspace");
    } catch (reason) {
      if (!mounted.current || activeContext.current !== requestContext) return;
      setError(message(reason));
      onStatus?.("Asset import failed; review the reported source or assignment");
    } finally {
      if (mounted.current && activeContext.current === requestContext) setBusy(false);
    }
  }

  async function archive(item: InventoryItem): Promise<void> {
    if (inventory?.writable !== true) return;
    const requestContext = contextKey;
    const generation = ++requestGeneration.current.archive;
    setBusy(true);
    setError(null);
    try {
      const result = await client.archive(sessionId, areaId, item.id, item.revision);
      if (
        !mounted.current ||
        activeContext.current !== requestContext ||
        requestGeneration.current.archive !== generation
      )
        return;
      setInventory((current) =>
        current
          ? {
              ...current,
              items: current.items.map((candidate) =>
                candidate.id === result.id ? result : candidate,
              ),
            }
          : current,
      );
      onStatus?.(`${item.name} archived; saved references remain intact`);
    } catch (reason) {
      if (
        mounted.current &&
        activeContext.current === requestContext &&
        requestGeneration.current.archive === generation
      )
        setError(message(reason));
    } finally {
      if (
        mounted.current &&
        activeContext.current === requestContext &&
        requestGeneration.current.archive === generation
      )
        setBusy(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (!inventory?.next_cursor || busy) return;
    const cursor = inventory.next_cursor;
    const requestContext = contextKey;
    const requestQuery = queryKey;
    const generation = ++requestGeneration.current.more;
    setBusy(true);
    setError(null);
    try {
      const page = await client.inventory(sessionId, areaId, cursor, 50, query);
      if (
        !mounted.current ||
        activeContext.current !== requestContext ||
        activeQuery.current !== requestQuery ||
        requestGeneration.current.more !== generation
      )
        return;
      setInventory((current) =>
        current?.next_cursor === cursor
          ? {
              ...page,
              items: mergeItems(current.items, page.items),
            }
          : current,
      );
    } catch (reason) {
      if (
        mounted.current &&
        activeContext.current === requestContext &&
        activeQuery.current === requestQuery &&
        requestGeneration.current.more === generation
      )
        setError(message(reason));
    } finally {
      if (
        mounted.current &&
        activeContext.current === requestContext &&
        activeQuery.current === requestQuery &&
        requestGeneration.current.more === generation
      )
        setBusy(false);
    }
  }

  function requestThumbnail(item: InventoryItem): Promise<string> {
    const key = `${contextKey}:${item.id}@${item.thumbnailRevision}`;
    const existing = thumbnailCache.current.get(key);
    if (existing) {
      thumbnailCache.current.delete(key);
      thumbnailCache.current.set(key, existing);
      return existing;
    }
    const request = client
      .thumbnail(sessionId, areaId, item.id, item.thumbnailRevision, 48)
      .then((thumbnail) => thumbnail.data_url)
      .catch((reason) => {
        if (thumbnailCache.current.get(key) === request) thumbnailCache.current.delete(key);
        throw reason;
      });
    thumbnailCache.current.set(key, request);
    while (thumbnailCache.current.size > THUMBNAIL_CACHE_LIMIT) {
      const oldest = thumbnailCache.current.keys().next().value;
      if (oldest === undefined) break;
      thumbnailCache.current.delete(oldest);
    }
    return request;
  }

  async function cancelImport(): Promise<void> {
    if (!areaImportJob || !isActiveJob(areaImportJob)) return;
    try {
      const cancelled = await client.cancelImport(sessionId, areaImportJob.job_id);
      updateImportJob(cancelled);
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function cancelInspection(): Promise<void> {
    const inspectionId = activeInspectionId.current;
    if (!inspectionId || typeof client.cancelInspection !== "function") return;
    try {
      const accepted = await client.cancelInspection(sessionId, inspectionId);
      if (activeInspectionId.current !== inspectionId) return;
      onStatus?.(
        accepted
          ? "Cancelling asset inspection…"
          : "Asset inspection already finished; awaiting its result",
      );
    } catch (reason) {
      if (activeInspectionId.current === inspectionId) setError(message(reason));
    }
  }

  const workspaceBusy = busy || (areaImportJob !== null && isActiveJob(areaImportJob));

  if (!inventory && busy) return <p role="status">Loading PNG inventory…</p>;

  return (
    <>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {inspectionRunningId && (
        <section className="inventory-job" aria-label="Asset inspection progress">
          <div>
            <strong>Inspecting source images…</strong>
            <span>No files have been copied yet.</span>
          </div>
          <progress aria-label="Asset inspection in progress" />
          <button type="button" onClick={() => void cancelInspection()}>
            Cancel inspection
          </button>
        </section>
      )}
      {areaImportJob && isActiveJob(areaImportJob) && (
        <section className="inventory-job" aria-label="Asset import progress">
          <div>
            <strong>{areaImportJob.progress.message}</strong>
            <span>
              {areaImportJob.progress.completed} / {areaImportJob.progress.total} ·{" "}
              {areaImportJob.progress.stage}
            </span>
          </div>
          <progress
            value={areaImportJob.progress.completed}
            max={Math.max(1, areaImportJob.progress.total)}
          />
          <button type="button" onClick={() => void cancelImport()}>
            Cancel import
          </button>
        </section>
      )}
      {!inventory ? (
        <p>Inventory could not be loaded.</p>
      ) : (
        <InventoryPage
          busy={workspaceBusy}
          facets={inventory.facets}
          filter={filter}
          hasMore={inventory.next_cursor !== null}
          items={items}
          labels={inventory.labels}
          onArchive={(item) => void archive(item)}
          onChoosePackage={() => void chooseSources()}
          onLoadMore={() => void loadMore()}
          onThumbnailRequest={requestThumbnail}
          onDropFiles={(files) => {
            const paths = files
              .map((file) => (file as File & { path?: string }).path)
              .filter((path): path is string => Boolean(path));
            if (paths.length > 0) void inspectPaths(paths);
          }}
          onFilterChange={setFilter}
          writable={inventory.writable}
          totalItems={inventory.total_items}
        />
      )}
      {inspection && inventory?.writable === true && (
        <ImportReviewDialog
          busy={workspaceBusy}
          inspection={inspection}
          onCancel={() => setInspection(null)}
          onConfirm={(decisions) => void confirmImport(decisions)}
          writable={inventory.writable}
        />
      )}
    </>
  );
}

function mapInventory(inventory: AssetInventoryPage | null): InventoryItem[] {
  if (!inventory) return [];
  const labels = new Map(inventory.labels.map((label) => [label.id, label.name]));
  return inventory.items.map((item) => mapItem(item, labels));
}

function mapItem(item: AssetInventoryItem, labels: ReadonlyMap<string, string>): InventoryItem {
  return {
    id: item.id,
    revision: item.revision,
    thumbnailRevision: item.released_revision,
    name: item.name,
    slotId: item.slot_id,
    direction: item.direction,
    kind: item.asset_kind,
    profile: `${item.profile_ref.id}@${item.profile_ref.revision}`,
    labels: item.label_ids.map((id) => labels.get(id) ?? id),
    usageCount: item.usage.length,
    usageDescriptions: item.usage.map((usage) => usage.description),
    archived: item.archived,
  };
}

function isActiveJob(job: AssetImportJobView): boolean {
  return job.state === "queued" || job.state === "running";
}

function mergeItems(
  current: readonly AssetInventoryItem[],
  next: readonly AssetInventoryItem[],
): AssetInventoryItem[] {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of next) items.set(item.id, item);
  return [...items.values()];
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function inventoryQuery(filter: InventoryFilter): AssetInventoryQuery {
  return {
    search: filter.query.trim(),
    slot_id: filter.slot === "all" ? null : filter.slot,
    direction: filter.direction === "all" ? null : filter.direction,
    asset_kind: filter.kind === "all" ? null : filter.kind,
    profile_ref: filter.profile === "all" ? null : parseProfileRef(filter.profile),
    label_id: filter.label === "all" ? null : filter.label,
    usage: filter.usage === "all" ? "any" : filter.usage,
    sort: filter.sort,
  };
}

function parseProfileRef(value: string): { id: string; revision: number } | null {
  const separator = value.lastIndexOf("@");
  if (separator < 1) return null;
  const revision = Number(value.slice(separator + 1));
  if (!Number.isInteger(revision) || revision < 1) return null;
  return { id: value.slice(0, separator), revision };
}
