import {
  createV2StorageAdapter,
  type KeyValueStorage,
  type V2StorageAdapter,
} from "./storageAdapter";
import { migrateLegacyV1Storage, type LegacyV1StorageMigrationResult } from "./v1Migration";

export interface WorkspaceStorageBootstrap {
  readonly storageAdapter: V2StorageAdapter;
  readonly migration: LegacyV1StorageMigrationResult;
}

export function initializeWorkspaceStorage(
  storage: KeyValueStorage | null,
  options: Readonly<{ now?: () => string }> = {},
): WorkspaceStorageBootstrap {
  const storageAdapter = createV2StorageAdapter(storage);
  if (storage === null) {
    return {
      storageAdapter,
      migration: {
        status: "unavailable",
        message: "Browser storage is unavailable.",
        profilesWritten: false,
      },
    };
  }

  return {
    storageAdapter,
    migration: migrateLegacyV1Storage(storage, options),
  };
}

export function initializeBrowserWorkspaceStorage(): WorkspaceStorageBootstrap {
  try {
    return initializeWorkspaceStorage(typeof window === "undefined" ? null : window.localStorage);
  } catch {
    return initializeWorkspaceStorage(null);
  }
}

/**
 * Compatibility state for the still-mounted V2 wizard UI. It intentionally
 * lives only for the current renderer session and is never a persistence
 * fallback for the vault repository.
 */
export function initializeSessionWorkspaceStorage(): WorkspaceStorageBootstrap {
  const values = new Map<string, string>();
  return {
    storageAdapter: createV2StorageAdapter({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
    }),
    migration: { status: "notNeeded" },
  };
}
