import { useMemo, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveQueue } from "../../../shared/storage";
import { ActiveVaultProvider, type ActiveVault } from "../../../shared/vault";
import { ModalHost } from "../../../shared/dialogs";
import type { PromptVaultIndex, StoredVaultDocument, VaultPromptRepository } from "../../services";
import type { VaultBaseProfile } from "../../schemas";
import { VaultPromptProvider } from "../../store/vault";
import { VaultBaseProfileDialog } from "./VaultBaseProfileDialog";
import { VaultProfileView } from "./VaultProfileView";

const timestamp = "2026-09-09T12:00:00.000Z";
const hash = "a".repeat(64);

const activeVault: ActiveVault = {
  session_id: "11111111-1111-4111-8111-111111111111",
  session_generation: 7,
  vault_id: "22222222-2222-4222-8222-222222222222",
  path: "/vaults/Lichterhain",
  display_name: "Lichterhain",
  mode: "read_write",
  indexed_objects: 0,
  notice: null,
  recovery: [],
  recovery_writable: false,
  lock_recovery: null,
};

function stored(value: VaultBaseProfile): StoredVaultDocument<VaultBaseProfile> {
  return {
    relativePath: ".PixelPrompt/basisprofil.json",
    value,
    sha256: hash,
    revision: value.revision,
  };
}

function fakeRepository(initial: PromptVaultIndex) {
  let index = initial;
  const repository: VaultPromptRepository = {
    scan: vi.fn(async () => index),
    readGeneration: vi.fn(),
    revealPath: vi.fn(),
    saveBaseProfile: vi.fn(async (value, expectedSha256) => {
      if (index.baseProfile && expectedSha256 !== index.baseProfile.sha256)
        throw new Error("write conflict");
      const result = stored(value);
      index = { ...index, baseProfile: result };
      return result;
    }),
    saveDraft: vi.fn(async () => {
      throw new Error("not used");
    }),
    saveProfile: vi.fn(async () => {
      throw new Error("not used");
    }),
    saveGeneration: vi.fn(async () => []),
    removeDraft: vi.fn(async () => undefined),
    applyMigration: vi.fn(async () => []),
    flush: vi.fn(async () => undefined),
  };
  return repository;
}

function Harness({
  repository,
  vault = activeVault,
}: {
  repository: VaultPromptRepository;
  vault?: ActiveVault | null;
}) {
  const [open, setOpen] = useState(false);
  const queue = useMemo(
    () =>
      new SaveQueue(() =>
        vault ? { sessionId: vault.session_id, generation: vault.session_generation } : null,
      ),
    [vault?.session_generation, vault?.session_id],
  );
  return (
    <ActiveVaultProvider activeVault={vault} saveQueue={queue}>
      <VaultPromptProvider repositoryFactory={() => repository} now={() => timestamp}>
        <main data-modal-background>
          <VaultProfileView onOpenBaseProfile={() => setOpen(true)} />
        </main>
        <ModalHost>
          <VaultBaseProfileDialog
            open={open}
            onClose={() => setOpen(false)}
            now={() => timestamp}
            createId={() => "base-lichterhain"}
          />
        </ModalHost>
      </VaultPromptProvider>
    </ActiveVaultProvider>
  );
}

describe("Vault profile singleton UI", () => {
  it("shows the active vault and discards a cancelled dialog draft", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        repository={fakeRepository({ baseProfile: null, profiles: [], drafts: [], issues: [] })}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Lichterhain" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Basisprofil anlegen/ }));
    const dialog = screen.getByRole("dialog", { name: "Vault-Basisprofil anlegen" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Nicht speichern");
    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Basisprofil anlegen/ }));
    expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: "Name" })).toHaveValue(
      "Vault-Basisprofil",
    );
  });

  it("persists one stable base and renders its stored summary", async () => {
    const user = userEvent.setup();
    const repository = fakeRepository({ baseProfile: null, profiles: [], drafts: [], issues: [] });
    render(<Harness repository={repository} />);
    await user.click(await screen.findByRole("button", { name: /Basisprofil anlegen/ }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Weltbasis");
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Pixeldichte" }),
      "ultraHd",
    );
    const tile = within(dialog).getByRole("spinbutton", { name: "Tile-Größe (px)" });
    await user.clear(tile);
    await user.type(tile, "48");
    await user.click(within(dialog).getByRole("button", { name: "Basisprofil speichern" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const button = screen.getByRole("button", { name: /Weltbasis/ });
    expect(button).toHaveTextContent("Ultra HD");
    expect(button).toHaveTextContent("48 px Tile");
    expect(button).toHaveTextContent("REV 1");
    expect(repository.saveBaseProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "base-lichterhain", revision: 1 }),
      undefined,
    );

    await user.click(button);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Basisprofil speichern" }),
    );
    await waitFor(() => expect(repository.saveBaseProfile).toHaveBeenCalledTimes(2));
    expect(repository.saveBaseProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "base-lichterhain", revision: 2 }),
      hash,
    );
  });

  it("keeps invalid required values visible without publishing a base", async () => {
    const user = userEvent.setup();
    const repository = fakeRepository({
      baseProfile: null,
      profiles: [],
      drafts: [],
      issues: [],
    });
    render(<Harness repository={repository} />);
    await user.click(await screen.findByRole("button", { name: /Basisprofil anlegen/ }));
    const dialog = screen.getByRole("dialog", { name: "Vault-Basisprofil anlegen" });
    const tileSize = within(dialog).getByRole("spinbutton", { name: "Tile-Größe (px)" });
    await user.clear(tileSize);
    const form = tileSize.closest("form");
    if (!form) throw new Error("Expected the base profile form.");
    fireEvent.submit(form);

    expect(dialog).toBeInTheDocument();
    expect(tileSize).toHaveValue(null);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Nicht gespeichert");
    expect(repository.saveBaseProfile).not.toHaveBeenCalled();
  });

  it("keeps corrupt and read-only states fail-closed", async () => {
    const repository = fakeRepository({
      baseProfile: null,
      profiles: [],
      drafts: [],
      issues: [
        {
          code: "invalid_document",
          relativePath: ".PixelPrompt/basisprofil.json",
          message: "invalid JSON",
        },
      ],
    });
    const { rerender } = render(<Harness repository={repository} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Basisprofil ist beschädigt");
    rerender(
      <Harness
        repository={fakeRepository({ baseProfile: null, profiles: [], drafts: [], issues: [] })}
        vault={{ ...activeVault, mode: "read_only" }}
      />,
    );
    expect(await screen.findByRole("button", { name: /Basisprofil anlegen/ })).toBeDisabled();
    expect(screen.getByText("Vault ist schreibgeschützt")).toBeVisible();
  });
});
