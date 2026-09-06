import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { AppSettings, MigrationBackup, ProfileLibrary, WizardDraft } from "../schemas";
import {
  createV2StorageAdapter,
  LEGACY_V1_STORAGE_KEYS,
  V2_STORAGE_KEYS,
  type KeyValueStorage,
  type StorageMutationResult,
  type V2StorageAdapter,
} from "./storageAdapter";
import {
  createBrowserOutputWorkspaceAdapter,
  type OutputTextFile,
  type OutputWorkspaceAdapter,
} from "./outputWorkspaceAdapter";
import type { LegacyV1StorageMigrationResult } from "./v1Migration";
import { initializeBrowserWorkspaceStorage } from "./workspaceBootstrap";

interface PromptWorkspaceSnapshot {
  settings: AppSettings | null;
  profiles: ProfileLibrary | null;
  draft: WizardDraft | null;
  migrationBackup: MigrationBackup | null;
}

export interface PromptWorkspaceStorage {
  readSettings(): Promise<AppSettings | null>;
  writeSettings(value: unknown): Promise<void>;
  readProfileLibrary(): Promise<ProfileLibrary | null>;
  writeProfileLibrary(value: unknown): Promise<void>;
  readDraft(): Promise<WizardDraft | null>;
  writeDraft(value: unknown): Promise<void>;
  removeDraft(): Promise<void>;
  readMigrationBackup(): Promise<MigrationBackup | null>;
  writeMigrationBackup(value: unknown): Promise<void>;
}

class TauriPromptWorkspaceStorage implements PromptWorkspaceStorage {
  private constructor(private snapshot: PromptWorkspaceSnapshot) {}

  static async open(): Promise<TauriPromptWorkspaceStorage> {
    const snapshot = await invoke<PromptWorkspaceSnapshot>("read_prompt_workspace");
    return new TauriPromptWorkspaceStorage({ ...snapshot });
  }

  async readSettings() {
    return this.snapshot.settings;
  }

  async writeSettings(value: unknown) {
    await this.write("settings", value);
    this.snapshot.settings = value as AppSettings;
  }

  async readProfileLibrary() {
    return this.snapshot.profiles;
  }

  async writeProfileLibrary(value: unknown) {
    await this.write("profiles", value);
    this.snapshot.profiles = value as ProfileLibrary;
  }

  async readDraft() {
    return this.snapshot.draft;
  }

  async writeDraft(value: unknown) {
    await this.write("draft", value);
    this.snapshot.draft = value as WizardDraft;
  }

  async removeDraft() {
    await invoke<void>("remove_prompt_draft");
    this.snapshot.draft = null;
  }

  async readMigrationBackup() {
    return this.snapshot.migrationBackup;
  }

  async writeMigrationBackup(value: unknown) {
    await this.write("migration_backup", value);
    this.snapshot.migrationBackup = value as MigrationBackup;
  }

  private async write(kind: string, value: unknown): Promise<void> {
    await invoke<void>("write_prompt_workspace", { kind, value });
  }
}

class MemoryKeyValueStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export interface NativeBackedV2StorageAdapter extends V2StorageAdapter {
  flush(): Promise<void>;
}

function validValue<Value>(
  result: ReturnType<V2StorageAdapter["readSettings"]> | { status: string; value?: Value },
): Value | null {
  return result.status === "valid" && "value" in result ? (result.value as Value) : null;
}

async function migrateBrowserWorkspaceWhenPresent(
  nativeStorage: PromptWorkspaceStorage,
): Promise<LegacyV1StorageMigrationResult> {
  if (typeof window === "undefined") return { status: "notNeeded" };
  const keys = [...Object.values(V2_STORAGE_KEYS), ...Object.values(LEGACY_V1_STORAGE_KEYS)];
  let present: boolean;
  try {
    present = keys.some((key) => window.localStorage.getItem(key) !== null);
  } catch {
    return { status: "notNeeded" };
  }
  if (!present) return { status: "notNeeded" };

  const browser = initializeBrowserWorkspaceStorage();
  const settings = validValue<AppSettings>(browser.storageAdapter.readSettings());
  const profiles = validValue<ProfileLibrary>(browser.storageAdapter.readProfileLibrary());
  const draft = validValue<WizardDraft>(browser.storageAdapter.readDraft());
  const backup = validValue<MigrationBackup>(browser.storageAdapter.readMigrationBackup());
  if (settings) await nativeStorage.writeSettings(settings);
  if (profiles) await nativeStorage.writeProfileLibrary(profiles);
  if (draft) await nativeStorage.writeDraft(draft);
  if (backup) await nativeStorage.writeMigrationBackup(backup);
  return browser.migration;
}

