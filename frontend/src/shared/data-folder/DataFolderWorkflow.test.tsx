import { StrictMode, useMemo, useRef, useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveVaultProvider, type ActiveVault } from "../vault";
import { SaveQueue } from "../storage";
import {
  DataFolderProvider,
  DataFolderWorkspace,
  useDataFolder,
  type DataFolderClient,
  type DirectoryPage,
  type NativeSelection,
  type WorkspaceEntry,
} from ".";

const vault: ActiveVault = {
  session_id: "11111111-1111-4111-8111-111111111111",
  session_generation: 1,
  vault_id: "22222222-2222-4222-8222-222222222222",
  path: "/test-vault",
  display_name: "Testvault",
  mode: "read_write",
  indexed_objects: 0,
  notice: null,
  recovery: [],
  recovery_writable: false,
  lock_recovery: null,
};
const entry = (
  path: string,
  kind: WorkspaceEntry["kind"] = "image",
  extra = {},
): WorkspaceEntry => ({
  name: path.split("/").at(-1)!,
  relativePath: path,
  kind,
  technical: false,
  setCandidate: false,
  fingerprint: "a".repeat(64),
  ...extra,
});
function fixture() {
  const folders: Record<string, WorkspaceEntry[]> = {
    "": [
      entry("Images", "directory"),
      entry("Parts", "directory", { setCandidate: true }),
      entry("run.sh", "unsupported"),
      entry(".source", "directory", { technical: true }),
    ],
    Images: [entry("Images/hero.png")],
    Parts: [],
    ".source": [],
  };
  const selections: Record<string, NativeSelection> = {
    Images: { kind: "directory", relativePath: "Images", status: "ordinary", message: null },
    Parts: {
      kind: "sprite_set",
      relativePath: "Parts",
      manifestPath: "Parts/sprite.parts.json",
      manifestSha256: "b".repeat(64),
      setId: "set_test",
      generationId: "gen_test",
      complete: true,
      partCount: 15,
    },
  };
  const api: DataFolderClient = {
    list: vi.fn(async (_session, query) => {
      const matches = (folders[query.relativePath] ?? []).filter(
        (value) =>
          (query.showTechnical || !value.technical) &&
          value.name.toLowerCase().includes(query.search.toLowerCase()) &&
          (query.filter !== "folders" || value.kind === "directory") &&
          (query.filter !== "images" || value.kind !== "unsupported"),
      );
      const offset = Number(query.cursor ?? 0);
      const end = offset + query.limit;
      return {
        relativePath: query.relativePath,
        entries: matches.slice(offset, end),
        nextCursor: end < matches.length ? String(end) : null,
        totalMatches: matches.length,
        skippedEntries: 0,
      };
    }),
    inspect: vi.fn(
      async (_session, item) =>
        selections[item.relativePath] ?? {
          kind: "image",
          relativePath: item.relativePath,
          sha256: "b".repeat(64),
          width: 4,
          height: 4,
        },
    ),
    thumbnail: vi.fn(async () => ({
      dataUrl: "data:image/png;base64,AA==",
      sha256: "b".repeat(64),
    })),
  };
  return { api, folders, selections };
}
function Counter({ label }: { label: string }) {
  const [value, setValue] = useState(0);
  return (
    <button onClick={() => setValue((current) => current + 1)}>
      {label}: {value}
    </button>
  );
}
function Content() {
  const [module, setModule] = useState<"cutout" | "sprite">("cutout");
  const { selections } = useDataFolder();
  return (
    <div data-modal-background>
      <button onClick={() => setModule("cutout")}>Cutout-Modul</button>
      <button onClick={() => setModule("sprite")}>Sprite-Modul</button>
      <output aria-label="Auswahlereignis">{JSON.stringify(selections)}</output>
      {module === "cutout" ? (
        <DataFolderWorkspace module="cutout">
          <Counter label="Editorwert" />
        </DataFolderWorkspace>
      ) : (
        <DataFolderWorkspace module="sprite" viewSlot={{ content: <Counter label="Viewwert" /> }}>
          <Counter label="Editorwert" />
        </DataFolderWorkspace>
      )}
    </div>
  );
}
function Harness({
  api,
  active = vault,
  queue: suppliedQueue,
}: {
  api: DataFolderClient;
  active?: ActiveVault;
  queue?: SaveQueue;
}) {
  const current = useRef(active);
  current.current = active;
  const queue = useMemo(
    () =>
      suppliedQueue ??
      new SaveQueue(() => ({
        sessionId: current.current.session_id,
        generation: current.current.session_generation,
      })),
    [suppliedQueue],
  );
  return (
    <ActiveVaultProvider activeVault={active} saveQueue={queue}>
      <DataFolderProvider client={api}>
        <Content />
      </DataFolderProvider>
    </ActiveVaultProvider>
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("P36 shared data-folder workflow", () => {
  it("uses the same tree in both modules and emits complete session-bound image/set selections", async () => {
    const data = fixture();
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <StrictMode>
        <Harness api={data.api} />
      </StrictMode>,
    );
    const folder = await screen.findByRole("treeitem", { name: /Images/ });
    folder.focus();
    await user.keyboard("{ArrowRight}");
    const image = await screen.findByRole("treeitem", { name: /hero.png/ });
    await user.keyboard("{ArrowRight}");
    expect(image).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByLabelText("Auswahlereignis")).toHaveTextContent('"kind":"image"'),
    );
    expect(screen.getByLabelText("Auswahlereignis")).toHaveTextContent(vault.session_id);
    expect(data.api.inspect).toHaveBeenLastCalledWith(
      { sessionId: vault.session_id, generation: 1 },
      expect.objectContaining({ relativePath: "Images/hero.png" }),
    );
    await user.click(screen.getByRole("button", { name: "Sprite-Modul" }));
    await user.click(await screen.findByRole("treeitem", { name: /Parts/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Auswahlereignis")).toHaveTextContent('"kind":"sprite_set"'),
    );
    expect(screen.getByLabelText("Auswahlereignis")).toHaveTextContent("Images/hero.png");
    expect(document.querySelectorAll("[data-data-folder-toolbar]")).toHaveLength(1);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps editor and View-slot state across tabs and supports keyboard tab navigation", async () => {
    const data = fixture();
    const user = userEvent.setup();
    render(<Harness api={data.api} />);
    await user.click(screen.getByRole("button", { name: "Sprite-Modul" }));
    await user.click(screen.getByRole("button", { name: "Editorwert: 0" }));
    await user.click(screen.getByRole("tab", { name: "View" }));
    await user.click(screen.getByRole("button", { name: "Viewwert: 0" }));
    await user.click(screen.getByRole("tab", { name: "Dateien" }));
    expect(screen.queryByRole("button", { name: "Viewwert: 1" })).not.toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "View" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Viewwert: 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Editorwert: 1" })).toBeVisible();
  });

  it("pages large folders, filters locally, and refreshes external creation, rename and deletion", async () => {
    const data = fixture();
    data.folders[""] = Array.from({ length: 125 }, (_, i) => entry(`image-${i}.png`));
    const user = userEvent.setup();
    render(<Harness api={data.api} />);
    await screen.findByRole("treeitem", { name: /^image-0.png/ });
    expect(screen.getAllByRole("treeitem")).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Nächste Seite: Vault" }));
    await screen.findByRole("treeitem", { name: /^image-50.png/ });
    expect(screen.queryByRole("treeitem", { name: /^image-0.png/ })).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox");
    await user.type(search, "new");
    data.folders[""] = [entry("new.png")];
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    await screen.findByRole("treeitem", { name: /new.png/ });
    data.folders[""] = [entry("new-name.png")];
    await user.click(screen.getByRole("button", { name: "Dateien aktualisieren" }));
    await screen.findByRole("treeitem", { name: /new-name.png/ });
    expect(screen.queryByRole("treeitem", { name: /new.png/ })).not.toBeInTheDocument();
    data.folders[""] = [];
    await user.click(screen.getByRole("button", { name: "Dateien aktualisieren" }));
    await screen.findByText("Keine passenden Dateien.");
  });

  it("does not emit unsupported, technical or half-published sets and preserves the previous selection", async () => {
    const data = fixture();
    const user = userEvent.setup();
    render(<Harness api={data.api} />);
    await user.click(await screen.findByRole("treeitem", { name: /Parts/ }));
    await screen.findByText(/Teile-Set geprüft/);
    const previous = screen.getByLabelText("Auswahlereignis").textContent;
    await user.click(screen.getByRole("treeitem", { name: /run.sh/ }));
    expect(data.api.inspect).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("checkbox", { name: "Technische Ordner anzeigen" }));
    await user.click(await screen.findByRole("treeitem", { name: /.source/ }));
    expect(data.api.inspect).toHaveBeenCalledTimes(1);
    data.selections.Parts = {
      kind: "directory",
      relativePath: "Parts",
      status: "in_progress",
      message: "Teile-Set noch in Arbeit",
    };
    await user.click(screen.getByRole("treeitem", { name: /Parts/ }));
    await screen.findByText("Teile-Set noch in Arbeit");
    expect(screen.getByLabelText("Auswahlereignis").textContent).toBe(previous);
  });

  it("waits for flush, discards late listing responses on vault switch, and releases listeners", async () => {
    const data = fixture();
    const user = userEvent.setup();
    const remove = vi.spyOn(window, "removeEventListener");
    let finish!: () => void;
    const queue = new SaveQueue(() => ({ sessionId: vault.session_id, generation: 1 }));
    const flush = vi.spyOn(queue, "flush").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const result = render(<Harness api={data.api} queue={queue} />);
    await user.click(await screen.findByRole("treeitem", { name: /Parts/ }));
    expect(flush).toHaveBeenCalled();
    expect(data.api.inspect).not.toHaveBeenCalled();
    await act(async () => finish());
    await screen.findByText(/Teile-Set geprüft/);
    let resolveList!: (page: DirectoryPage) => void;
    vi.mocked(data.api.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    await user.click(screen.getByRole("button", { name: "Dateien aktualisieren" }));
    result.rerender(
      <Harness
        api={data.api}
        active={{
          ...vault,
          session_id: "33333333-3333-4333-8333-333333333333",
          session_generation: 2,
        }}
      />,
    );
    await act(async () =>
      resolveList({
        relativePath: "",
        entries: [entry("old-vault.png")],
        totalMatches: 1,
        nextCursor: null,
        skippedEntries: 0,
      }),
    );
    expect(screen.queryByRole("treeitem", { name: /old-vault/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Auswahlereignis")).not.toHaveTextContent("set_test");
    result.unmount();
    expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));
  });

  it("refreshes on window focus and preserves the previous tree when flushing fails", async () => {
    const data = fixture();
    const user = userEvent.setup();
    const queue = new SaveQueue(() => ({ sessionId: vault.session_id, generation: 1 }));
    const flush = vi.spyOn(queue, "flush");
    render(<Harness api={data.api} queue={queue} />);
    await screen.findByRole("treeitem", { name: /Images/ });
    data.folders[""] = [entry("external.png")];
    act(() => window.dispatchEvent(new Event("focus")));
    await screen.findByRole("treeitem", { name: /external.png/ });
    expect(flush).toHaveBeenCalled();
    data.folders[""] = [entry("after-failure.png")];
    const previousCalls = vi.mocked(data.api.list).mock.calls.length;
    flush.mockRejectedValueOnce(new Error("Speichern fehlgeschlagen"));
    await user.click(screen.getByRole("button", { name: "Dateien aktualisieren" }));
    await screen.findByText("Speichern fehlgeschlagen");
    expect(data.api.list).toHaveBeenCalledTimes(previousCalls);
    expect(screen.getByRole("treeitem", { name: /external.png/ })).toBeVisible();
    expect(screen.queryByRole("treeitem", { name: /after-failure/ })).not.toBeInTheDocument();
  });

  it("bounds collapsed folder caches even when every child listing fails", async () => {
    const data = fixture();
    const user = userEvent.setup();
    data.folders[""] = Array.from({ length: 25 }, (_, i) => entry(`Folder-${i}`, "directory"));
    const list = data.api.list;
    vi.mocked(data.api.list).mockImplementation(async (_session, query) => {
      if (query.relativePath) throw new Error("Ordner nicht lesbar");
      return {
        relativePath: "",
        entries: data.folders[""],
        nextCursor: null,
        totalMatches: 25,
        skippedEntries: 0,
      };
    });
    render(<Harness api={data.api} />);
    for (let i = 0; i < 25; i++) {
      const folder = await screen.findByRole("treeitem", {
        name: new RegExp(`^Folder-${i}\\s*Ordner$`),
      });
      folder.focus();
      await user.keyboard("{ArrowRight}");
      await screen.findByText("Ordner nicht lesbar");
      await user.keyboard("{ArrowLeft}");
    }
    const first = screen.getByRole("treeitem", { name: /^Folder-0\s*Ordner$/ });
    first.focus();
    await user.keyboard("{ArrowRight}");
    await screen.findByText("Ordner nicht lesbar");
    expect(
      vi.mocked(list).mock.calls.filter(([, query]) => query.relativePath === "Folder-0"),
    ).toHaveLength(2);
  });

  it("uses a dismissible narrow drawer and restores focus without losing editor state", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<Harness api={fixture().api} />);
    await user.click(screen.getByRole("button", { name: "Editorwert: 0" }));
    const trigger = screen.getByRole("button", { name: "Dateien öffnen" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Vault-Dateien" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("button", { name: "Editorwert: 1" })).toBeVisible();
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Dateinavigation schließen" }),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
