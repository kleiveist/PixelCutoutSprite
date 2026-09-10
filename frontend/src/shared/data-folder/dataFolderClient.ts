import { invoke, isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import type { SessionIdentity } from "../storage";

export const workspacePath = z
  .string()
  .max(1024)
  .refine(
    (path) =>
      path !== "" &&
      !path.startsWith("/") &&
      !/[\\<>:"|?*]/.test(path) &&
      !/\p{Cc}/u.test(path) &&
      path
        .split("/")
        .every(
          (part) =>
            part !== "" &&
            part !== "." &&
            part !== ".." &&
            part.length <= 160 &&
            !/[. ]$/.test(part) &&
            !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
        ),
    "Ungültiger relativer Vault-Pfad.",
  );
const directoryPath = z.union([z.literal(""), workspacePath]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const EntrySchema = z.strictObject({
  name: z.string().min(1).max(160),
  relativePath: workspacePath,
  kind: z.enum(["directory", "image", "unsupported"]),
  technical: z.boolean(),
  setCandidate: z.boolean(),
  fingerprint: hash,
});
export const PageSchema = z.strictObject({
  relativePath: directoryPath,
  entries: z.array(EntrySchema).max(100),
  nextCursor: z.string().max(512).nullable(),
  totalMatches: z.number().int().min(0).max(20_000),
  skippedEntries: z.number().int().min(0),
});
const SelectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("image"),
    relativePath: workspacePath,
    sha256: hash,
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
  }),
  z.strictObject({
    kind: z.literal("sprite_set"),
    relativePath: workspacePath,
    manifestPath: workspacePath,
    manifestSha256: hash,
    setId: z.string().min(3).max(128),
    generationId: z.string().min(3).max(128),
    complete: z.boolean(),
    partCount: z.number().int().min(1).max(18),
  }),
  z.strictObject({
    kind: z.literal("directory"),
    relativePath: workspacePath,
    status: z.enum(["ordinary", "in_progress", "invalid"]),
    message: z.string().nullable(),
  }),
  z.strictObject({
    kind: z.literal("legacy_set"),
    relativePath: workspacePath,
    documentSha256: hash,
    partCount: z.number().int().min(1).max(18),
  }),
]);
const ThumbnailSchema = z.strictObject({
  dataUrl: z
    .string()
    .max(100_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  sha256: hash,
});
export type WorkspaceEntry = z.infer<typeof EntrySchema>;
export type DirectoryPage = z.infer<typeof PageSchema>;
export type NativeSelection = z.infer<typeof SelectionSchema>;
export type DataFolderSelection = Exclude<NativeSelection, { kind: "directory" }> & {
  readonly session: SessionIdentity;
};
export type WorkspaceThumbnail = z.infer<typeof ThumbnailSchema>;
export interface DirectoryQuery {
  readonly relativePath: string;
  readonly search: string;
  readonly filter: "all" | "images" | "folders";
  readonly showTechnical: boolean;
  readonly limit: number;
  readonly cursor: string | null;
}
export interface DataFolderClient {
  list(session: SessionIdentity, query: DirectoryQuery): Promise<DirectoryPage>;
  inspect(session: SessionIdentity, entry: WorkspaceEntry): Promise<NativeSelection>;
  thumbnail(session: SessionIdentity, entry: WorkspaceEntry): Promise<WorkspaceThumbnail>;
}
function args(session: SessionIdentity) {
  if (!isTauri())
    throw new Error("Die Vault-Dateinavigation ist nur in der Desktop-App verfügbar.");
  return { sessionId: session.sessionId, sessionGeneration: session.generation };
}
export const nativeDataFolderClient: DataFolderClient = {
  async list(session, query) {
    directoryPath.parse(query.relativePath);
    const page = PageSchema.parse(
      await invoke("list_workspace_entries", { ...args(session), query }),
    );
    if (
      page.relativePath !== query.relativePath ||
      page.entries.some(
        (entry) =>
          entry.relativePath !==
          (query.relativePath ? `${query.relativePath}/${entry.name}` : entry.name),
      )
    ) {
      throw new Error("Das Listing gehört nicht zum angeforderten Ordner.");
    }
    return page;
  },
  async inspect(session, entry) {
    EntrySchema.parse(entry);
    const result = SelectionSchema.parse(
      await invoke("inspect_workspace_entry", {
        ...args(session),
        relativePath: entry.relativePath,
        expectedFingerprint: entry.fingerprint,
      }),
    );
    if (
      result.relativePath !== entry.relativePath ||
      (result.kind === "sprite_set" &&
        result.manifestPath !== `${entry.relativePath}/sprite.parts.json`)
    )
      throw new Error("Die Auswahl gehört zu einem anderen Ziel.");
    return result;
  },
  async thumbnail(session, entry) {
    EntrySchema.parse(entry);
    return ThumbnailSchema.parse(
      await invoke("read_workspace_thumbnail", {
        ...args(session),
        relativePath: entry.relativePath,
        expectedFingerprint: entry.fingerprint,
      }),
    );
  },
};

/** Bounded session-owned thumbnail queue. No global cache, URLs, or filesystem listeners. */
export class DataFolderSession {
  private disposed = false;
  private epoch = 0;
  private running = 0;
  private cache = new Map<string, Promise<WorkspaceThumbnail>>();
  private pending: { run: () => Promise<void>; reject: (error: Error) => void }[] = [];
  constructor(
    readonly identity: SessionIdentity,
    private client: DataFolderClient,
  ) {}
  private assertCurrent(epoch = this.epoch) {
    if (this.disposed || epoch !== this.epoch)
      throw new Error("Die Dateianfrage gehört zu einem veralteten Vault-Stand.");
  }
  async list(query: DirectoryQuery) {
    const epoch = this.epoch;
    this.assertCurrent(epoch);
    const result = await this.client.list(this.identity, query);
    this.assertCurrent(epoch);
    return result;
  }
  async inspect(entry: WorkspaceEntry) {
    const epoch = this.epoch;
    this.assertCurrent(epoch);
    const result = await this.client.inspect(this.identity, entry);
    this.assertCurrent(epoch);
    return result;
  }
  thumbnail(entry: WorkspaceEntry): Promise<WorkspaceThumbnail> {
    const key = `${entry.relativePath}:${entry.fingerprint}`;
    const existing = this.cache.get(key);
    if (existing) return existing;
    const epoch = this.epoch;
    if (this.disposed || this.pending.length >= 64)
      return Promise.reject(new Error("Vorschau-Warteschlange nicht verfügbar."));
    const promise = new Promise<WorkspaceThumbnail>((resolve, reject) => {
      this.pending.push({
        reject,
        run: async () => {
          try {
            this.assertCurrent(epoch);
            const image = await this.client.thumbnail(this.identity, entry);
            this.assertCurrent(epoch);
            resolve(image);
          } catch (error) {
            reject(error);
          }
        },
      });
    });
    this.cache.set(key, promise);
    if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value!);
    this.pump();
    return promise;
  }
  private pump() {
    while (!this.disposed && this.running < 2 && this.pending.length) {
      const task = this.pending.shift()!;
      this.running += 1;
      void task.run().finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }
  invalidate() {
    this.epoch += 1;
    this.cache.clear();
    for (const task of this.pending.splice(0))
      task.reject(new Error("Vorschau wurde verworfen; bitte neu auswählen."));
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
  }
}