async function createNativeBackedV2StorageAdapter(
  nativeStorage: PromptWorkspaceStorage,
): Promise<NativeBackedV2StorageAdapter> {
  const memory = new MemoryKeyValueStorage();
  const settings = await nativeStorage.readSettings();
  const profiles = await nativeStorage.readProfileLibrary();
  const draft = await nativeStorage.readDraft();
  const backup = await nativeStorage.readMigrationBackup();

  if (settings) memory.setItem(V2_STORAGE_KEYS.settings, JSON.stringify(settings));
  if (profiles) {
    memory.setItem(
      V2_STORAGE_KEYS.baseProfiles,
      JSON.stringify({
        schemaVersion: 2,
        kind: "baseProfileCollection",
        profiles: profiles.baseProfiles,
      }),
    );
    memory.setItem(
      V2_STORAGE_KEYS.categoryProfiles,
      JSON.stringify({
        schemaVersion: 2,
        kind: "categoryProfileCollection",
        profiles: profiles.categoryProfiles,
      }),
    );
    memory.setItem(
      V2_STORAGE_KEYS.assetProfiles,
      JSON.stringify({
        schemaVersion: 2,
        kind: "assetProfileCollection",
        profiles: profiles.assetProfiles,
      }),
    );
  }
  if (draft) memory.setItem(V2_STORAGE_KEYS.draft, JSON.stringify(draft));
  if (backup) memory.setItem(V2_STORAGE_KEYS.migrationBackup, JSON.stringify(backup));

  const inMemory = createV2StorageAdapter(memory);
  const pendingOperations: Array<() => Promise<void>> = [];
  let activeFlush: Promise<void> | null = null;

  const startFlush = (): Promise<void> => {
    if (activeFlush !== null) return activeFlush;
    const worker = (async () => {
      while (pendingOperations.length > 0) {
        const operation = pendingOperations[0];
        if (!operation) return;
        await operation();
        pendingOperations.shift();
      }
    })();
    activeFlush = worker;
    void worker.then(
      () => {
        if (activeFlush !== worker) return;
        activeFlush = null;
        if (pendingOperations.length > 0) {
          void startFlush().catch(() => undefined);
        }
      },
      () => {
        if (activeFlush === worker) activeFlush = null;
      },
    );
    return worker;
  };

  const enqueue = (operation: () => Promise<void>): void => {
    pendingOperations.push(operation);
    void startFlush().catch(() => undefined);
  };
  const afterValidMutation = <Value>(
    result: StorageMutationResult,
    read: () => { status: string; value?: Value },
    write: (value: Value) => Promise<void>,
  ): StorageMutationResult => {
    if (result.status !== "ok") return result;
    const value = validValue<Value>(read());
    if (value !== null) enqueue(() => write(value));
    return result;
  };

  return {
    ...inMemory,
    writeSettings: (value) =>
      afterValidMutation(inMemory.writeSettings(value), inMemory.readSettings, (validated) =>
        nativeStorage.writeSettings(validated),
      ),
    writeProfileLibrary: (value) =>
      afterValidMutation(
        inMemory.writeProfileLibrary(value),
        inMemory.readProfileLibrary,
        (validated) => nativeStorage.writeProfileLibrary(validated),
      ),
    writeDraft: (value) =>
      afterValidMutation(inMemory.writeDraft(value), inMemory.readDraft, (validated) =>
        nativeStorage.writeDraft(validated),
      ),
    removeDraft: () => {
      const result = inMemory.removeDraft();
      if (result.status === "ok") enqueue(() => nativeStorage.removeDraft());
      return result;
    },
    writeMigrationBackup: (value) =>
      afterValidMutation(
        inMemory.writeMigrationBackup(value),
        inMemory.readMigrationBackup,
        (validated) => nativeStorage.writeMigrationBackup(validated),
      ),
    async flush() {
      while (activeFlush !== null || pendingOperations.length > 0) {
        await (activeFlush ?? startFlush());
      }
    },
  };
}

function nativeOutputFormat(file: OutputTextFile): "markdown" | "json" {
  return file.mimeType.startsWith("text/markdown") ? "markdown" : "json";
}

function createNativeOutputWorkspaceAdapter(): OutputWorkspaceAdapter {
  return {
    async copyText(text) {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable.");
      }
      await navigator.clipboard.writeText(text);
    },
    async downloadTextFile(file) {
      const format = nativeOutputFormat(file);
      const selected = await save({
        title: format === "markdown" ? "Prompt als Markdown speichern" : "Promptpaket speichern",
        defaultPath: file.filename,
        filters: [
          {
            name: format === "markdown" ? "Markdown" : "JSON",
            extensions: [format === "markdown" ? "md" : "json"],
          },
        ],
      });
      if (!selected) throw new Error("Speichern wurde abgebrochen.");
      await invoke<void>("save_prompt_output", {
        path: selected,
        contents: file.contents,
        format,
      });
    },
    async selectJsonFile() {
      const selected = await open({
        title: "PixelForge Prompt Studio V2-Paket importieren",
        directory: false,
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return null;
      const contents = await invoke<string>("read_prompt_package", { path: selected });
      return {
        filename: selected.split(/[\\/]/).pop() ?? "prompt-workspace.json",
        contents,
      };
    },
  };
}

export interface PromptStudioRuntimeAdapters {
  readonly storageAdapter: V2StorageAdapter;
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly flushStorage: () => Promise<void>;
  readonly migration: LegacyV1StorageMigrationResult;
}

export async function initializePromptStudioRuntime(): Promise<PromptStudioRuntimeAdapters> {
  if (!isTauri()) {
    const browser = initializeBrowserWorkspaceStorage();
    return {
      storageAdapter: browser.storageAdapter,
      outputAdapter: createBrowserOutputWorkspaceAdapter(),
      flushStorage: async () => undefined,
      migration: browser.migration,
    };
  }

  const nativeStorage = await TauriPromptWorkspaceStorage.open();
  const empty =
    (await nativeStorage.readSettings()) === null &&
    (await nativeStorage.readProfileLibrary()) === null &&
    (await nativeStorage.readDraft()) === null;
  const migration = empty
    ? await migrateBrowserWorkspaceWhenPresent(nativeStorage)
    : { status: "notNeeded" as const };
  const storageAdapter = await createNativeBackedV2StorageAdapter(nativeStorage);
  return {
    storageAdapter,
    outputAdapter: createNativeOutputWorkspaceAdapter(),
    flushStorage: () => storageAdapter.flush(),
    migration,
  };
}
