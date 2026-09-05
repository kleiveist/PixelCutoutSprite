import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ExportCancelledError,
  type NpcExportInspection,
  type StartNpcExportRequest,
} from "../../api/export-client";
import { ExportDialog } from "./ExportDialog";
import { DEFAULT_EXPORT_PROFILE, type ExportProfile } from "./export-model";

const characters = [
  { id: "character-1", name: "Village merchant" },
  { id: "character-2", name: "Gate keeper" },
];

const inspection: NpcExportInspection = {
  character_id: "character-1",
  bindings: [
    {
      binding_id: "binding-walk",
      action_key: "walk",
      frame_count: 12,
      fps: 8,
      loop_mode: "loop",
      frame_size_px: [128, 128],
      ground_origin_px: [64, 108],
      covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
      missing_directions: [],
      reviewed: true,
      ready: true,
      issue: null,
    },
    {
      binding_id: "binding-jump",
      action_key: "jump",
      frame_count: 8,
      fps: 12,
      loop_mode: "once",
      frame_size_px: [128, 128],
      ground_origin_px: [64, 108],
      covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
      missing_directions: [],
      reviewed: true,
      ready: true,
      issue: null,
    },
  ],
  missing_required_actions: [],
  common_frame_size_px: [128, 128],
  common_ground_origin_px: [64, 108],
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof ExportDialog>> = {}) {
  return render(
    <ExportDialog
      characters={characters}
      inspection={inspection}
      initialCharacterId="character-1"
      onCharacterChange={vi.fn()}
      onStart={vi.fn().mockResolvedValue({
        build: "build-abc",
        source_fingerprint: "abc",
        complete: true,
        reused_existing_build: false,
        format: "png_json",
        godot_package: null,
      })}
      onSaveProfile={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ExportDialog", () => {
  it("preselects stable NPC/binding IDs and uses native structured controls", () => {
    renderDialog({ initialBindingId: "binding-jump" });

    expect(screen.getByRole("combobox", { name: "NPC" })).toHaveValue("character-1");
    expect(screen.getByRole("combobox", { name: "Animation assignment" })).toHaveValue(
      "binding-jump",
    );
    for (const name of [
      "Saved profile",
      "Format",
      "Maximum page size",
      "Padding",
      "Clipping",
      "Jump height",
      "Root motion",
      "Page limit",
      "Memory limit",
    ])
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Directions" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Format" })).toBeEnabled();
    expect(
      screen.queryByRole("checkbox", { name: "Include AnimatedSprite2D scene" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/128 × 128 px · ground 64, 108/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "NPC" })).toHaveFocus();
  });

  it("requires an explicit marked test for a direction subset", () => {
    const initialProfile: ExportProfile = {
      ...DEFAULT_EXPORT_PROFILE,
      directions: ["s"],
      allowIncompleteTest: false,
    };
    renderDialog({ initialProfile });

    expect(screen.getByText(/direction subset requires/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Allow marked incomplete test export" }));
    expect(screen.queryByText(/direction subset requires/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "godot_package" },
    });
    expect(screen.getByText(/Godot packages require all eight directions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("never lets generic incomplete-test policy bypass Godot source completeness", () => {
    const incompleteInspection: NpcExportInspection = {
      ...inspection,
      bindings: inspection.bindings.map((binding, index) =>
        index === 0
          ? {
              ...binding,
              ready: false,
              issue: "a pinned appearance source is missing",
            }
          : binding,
      ),
    };
    renderDialog({
      inspection: incompleteInspection,
      initialProfile: {
        ...DEFAULT_EXPORT_PROFILE,
        format: "godot_package",
        allowIncompleteTest: true,
      },
    });

    expect(screen.getByText(/pinned appearance source is missing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "png_json" },
    });
    expect(screen.queryByText(/pinned appearance source is missing/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  it("submits only stable IDs/profile policy and waits for native cancellation", async () => {
    let captured: StartNpcExportRequest | undefined;
    const onStart = vi.fn(
      (
        request: StartNpcExportRequest,
        signal: AbortSignal,
        report: (value: {
          stage: "rendering";
          completed: number;
          total: number;
          message: string;
        }) => void,
      ) => {
        captured = request;
        report({
          stage: "rendering",
          completed: 2,
          total: 160,
          message: "Rendered frame 2 of 160",
        });
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            window.setTimeout(
              () =>
                reject(
                  new ExportCancelledError(
                    "Godot packaging cancelled; previous generic current and previous Godot package unchanged. Validated orphan artifacts may remain.",
                  ),
                ),
              0,
            );
          });
        });
      },
    );
    renderDialog({ onStart });

    fireEvent.change(screen.getByRole("combobox", { name: "Padding" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "godot_package" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include AnimatedSprite2D scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Rendered frame 2 of 160")).toBeInTheDocument();
    expect(captured).toMatchObject({
      character_id: "character-1",
      binding_ids: ["binding-walk", "binding-jump"],
      format: "godot_package",
      include_godot_scene: false,
      root_motion_mode: "baked",
      jump_mode: "external",
      profile: { padding_px: 2, individual_frames: false },
    });
    expect(captured).not.toHaveProperty("destinationToken");

    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /previous generic current and previous Godot package unchanged\. Validated orphan artifacts may remain/i,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Export" })).toBeEnabled());
  });

  it("clears a completed result when the source or profile changes", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText(/Build build-abc validated/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Animation assignment" }), {
      target: { value: "binding-walk" },
    });
    expect(screen.queryByText(/build-abc/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText(/Build build-abc validated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Individual PNG frames" }));
    expect(screen.queryByText(/build-abc/i)).not.toBeInTheDocument();
  });

  it("presents the managed Godot package and optional scene returned by native export", async () => {
    renderDialog({
      onStart: vi.fn().mockResolvedValue({
        build: "build-abc",
        source_fingerprint: "abc",
        complete: true,
        reused_existing_build: true,
        format: "godot_package",
        godot_package: {
          package_directory: "village/merchant/_exports/godot/package-abc-scene",
          animation_names: ["jump_s", "walk_s"],
          scene: "character.tscn",
          reused_existing_package: false,
        },
      }),
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "godot_package" },
    });
    expect(screen.getByRole("checkbox", { name: "Include AnimatedSprite2D scene" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    const packagePath = await screen.findByText(
      "village/merchant/_exports/godot/package-abc-scene",
    );
    const result = packagePath.closest('[role="status"]');
    expect(result).not.toBeNull();
    expect(result).toHaveTextContent("sprite_frames.tres");
    expect(result).toHaveTextContent("character.tscn");
  });

  it("blocks every managed write in read-only mode", () => {
    const onSaveProfile = vi.fn();
    renderDialog({ readOnly: true, onSaveProfile });

    expect(screen.getByText(/managed exports require its writer session/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    expect(onSaveProfile).not.toHaveBeenCalled();
  });

  it("can save a valid reusable profile even while source inspection is unavailable", () => {
    const onSaveProfile = vi.fn();
    renderDialog({ inspection: null, onSaveProfile });
    fireEvent.change(screen.getByRole("textbox", { name: "Profile name" }), {
      target: { value: "Compact sheets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Compact sheets", directions: expect.any(Array) }),
    );
  });

  it("aborts the native run when the dialog unmounts", async () => {
    let signal: AbortSignal | undefined;
    const onStart = vi.fn(
      (_request: StartNpcExportRequest, nextSignal: AbortSignal) =>
        new Promise<never>(() => {
          signal = nextSignal;
        }),
    );
    const view = renderDialog({ onStart });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
