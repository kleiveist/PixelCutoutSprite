import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  DataFolderSession,
  nativeDataFolderClient,
  workspacePath,
  type DataFolderClient,
  type DirectoryQuery,
  type WorkspaceEntry,
  type WorkspaceThumbnail,
} from "./dataFolderClient";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }));
const session = { sessionId: "session-one", generation: 7 };
const item: WorkspaceEntry = {
  name: "image.png",
  relativePath: "Pictures/image.png",
  kind: "image",
  technical: false,
  setCandidate: false,
  fingerprint: "a".repeat(64),
};
const query: DirectoryQuery = {
  relativePath: "Pictures",
  filter: "images",
  showTechnical: false,
  search: "",
  limit: 50,
  cursor: null,
};
const thumbnail: WorkspaceThumbnail = {
  dataUrl: "data:image/png;base64,AA==",
  sha256: "b".repeat(64),
};
const page = {
  relativePath: "Pictures",
  entries: [item],
  totalMatches: 1,
  skippedEntries: 0,
  nextCursor: null,
};
beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(isTauri).mockReturnValue(true);
});

describe("native data-folder contract", () => {
  it("binds listing, image inspection and thumbnails to a captured session and relative target", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(page);
    await expect(nativeDataFolderClient.list(session, query)).resolves.toEqual(page);
    expect(invoke).toHaveBeenLastCalledWith("list_workspace_entries", {
      sessionId: "session-one",
      sessionGeneration: 7,
      query,
    });
    vi.mocked(invoke).mockResolvedValueOnce({
      kind: "image",
      relativePath: item.relativePath,
      sha256: "a".repeat(64),
      width: 4,
      height: 4,
    });
    await nativeDataFolderClient.inspect(session, item);
    expect(invoke).toHaveBeenLastCalledWith("inspect_workspace_entry", {
      sessionId: "session-one",
      sessionGeneration: 7,
      relativePath: item.relativePath,
      expectedFingerprint: item.fingerprint,
    });
    vi.mocked(invoke).mockResolvedValueOnce(thumbnail);
    await expect(nativeDataFolderClient.thumbnail(session, item)).resolves.toEqual(thumbnail);
  });
  it("rejects escaping paths, foreign listings, wrong selections and non-PNG thumbnail responses", async () => {
    for (const path of [
      "/etc/passwd",
      "../private",
      "C:/private",
      "Pictures/CON.png",
      "Pictures//a.png",
      "Pictures/./a.png",
      "a\0b",
    ])
      expect(workspacePath.safeParse(path).success).toBe(false);
    vi.mocked(invoke).mockResolvedValueOnce({ ...page, relativePath: "other" });
    await expect(nativeDataFolderClient.list(session, query)).rejects.toThrow(
      "angeforderten Ordner",
    );
    vi.mocked(invoke).mockResolvedValueOnce({
      kind: "image",
      relativePath: "other.png",
      sha256: "a".repeat(64),
      width: 1,
      height: 1,
    });
    await expect(nativeDataFolderClient.inspect(session, item)).rejects.toThrow("anderen Ziel");
    vi.mocked(invoke).mockResolvedValueOnce({
      ...thumbnail,
      dataUrl: "https://untrusted/image.png",
    });
    await expect(nativeDataFolderClient.thumbnail(session, item)).rejects.toThrow();
  });
});

describe("session-owned read/thumbnail lifecycle", () => {
  function client(): DataFolderClient {
    return {
      list: vi.fn(async () => page),
      inspect: vi.fn<DataFolderClient["inspect"]>(async () => ({
        kind: "directory",
        relativePath: "folder",
        status: "ordinary",
        message: null,
      })),
      thumbnail: vi.fn(async () => thumbnail),
    };
  }
  it("discards listing and inspection replies after disposal or explicit refresh", async () => {
    const api = client();
    const repository = new DataFolderSession(session, api);
    let release!: (value: typeof page) => void;
    vi.mocked(api.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const result = repository.list(query);
    const rejected = expect(result).rejects.toThrow("veralteten Vault");
    repository.dispose();
    release(page);
    await rejected;
    expect(api.list).toHaveBeenCalledOnce();
    await expect(repository.list(query)).rejects.toThrow("veralteten Vault");
    const current = new DataFolderSession(session, api);
    const selection = current.inspect(item);
    current.invalidate();
    await expect(selection).rejects.toThrow("veralteten Vault");
  });
  it("limits thumbnail concurrency to two, reuses cached entries and releases queued work on disposal", async () => {
    const api = client();
    const releases: ((image: WorkspaceThumbnail) => void)[] = [];
    vi.mocked(api.thumbnail).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    );
    const repository = new DataFolderSession(session, api);
    const requests = Array.from({ length: 6 }, (_, i) =>
      repository.thumbnail({ ...item, relativePath: `image-${i}.png` }),
    );
    const settled = Promise.allSettled(requests);
    expect(api.thumbnail).toHaveBeenCalledTimes(2);
    expect(repository.thumbnail({ ...item, relativePath: "image-0.png" })).toBe(requests[0]);
    repository.dispose();
    for (const release of releases) release(thumbnail);
    expect((await settled).every((result) => result.status === "rejected")).toBe(true);
    expect(api.thumbnail).toHaveBeenCalledTimes(2);
  });
  it("keeps at most 32 thumbnails and refresh invalidates retained previews", async () => {
    const api = client();
    const repository = new DataFolderSession(session, api);
    for (let i = 0; i < 34; i++)
      await repository.thumbnail({ ...item, relativePath: `image-${i}.png` });
    await repository.thumbnail({ ...item, relativePath: "image-0.png" });
    expect(api.thumbnail).toHaveBeenCalledTimes(35);
    repository.invalidate();
    await repository.thumbnail({ ...item, relativePath: "image-0.png" });
    expect(api.thumbnail).toHaveBeenCalledTimes(36);
    repository.dispose();
  });
});
