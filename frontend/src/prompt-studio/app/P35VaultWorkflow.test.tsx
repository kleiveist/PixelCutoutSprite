import { useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveVaultProvider, type ActiveVault } from "../../shared/vault";
import { SaveQueue } from "../../shared/storage";
import {
  createVaultPromptFixture,
  storedProfile,
  VAULT_FIXTURE_TIME,
} from "../test/vaultPromptFixtures";
import {
  createV2StorageAdapter,
  generateVaultPromptSnapshot,
  type PromptVaultIndex,
  type StoredPromptGeneration,
  type VaultPromptRepository,
} from "../services";
import { MemoryStorage } from "../test/memoryStorage";
import { resolveStoredVaultProfile, VaultPromptProvider } from "../store/vault";
import type { PromptView } from "../domain/navigation";
import { PromptGeneratorRoot } from "./PromptGeneratorRoot";

const activeVault: ActiveVault = {
  session_id: "11111111-1111-4111-8111-111111111111",
  session_generation: 1,
  vault_id: "22222222-2222-4222-8222-222222222222",
  display_name: "Testvault",
  path: "/test-vault",
  mode: "read_write",
  indexed_objects: 0,
  notice: null,
  recovery: [],
  recovery_writable: false,
  lock_recovery: null,
};
const now = () => VAULT_FIXTURE_TIME;

function repository(initial: PromptVaultIndex) {
  let index = initial;
  const generations = new Map<string, StoredPromptGeneration>();
  const api: VaultPromptRepository = {
    scan: vi.fn(async () => index),
    flush: vi.fn(async () => undefined),
    readGeneration: vi.fn(async (id, hash) => {
      const snapshot = generations.get(id);
      if (!snapshot || snapshot.profile.sha256 !== hash) throw new Error("Generation nicht lesbar");
      return snapshot;
    }),
    revealPath: vi.fn(async () => undefined),
    saveDraft: vi.fn(async (value) => ({
      value,
      relativePath: `.PixelPrompt/.drafts/${value.draftId}.json`,
      sha256: "d".repeat(64),
      revision: value.revision,
    })),
    saveProfile: vi.fn(async (value) => {
      const stored = storedProfile(value);
      index = {
        ...index,
        profiles: [...index.profiles.filter((entry) => entry.value.id !== value.id), stored],
      };
      return stored;
    }),
    saveGeneration: vi.fn(async (profile, outputs) => {
      const stored = storedProfile(profile, "c".repeat(64));
      index = {
        ...index,
        profiles: [...index.profiles.filter((entry) => entry.value.id !== profile.id), stored],
      };
      generations.set(profile.id, { profile: stored, outputs, fresh: true, baseRevision: 1 });
      return [
        { relativePath: stored.relativePath, sha256: stored.sha256, revision: profile.revision },
      ];
    }),
    saveBaseProfile: vi.fn(),
    removeDraft: vi.fn(async () => undefined),
    applyMigration: vi.fn(async () => []),
  };
  return {
    api,
    generations,
    replace: (next: PromptVaultIndex) => {
      index = next;
    },
  };
}

