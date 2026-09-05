import { useCallback, useEffect, useMemo, useState } from "react";

import { assetClient, type AssetClient } from "../../api/asset-client";
import type {
  AssetImportInspection,
  AssetInventory,
  AssetInventoryItem,
  ImportDecision,
} from "../../domain/inventory";
import { ImportReviewDialog } from "./ImportReviewDialog";
import { InventoryPage } from "./InventoryPage";
import type { InventoryItem } from "./inventory-filter";

export function InventoryWorkspace({
  areaId,
  client = assetClient,
  onStatus,
  sessionId,
}: {
  areaId: string;
  client?: AssetClient;
  onStatus?: (message: string) => void;
  sessionId: string;
}) {
  const [inventory, setInventory] = useState<AssetInventory | null>(null);
  const [inspection, setInspection] = useState<AssetImportInspection | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inspectPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const result = await client.inspect(sessionId, areaId, paths);
        setInspection(result);
        onStatus?.(`${result.entries.length} import assignment(s) ready for review`);
      } catch (reason) {
        setError(message(reason));
        onStatus?.("Asset import inspection failed; no source was copied");
      } finally {
        setBusy(false);
      }
    },
    [areaId, client, onStatus, sessionId],
  );

  useEffect(() => {
    let live = true;
    setBusy(true);
    void client
      .inventory(sessionId, areaId)
      .then((result) => {
        if (live) setInventory(result);
      })
      .catch((reason: unknown) => {
        if (live) setError(message(reason));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [areaId, client, sessionId]);

  useEffect(() => {
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
  }, [client, inspectPaths]);

  const items = useMemo(() => mapInventory(inventory), [inventory]);

  async function chooseSources(): Promise<void> {
    try {
      await inspectPaths(await client.chooseSources());
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function confirmImport(decisions: ImportDecision[]): Promise<void> {
    if (!inspection) return;
    setBusy(true);
    setError(null);
    try {
      const result = await client.import(sessionId, {
        area_id: areaId,
        source: inspection.source,
        decisions,
      });
      setInventory(result);
      setInspection(null);
      onStatus?.(`${decisions.length} asset image(s) copied into the area vault`);
    } catch (reason) {
      setError(message(reason));
      onStatus?.("Asset import failed; review the reported source or assignment");
    } finally {
      setBusy(false);
    }
  }

  async function archive(item: InventoryItem): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await client.archive(sessionId, areaId, item.id, item.revision);
      setInventory(result);
      onStatus?.(`${item.name} archived; saved references remain intact`);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!inventory && busy) return <p role="status">Loading PNG inventory…</p>;

  return (
    <>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {!inventory ? (
        <p>Inventory could not be loaded.</p>
      ) : (
        <InventoryPage
          busy={busy}
          items={items}
          onArchive={(item) => void archive(item)}
          onChoosePackage={() => void chooseSources()}
          onDropFiles={(files) => {
            const paths = files
              .map((file) => (file as File & { path?: string }).path)
              .filter((path): path is string => Boolean(path));
            if (paths.length > 0) void inspectPaths(paths);
          }}
          writable={inventory.writable}
        />
      )}
      {inspection && (
        <ImportReviewDialog
          busy={busy}
          inspection={inspection}
          onCancel={() => setInspection(null)}
          onConfirm={(decisions) => void confirmImport(decisions)}
        />
      )}
    </>
  );
}

function mapInventory(inventory: AssetInventory | null): InventoryItem[] {
  if (!inventory) return [];
  const labels = new Map(inventory.labels.map((label) => [label.id, label.name]));
  return inventory.items.map((item) => mapItem(item, labels));
}

function mapItem(item: AssetInventoryItem, labels: ReadonlyMap<string, string>): InventoryItem {
  return {
    id: item.id,
    revision: item.revision,
    name: item.name,
    slotId: item.slot_id,
    direction: item.direction,
    kind: item.asset_kind,
    profile: `${item.profile_ref.id.slice(0, 8)} · r${item.profile_ref.revision}`,
    labels: item.label_ids.map((id) => labels.get(id) ?? id),
    usageCount: item.usage.length,
    usageDescriptions: item.usage.map((usage) => usage.description),
    thumbnailUrl: item.thumbnail_url,
    archived: item.archived,
  };
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
