import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AreaClient } from "../../api/area-client";
import type { AreaCard, AreaDetails, HumanoidProfilePreview } from "../../domain/areas";
import type { Direction } from "../../domain/common";
import { AreaDashboard } from "./AreaDashboard";

const AREA_ID = "20000000-0000-4000-8000-000000000001";
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const PROFILE_ID = "30000000-0000-4000-8000-000000000001";
const DIRECTIONS: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const SLOT_IDS = [
  "torso_lower",
  "torso_upper",
  "head",
  "hair",
  "upper_arm_l",
  "forearm_l",
  "hand_l",
  "upper_arm_r",
  "forearm_r",
  "hand_r",
  "thigh_l",
  "shin_l",
  "foot_l",
  "thigh_r",
  "shin_r",
  "foot_r",
];

describe("area dashboard", () => {
  it("shows all generated slots and eight selectable directions", async () => {
    const client = mockClient();
    render(<AreaDashboard client={client} projectId={PROJECT_ID} sessionId="session-1" />);

    expect(await screen.findByRole("heading", { name: "80 px exact" })).toBeInTheDocument();
    expect(screen.getAllByTestId("profile-slot")).toHaveLength(16);
    expect(screen.getByText("16 slots")).toBeInTheDocument();
    expect(screen.getByText("8 views")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Preview direction" })).toHaveLength(8);

    fireEvent.change(screen.getByRole("combobox", { name: "Preview direction" }), {
      target: { value: "nw" },
    });
    expect(screen.getByRole("img", { name: "NW humanoid slot preview" })).toBeInTheDocument();
  });

  it("creates an NPC area with a humanoid profile request", async () => {
    const client = mockClient();
    render(<AreaDashboard client={client} projectId={PROJECT_ID} sessionId="session-1" />);
    const create = await screen.findByRole("button", { name: "Create area" });
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);

    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          project_id: PROJECT_ID,
          name: "NPCs",
          object_type: "humanoid",
          reference_height_px: 80,
          label_ids: [],
        }),
      ),
    );
  });

  it("publishes a new profile revision from an opened card", async () => {
    const details = areaDetails(80, 1);
    const card = areaCard(details);
    const client = mockClient([card]);
    vi.mocked(client.open).mockResolvedValue(details);
    vi.mocked(client.reviseProfile).mockResolvedValue(areaDetails(97, 2));
    render(<AreaDashboard client={client} projectId={PROJECT_ID} sessionId="session-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Open profile" }));
    await screen.findByText(/Selected: NPCs · profile r1/);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Reference height" }), {
      target: { value: "97" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish profile revision" }));

    await waitFor(() =>
      expect(client.reviseProfile).toHaveBeenCalledWith("session-1", {
        area_id: AREA_ID,
        expected_area_revision: 1,
        reference_height_px: 97,
        default_frame_size_px: null,
        default_ground_origin_px: null,
      }),
    );
  });

  it("keeps persistence disabled until the Projects phase supplies context", async () => {
    const client = mockClient();
    render(<AreaDashboard client={client} projectId={null} sessionId={null} />);

    expect(await screen.findByRole("heading", { name: "80 px exact" })).toBeInTheDocument();
    expect(screen.getByText(/Open a project from the Projects dashboard/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create area" })).toBeDisabled();
    expect(client.dashboard).not.toHaveBeenCalled();
  });
});

function mockClient(areas: AreaCard[] = []): AreaClient {
  const details = areaDetails(80, 1);
  return {
    preview: vi.fn(async (height: number) => profilePreview(height)),
    dashboard: vi.fn(async () => ({
      project_id: PROJECT_ID,
      areas,
      labels: [],
      writable: true,
    })),
    open: vi.fn(async () => details),
    create: vi.fn(async () => details),
    reviseProfile: vi.fn(async () => details),
  };
}

function profilePreview(height: number): HumanoidProfilePreview {
  const slots = SLOT_IDS.map((id, index) => ({
    id,
    parent_id: index === 0 ? null : "torso_lower",
    optional: id === "hair",
    size_px: [index === 2 ? 18 : 8, index === 2 ? 16 : 8] as const,
    pivot_px: [4, 4] as const,
    base_transform: { offset_px: [0, 0] as const, rotation_deg: 0 },
  }));
  return {
    preset_version: 1,
    reference_height_px: height,
    measured_height_px: height,
    suggested_frame_size_px: [128, 128],
    suggested_ground_origin_px: [64, 108],
    slots,
    views: DIRECTIONS.map((direction) => ({
      direction,
      layer_order: [...SLOT_IDS],
      base_transforms: SLOT_IDS.map((slot_id) => ({
        slot_id,
        transform: { offset_px: [0, 0], rotation_deg: 0 },
      })),
    })),
    mirror_pairs: [
      { left: "upper_arm_l", right: "upper_arm_r" },
      { left: "forearm_l", right: "forearm_r" },
      { left: "hand_l", right: "hand_r" },
      { left: "thigh_l", right: "thigh_r" },
      { left: "shin_l", right: "shin_r" },
      { left: "foot_l", right: "foot_r" },
    ],
    direction_previews: DIRECTIONS.map((direction) => ({
      direction,
      slots: SLOT_IDS.map((slot_id, layer) => ({
        slot_id,
        optional: slot_id === "hair",
        x: layer - 8,
        y: -height + layer,
        width: 8,
        height: 8,
        layer,
      })),
    })),
  };
}

function areaDetails(height: number, revision: number): AreaDetails {
  return {
    area: {
      schema_version: 1,
      kind: "area",
      id: AREA_ID,
      revision,
      project_id: PROJECT_ID,
      name: "NPCs",
      object_type: "humanoid",
      profile_ref: { id: PROFILE_ID, revision },
      reference_height_px: height,
      direction_model: "eight_way",
      directions: DIRECTIONS,
      default_frame_size_px: [128, 128],
      default_ground_origin_px: [64, 108],
      label_ids: [],
      created_at: "2026-09-05T11:05:00Z",
      updated_at: "2026-09-05T11:05:00Z",
    },
    profile: {
      schema_version: 1,
      kind: "profile_revision",
      profile_id: PROFILE_ID,
      revision,
      area_id: AREA_ID,
      name: `Humanoid NPC v1 · ${height}px`,
      reference_height_px: height,
      slots: profilePreview(height).slots,
      views: profilePreview(height).views,
      mirror_pairs: profilePreview(height).mirror_pairs,
      published_at: "2026-09-05T11:05:00Z",
    },
    preview: profilePreview(height),
    writable: true,
  };
}

function areaCard(details: AreaDetails): AreaCard {
  return {
    id: details.area.id,
    revision: details.area.revision,
    project_id: details.area.project_id,
    name: details.area.name,
    object_type: details.area.object_type,
    profile_ref: details.area.profile_ref,
    reference_height_px: details.area.reference_height_px,
    direction_model: details.area.direction_model,
    default_frame_size_px: details.area.default_frame_size_px,
    default_ground_origin_px: details.area.default_ground_origin_px,
    label_ids: details.area.label_ids,
    created_at: details.area.created_at,
    updated_at: details.area.updated_at,
  };
}
