import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveQueue, type SessionIdentity } from "../../shared/storage";
import { createVaultPromptFixture } from "../test/vaultPromptFixtures";
import { NativeVaultPromptRepository } from "./vaultPromptRepository";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
const session = { sessionId: "11111111-1111-4111-8111-111111111111", generation: 9 };
beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("native P35 vault adapter", () => {
  it("isolates malformed V3 profiles without losing readable entries", async () => {
    const index = createVaultPromptFixture();
    vi.mocked(invoke).mockResolvedValue({
      ...index,
      profiles: [
        ...index.profiles,
        {
          ...index.profiles[0],
          relativePath: ".PixelPrompt/Charakter/NPC/Bad/Bad-profile.json",
          value: { ...index.profiles[0]!.value, wizard: null },
        },
      ],
    });
    const api = new NativeVaultPromptRepository(session, new SaveQueue(() => session));
    const result = await api.scan();
    expect(result.profiles).toHaveLength(1);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_document" }));
    expect(invoke).toHaveBeenCalledWith("scan_prompt_vault", {
      sessionId: session.sessionId,
      sessionGeneration: 9,
    });
  });

  it("sends the value argument expected by the native profile writer", async () => {
    const stored = createVaultPromptFixture().profiles[0]!;
    vi.mocked(invoke).mockResolvedValue({
      relativePath: stored.relativePath,
      sha256: stored.sha256,
      revision: 1,
    });
    const api = new NativeVaultPromptRepository(session, new SaveQueue(() => session));
    await api.saveProfile(stored.value);
    expect(invoke).toHaveBeenCalledWith("save_prompt_vault_profile", {
      sessionId: session.sessionId,
      sessionGeneration: 9,
      value: stored.value,
      expectedSha256: null,
    });
  });

  it("discards scan results from a replaced vault session", async () => {
    let active: SessionIdentity = session;
    let resolve!: (value: unknown) => void;
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const api = new NativeVaultPromptRepository(session, new SaveQueue(() => active));
    const result = api.scan();
    active = { ...session, generation: 10 };
    resolve(createVaultPromptFixture());
    await expect(result).rejects.toThrow("no longer active");
  });

  it("reveals only relative targets with their captured session", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const api = new NativeVaultPromptRepository(session, new SaveQueue(() => session));
    const path = createVaultPromptFixture().profiles[0]!.relativePath;
    await api.revealPath(path);
    expect(invoke).toHaveBeenCalledWith("reveal_workspace_path", {
      sessionId: session.sessionId,
      sessionGeneration: 9,
      relativePath: path,
    });
    await expect(api.revealPath("../other-vault/private.json")).rejects.toThrow();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