function Harness({
  api,
  initialView = "dashboard",
}: {
  api: VaultPromptRepository;
  initialView?: PromptView;
}) {
  const [view, setView] = useState<PromptView>(initialView);
  const queue = useMemo(
    () => new SaveQueue(() => ({ sessionId: activeVault.session_id, generation: 1 })),
    [],
  );
  const factory = useMemo(() => () => api, [api]);
  const storage = useMemo(() => createV2StorageAdapter(new MemoryStorage()), []);
  return (
    <ActiveVaultProvider activeVault={activeVault} saveQueue={queue}>
      <VaultPromptProvider repositoryFactory={factory} now={now}>
        <main data-modal-background>
          <nav>
            {(["dashboard", "profiles", "wizard", "output"] as const).map((value) => (
              <button key={value} onClick={() => setView(value)}>
                {value}
              </button>
            ))}
          </nav>
          <PromptGeneratorRoot
            view={view}
            onNavigate={setView}
            storageAdapter={storage}
            onOpenBaseProfile={() => undefined}
            now={now}
            createDraftId={() => "draft_loaded"}
          />
        </main>
      </VaultPromptProvider>
    </ActiveVaultProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("P35 vault workflow", () => {
  it("counts profiles, keeps nine usable categories, searches subtypes and hydrates full answers after flushing", async () => {
    const index = createVaultPromptFixture();
    const second = {
      ...index.profiles[0]!.value,
      id: "profile_held",
      name: "Held",
      folderName: "Held",
      subtype: "hero",
    };
    const repo = repository({ ...index, profiles: [...index.profiles, storedProfile(second)] });
    const user = userEvent.setup();
    render(<Harness api={repo.api} />);
    const card = await screen.findByRole("button", { name: "Charakter / Figur: 2 Profile" });
    expect(
      within(screen.getByRole("list", { name: "Asset-Kategorien" })).getAllByRole("button"),
    ).toHaveLength(9);
    await user.click(screen.getByRole("button", { name: "Natur / Pflanze: 0 Profile" }));
    expect(screen.getByRole("button", { name: "Neues Asset in dieser Kategorie" })).toBeEnabled();
    await user.keyboard("{Escape}");
    await user.click(card);
    expect(screen.getByRole("heading", { name: "NPC" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Held" })).toBeVisible();
    await user.type(screen.getByRole("searchbox", { name: "Profile suchen" }), "Kleif");
    expect(screen.queryByRole("button", { name: "Held laden" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kleif laden" }));
    expect(await screen.findByRole("textbox", { name: /Rolle \/ Beruf/ })).toHaveValue(
      "Waldhüter mit unvollständiger Beschreibung",
    );
    expect(screen.getByRole("textbox", { name: /Name des Assets/ })).toHaveValue("Kleif");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(repo.api.flush).toHaveBeenCalled();
    expect(vi.mocked(repo.api.flush).mock.invocationCallOrder.at(-1)!).toBeLessThan(
      vi.mocked(repo.api.scan).mock.invocationCallOrder.at(-1)!,
    );
  });

  it("keeps the popup and current session when a changed profile cannot be loaded", async () => {
    const index = createVaultPromptFixture();
    const repo = repository(index);
    const user = userEvent.setup();
    render(<Harness api={repo.api} />);
    await user.click(await screen.findByRole("button", { name: "Charakter / Figur: 1 Profile" }));
    repo.replace({
      ...index,
      profiles: [],
      issues: [
        {
          code: "invalid_document",
          relativePath: index.profiles[0]!.relativePath,
          message: "Beschädigt",
        },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Kleif laden" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("beschädigt");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Deine Assets im Vault", hidden: true }),
    ).toBeInTheDocument();
    expect(repo.api.saveProfile).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("waits for pending generation before refreshing the dashboard", async () => {
    const repo = repository(createVaultPromptFixture());
    const user = userEvent.setup();
    render(<Harness api={repo.api} />);
    await screen.findByRole("button", { name: "Charakter / Figur: 1 Profile" });
    let release!: () => void;
    vi.mocked(repo.api.flush).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const count = vi.mocked(repo.api.scan).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    expect(repo.api.scan).toHaveBeenCalledTimes(count);
    await act(async () => release());
    await waitFor(() => expect(repo.api.scan).toHaveBeenCalledTimes(count + 1));
  });

  it("preserves edited wizard answers when a dashboard rescan fails", async () => {
    const repo = repository(createVaultPromptFixture());
    const user = userEvent.setup();
    render(<Harness api={repo.api} />);
    await user.click(await screen.findByRole("button", { name: "Charakter / Figur: 1 Profile" }));
    await user.click(screen.getByRole("button", { name: "Kleif laden" }));
    const name = await screen.findByRole("textbox", { name: /Name des Assets/ });
    await user.clear(name);
    await user.type(name, "Mein unverlorener Entwurf");
    await user.click(screen.getByRole("button", { name: "dashboard" }));
    vi.mocked(repo.api.scan).mockRejectedValueOnce(new Error("Scan vorübergehend fehlgeschlagen"));
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    await screen.findByText("Scan vorübergehend fehlgeschlagen");
    expect(screen.getByRole("button", { name: "Aktualisieren" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "wizard" }));
    expect(await screen.findByRole("textbox", { name: /Name des Assets/ })).toHaveValue(
      "Mein unverlorener Entwurf",
    );
  });

  it("displays all 16 committed outputs and reveals the selected MD or profile JSON without export actions", async () => {
    const index = createVaultPromptFixture();
    const profile = index.profiles[0]!.value;
    const resolved = resolveStoredVaultProfile(profile, index.baseProfile!.value)!;
    const generation = await generateVaultPromptSnapshot({
      profile,
      resolvedProfile: resolved,
      baseRevision: 1,
      now,
    });
    const stored = storedProfile(generation.profile);
    const repo = repository({ ...index, profiles: [stored] });
    repo.generations.set(profile.id, {
      ...generation,
      profile: stored,
      fresh: true,
      baseRevision: 1,
    });
    const user = userEvent.setup();
    render(<Harness api={repo.api} initialView="output" />);
    await screen.findByText("Gespeichert · Ausgaben aktuell");
    for (const file of generation.profile.outputs.files) {
      await user.selectOptions(screen.getByLabelText("Stil"), file.style);
      await user.selectOptions(screen.getByLabelText("Sprache"), file.language);
      await user.selectOptions(screen.getByLabelText("Ausgabeteil"), file.part);
      expect(screen.getByText(file.relativePath)).toBeVisible();
      expect(document.querySelector("pre")?.textContent).toBe(
        generation.outputs.find((output) => output.relativePath === file.relativePath)!.contents,
      );
      await user.click(screen.getByRole("button", { name: "MD im Dateimanager öffnen" }));
      expect(repo.api.revealPath).toHaveBeenLastCalledWith(file.relativePath);
    }
    await user.click(screen.getByRole("button", { name: "Profil-JSON im Dateimanager öffnen" }));
    expect(repo.api.revealPath).toHaveBeenLastCalledWith(stored.relativePath);
    expect(
      screen.queryByRole("button", {
        name: /kopieren|download|export|übergeben|handoff|einstellungen/i,
      }),
    ).not.toBeInTheDocument();
    index.baseProfile!.value.revision += 1;
    repo.replace({ ...index, profiles: [stored] });
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    await screen.findByText("Ausgaben veraltet · letzter gespeicherter Stand");
    expect(screen.queryByText("Gespeichert · Ausgaben aktuell")).not.toBeInTheDocument();
  });

  it("reports corrupt output and rejected reveal targets without a success message", async () => {
    const repo = repository(createVaultPromptFixture());
    render(<Harness api={repo.api} initialView="output" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Generation nicht lesbar");
    expect(screen.queryByText("Gespeichert · Ausgaben aktuell")).not.toBeInTheDocument();
    vi.mocked(repo.api.revealPath).mockRejectedValueOnce(new Error("Ziel nicht erlaubt"));
    fireEvent.click(screen.getByRole("button", { name: "Profil-JSON im Dateimanager öffnen" }));
    await screen.findByText("Ziel nicht erlaubt");
  });

  it("rechecks unchanged profile outputs on refresh and never reports scan failures as fresh", async () => {
    const index = createVaultPromptFixture();
    const profile = index.profiles[0]!.value;
    const generation = await generateVaultPromptSnapshot({
      profile,
      resolvedProfile: resolveStoredVaultProfile(profile, index.baseProfile!.value)!,
      baseRevision: 1,
      now,
    });
    const stored = storedProfile(generation.profile);
    const repo = repository({ ...index, profiles: [stored] });
    repo.generations.set(profile.id, {
      ...generation,
      profile: stored,
      fresh: true,
      baseRevision: 1,
    });
    const user = userEvent.setup();
    render(<Harness api={repo.api} initialView="output" />);
    await screen.findByText("Gespeichert · Ausgaben aktuell");
    vi.mocked(repo.api.readGeneration).mockRejectedValueOnce(new Error("MD-Prüfsumme abweichend"));
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    await screen.findByText("MD-Prüfsumme abweichend");
    expect(screen.queryByText("Gespeichert · Ausgaben aktuell")).not.toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    await screen.findByText("Gespeichert · Ausgaben aktuell");
    vi.mocked(repo.api.scan).mockRejectedValueOnce(new Error("Vault-Scan fehlgeschlagen"));
    await user.click(screen.getByRole("button", { name: "Aktualisieren" }));
    await screen.findByText("Vault-Scan fehlgeschlagen");
    expect(screen.queryByText("Gespeichert · Ausgaben aktuell")).not.toBeInTheDocument();
  });
});
