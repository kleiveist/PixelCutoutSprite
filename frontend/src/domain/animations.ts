import type { Direction, PixelPoint, PixelSize, RevisionRef, UUID, UtcTimestamp } from "./common";
import type {
  DirectionDefinition,
  LoopMode,
  MotionPresetKind,
  MotionSemantics,
  MotionTrack,
} from "./motion";
import type { ProfileRevision } from "./profile";

export type MotionCardStatus = "new" | "released" | "unpublished_changes" | "archived";
export type MotionStatusFilter = "any" | "draft" | "released" | "changes" | "archived";
export type MotionSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

export interface MotionDraft {
  schema_version: number;
  kind: "motion_draft";
  template_id: UUID;
  revision: number;
  released_from_draft_revision: number | null;
  profile_ref: RevisionRef;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  directions: DirectionDefinition[];
  tracks: MotionTrack[];
  semantics?: MotionSemantics | null;
  updated_at: UtcTimestamp;
}

export interface SaveMotionDraftRequest {
  template_id: UUID;
  expected_revision: number;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  directions: DirectionDefinition[];
  tracks: MotionTrack[];
  semantics?: MotionSemantics | null;
}

export interface MotionCard {
  id: UUID;
  revision: number;
  area_id: UUID;
  name: string;
  action_key: string;
  status: MotionCardStatus;
  label_ids: UUID[];
  profile_ref: RevisionRef;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  semantics?: MotionSemantics | null;
  direction_coverage: Direction[];
  released_revisions: number[];
  latest_release: number | null;
  updated_at: UtcTimestamp;
}

export interface MotionDashboardData {
  area_id: UUID;
  motions: MotionCard[];
  profiles: RevisionRef[];
  writable: boolean;
}

export interface MotionEditorData {
  template_name: string;
  draft: MotionDraft;
  profile: ProfileRevision;
  writable: boolean;
}

export interface DummyPreview {
  data_url: string;
  clipping: Array<{ slot_id: string; bounds_px: [number, number, number, number] }>;
}

export interface SampledDummyPreview extends DummyPreview {
  pose: EditablePoseDto;
  source_direction: Direction;
  mirror_parity: boolean;
  sample_index: number;
}

export interface MotionCardPreviewData {
  frame_urls: string[];
  sample_indices: number[];
  fps: number;
  direction: Direction;
  clipping_count: number;
}

export type EditablePoseDto = Record<
  string,
  {
    offsetX: number;
    offsetY: number;
    rotation: number;
    visible: boolean;
    locked: boolean;
    layerDelta?: number;
  }
>;

export interface CreateMotionRequest {
  area_id: UUID;
  name: string;
  action_key: string;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  frame_size_px: PixelSize | null;
  ground_origin_px: PixelPoint | null;
  label_ids: UUID[];
  preset_kind?: MotionPresetKind | null;
}

export type MotionOpenTarget =
  | { kind: "dummy_editor"; template_id: UUID }
  | {
      kind: "outfit_chooser";
      template_id: UUID;
      template_revision: number;
      compatible_character_ids: UUID[];
    }
  | { kind: "binding_editor"; template_id: UUID; binding_id: UUID; character_id: UUID };

export interface MotionFilters {
  search: string;
  direction: "any" | Direction;
  status: MotionStatusFilter;
  profile: "any" | string;
  sort: MotionSort;
}

export const emptyMotionFilters = (): MotionFilters => ({
  search: "",
  direction: "any",
  status: "any",
  profile: "any",
  sort: "updated_desc",
});

export function filterMotionCards(
  cards: readonly MotionCard[],
  filters: MotionFilters,
): MotionCard[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const result = cards.filter((card) => {
    const textMatches =
      search.length === 0 ||
      card.name.toLocaleLowerCase().includes(search) ||
      card.action_key.toLocaleLowerCase().includes(search);
    const directionMatches =
      filters.direction === "any" || card.direction_coverage.includes(filters.direction);
    const statusMatches =
      filters.status === "any" ||
      (filters.status === "draft" && card.status === "new") ||
      (filters.status === "changes" && card.status === "unpublished_changes") ||
      card.status === filters.status;
    const profileMatches = filters.profile === "any" || card.profile_ref.id === filters.profile;
    return textMatches && directionMatches && statusMatches && profileMatches;
  });
  result.sort((left, right) => {
    switch (filters.sort) {
      case "updated_asc":
        return left.updated_at.localeCompare(right.updated_at);
      case "name_asc":
        return left.name.localeCompare(right.name);
      case "name_desc":
        return right.name.localeCompare(left.name);
      default:
        return right.updated_at.localeCompare(left.updated_at);
    }
  });
  return result;
}
