use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use image::{Rgba, RgbaImage};
use pixel_cutout_sprite_studio_lib::application::{
    AppearanceService, AppearanceServiceError, BindingService, OutfitDraftEdits, OutfitTarget,
    SaveNpcRequest, SavedNpc,
};
use pixel_cutout_sprite_studio_lib::asset_io::{
    AssetPackage, AssetRepository, PackageEntry, PngImporter, ASSET_PACKAGE_FORMAT,
};
use pixel_cutout_sprite_studio_lib::domain::*;
use pixel_cutout_sprite_studio_lib::storage::{
    object_folder, JsonStore, TransactionAction, VaultRoot,
};
use sha2::{Digest, Sha256};
use tempfile::TempDir;

const AREA_PATH: &str = "game/npcs";

struct OutfitFixture {
    _directory: TempDir,
    root: VaultRoot,
    area_id: ObjectId,
    label_id: ObjectId,
    profile_ref: RevisionRef,
    template_ref: RevisionRef,
    assets: Vec<(Direction, SlotRef)>,
}

impl OutfitFixture {
    fn new() -> Self {
        let directory = TempDir::new().unwrap();
        fs::create_dir_all(directory.path().join(AREA_PATH).join(".area")).unwrap();
        let root = VaultRoot::open(directory.path()).unwrap();
        let area_id = ObjectId::new();
        let project_id = ObjectId::new();
        let label_id = ObjectId::new();
        let profile_id = ObjectId::new();
        let template_id = ObjectId::new();
        let profile_ref = RevisionRef {
            id: profile_id,
            revision: 1,
        };
        let template_ref = RevisionRef {
            id: template_id,
            revision: 1,
        };
        let timestamp = timestamp();
        let hand = SlotId::parse("hand_l").unwrap();
        write_document(
            &root,
            Path::new("game/.project/project.json").to_path_buf(),
            DomainDocument::Project(Project {
                schema_version: SCHEMA_VERSION,
                kind: DocumentKind::Project,
                id: project_id,
                revision: 1,
                name: "Game".to_owned(),
                status: RecordStatus::Active,
                workspace_label_ids: Vec::new(),
                created_at: timestamp,
                updated_at: timestamp,
            }),
        );
        seed_workflow(
            &root,
            area_document(area_id, project_id, profile_ref, timestamp),
            profile_document(profile_id, area_id, hand.clone(), timestamp),
            template_document(template_id, area_id, timestamp),
            motion_document(template_id, profile_ref, timestamp),
        );
        write_document(
            &root,
            Path::new("game/.project/labels/villagers.json").to_path_buf(),
            DomainDocument::Label(label_document(label_id, project_id, timestamp)),
        );
        let assets = seed_assets(&root, area_id, profile_ref, &hand, timestamp);
        Self {
            _directory: directory,
            root,
            area_id,
            label_id,
            profile_ref,
            template_ref,
            assets,
        }
    }

    fn start_and_assign(&self) -> pixel_cutout_sprite_studio_lib::application::OutfitEditorContext {
        let draft = AppearanceService
            .start_draft(
                &self.root,
                Path::new(AREA_PATH),
                self.template_ref,
                OutfitTarget::NewNpc,
            )
            .unwrap();
        AppearanceService
            .auto_assign(
                &self.root,
                Path::new(AREA_PATH),
                draft.draft.id,
                draft.draft.revision,
                self.assets.iter().map(|(_, asset)| asset.clone()).collect(),
            )
            .unwrap()
    }

    fn save_npc(&self, name: &str) -> SavedNpc {
        let assigned = self.start_and_assign();
        AppearanceService
            .save_as_npc(
                &self.root,
                Path::new(AREA_PATH),
                assigned.draft.id,
                assigned.draft.revision,
                SaveNpcRequest {
                    name: name.to_owned(),
                    description: String::new(),
                    label_ids: Vec::new(),
                },
            )
            .unwrap()
    }

    fn start_existing(
        &self,
        character_id: ObjectId,
    ) -> pixel_cutout_sprite_studio_lib::application::OutfitEditorContext {
        AppearanceService
            .start_draft(
                &self.root,
                Path::new(AREA_PATH),
                self.template_ref,
                OutfitTarget::ExistingNpc { character_id },
            )
            .unwrap()
    }
}

fn seed_workflow(
    root: &VaultRoot,
    area: Area,
    profile: ProfileRevision,
    template: MotionTemplate,
    motion: MotionRevision,
) {
    let documents = [
        (".area/area.json", DomainDocument::Area(area)),
        (
            ".area/profiles/humanoid/r0001.json",
            DomainDocument::ProfileRevision(profile),
        ),
        (
            ".area/templates/walk/template.json",
            DomainDocument::MotionTemplate(template),
        ),
        (
            ".area/templates/walk/revisions/r0001.json",
            DomainDocument::MotionRevision(motion),
        ),
    ];
    for (path, document) in documents {
        write_document(root, Path::new(AREA_PATH).join(path), document);
    }
}

fn area_document(
    area_id: ObjectId,
    project_id: ObjectId,
    profile_ref: RevisionRef,
    timestamp: UtcTimestamp,
) -> Area {
    Area {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Area,
        id: area_id,
        revision: 1,
        project_id,
        name: "NPCs".to_owned(),
        object_type: ObjectType::Humanoid,
        profile_ref,
        reference_height_px: 80,
        direction_model: DirectionModel::EightWay,
        directions: Direction::ALL.to_vec(),
        default_frame_size_px: PixelSize(6, 6),
        default_ground_origin_px: PixelPoint(2, 2),
        label_ids: Vec::new(),
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn label_document(label_id: ObjectId, project_id: ObjectId, timestamp: UtcTimestamp) -> Label {
    Label {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Label,
        id: label_id,
        revision: 1,
        scope: LabelScope::Project,
        project_id: Some(project_id),
        name: "Villagers".to_owned(),
        color: "#ffcc66".to_owned(),
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn profile_document(
    profile_id: ObjectId,
    area_id: ObjectId,
    hand: SlotId,
    timestamp: UtcTimestamp,
) -> ProfileRevision {
    let torso_upper = SlotId::parse("torso_upper").unwrap();
    let torso_lower = SlotId::parse("torso_lower").unwrap();
    let head = SlotId::parse("head").unwrap();
    let views = Direction::ALL
        .into_iter()
        .map(|direction| DirectionView {
            direction,
            layer_order: vec![
                head.clone(),
                torso_upper.clone(),
                torso_lower.clone(),
                hand.clone(),
            ],
            base_transforms: test_view_transforms(
                direction,
                &hand,
                &torso_upper,
                &torso_lower,
                &head,
            ),
        })
        .collect();
    ProfileRevision {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::ProfileRevision,
        profile_id,
        revision: 1,
        area_id,
        name: "Humanoid 80 px".to_owned(),
        reference_height_px: 80,
        slots: vec![
            test_slot(hand, false),
            test_slot(torso_upper, true),
            test_slot(torso_lower, true),
            test_slot(head, true),
        ],
        views,
        mirror_pairs: Vec::new(),
        published_at: timestamp,
    }
}

fn test_slot(id: SlotId, optional: bool) -> SlotDefinition {
    SlotDefinition {
        id,
        parent_id: None,
        optional,
        size_px: PixelSize(1, 1),
        pivot_px: PixelPoint(0, 0),
        base_transform: transform(0, 0, 0.0),
    }
}

fn test_view_transforms(
    direction: Direction,
    hand: &SlotId,
    torso_upper: &SlotId,
    torso_lower: &SlotId,
    head: &SlotId,
) -> Vec<ViewTransform> {
    [
        (hand, 0, if direction == Direction::S { 90.0 } else { 0.0 }),
        (torso_upper, 1, 0.0),
        (torso_lower, 2, 0.0),
        (head, -1, 0.0),
    ]
    .into_iter()
    .map(|(slot, y, rotation)| ViewTransform {
        slot_id: slot.clone(),
        transform: transform(0, y, rotation),
    })
    .collect()
}

fn template_document(
    template_id: ObjectId,
    area_id: ObjectId,
    timestamp: UtcTimestamp,
) -> MotionTemplate {
    MotionTemplate {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::MotionTemplate,
        id: template_id,
        revision: 2,
        area_id,
        name: "Walk".to_owned(),
        action_key: ActionKey::parse("walk").unwrap(),
        status: TemplateStatus::Active,
        label_ids: Vec::new(),
        draft_revision: 2,
        draft_base_release: Some(1),
        released_revisions: vec![1],
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn motion_document(
    template_id: ObjectId,
    profile_ref: RevisionRef,
    timestamp: UtcTimestamp,
) -> MotionRevision {
    MotionRevision {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::MotionRevision,
        template_id,
        revision: 1,
        profile_ref,
        frame_size_px: PixelSize(6, 6),
        ground_origin_px: PixelPoint(2, 2),
        frame_count: 2,
        fps: 8,
        loop_mode: LoopMode::Loop,
        directions: Direction::ALL
            .into_iter()
            .map(|direction| DirectionDefinition {
                direction,
                mode: DirectionMode::Explicit,
                source: None,
            })
            .collect(),
        tracks: vec![MotionTrack {
            direction: Direction::E,
            slot_id: SlotId::parse("hand_l").unwrap(),
            property: TrackProperty::OffsetXPx,
            interpolation: Interpolation::Linear,
            keys: vec![
                Keyframe {
                    frame: 0,
                    value: TrackValue::Number(0.0),
                },
                Keyframe {
                    frame: 1,
                    value: TrackValue::Number(1.0),
                },
            ],
        }],
        semantics: None,
        published_at: timestamp,
    }
}

fn seed_assets(
    root: &VaultRoot,
    area_id: ObjectId,
    profile_ref: RevisionRef,
    slot_id: &SlotId,
    timestamp: UtcTimestamp,
) -> Vec<(Direction, SlotRef)> {
    Direction::ALL
        .into_iter()
        .enumerate()
        .map(|(index, direction)| {
            seed_asset(
                root,
                area_id,
                profile_ref,
                slot_id,
                timestamp,
                index,
                direction,
            )
        })
        .collect()
}

fn seed_asset(
    root: &VaultRoot,
    area_id: ObjectId,
    profile_ref: RevisionRef,
    slot_id: &SlotId,
    timestamp: UtcTimestamp,
    index: usize,
    direction: Direction,
) -> (Direction, SlotRef) {
    let asset_id = ObjectId::new();
    let segment = direction_name(direction);
    let source_relative = format!(".area/assets/{segment}/source.png");
    write_test_pixel(root, &source_relative, direction, index);
    write_document(
        root,
        Path::new(AREA_PATH).join(format!(".area/assets/{segment}/asset.json")),
        DomainDocument::Asset(asset_document(asset_id, area_id, segment, timestamp)),
    );
    write_document(
        root,
        Path::new(AREA_PATH).join(format!(".area/assets/{segment}/revision.json")),
        DomainDocument::AssetRevision(asset_revision_document(
            root,
            asset_id,
            profile_ref,
            slot_id,
            direction,
            source_relative,
            timestamp,
        )),
    );
    (
        direction,
        SlotRef {
            asset_id,
            revision: 1,
            slot_id: slot_id.clone(),
        },
    )
}

fn seed_variant_asset(
    root: &VaultRoot,
    area_id: ObjectId,
    profile_ref: RevisionRef,
    slot_id: &SlotId,
    timestamp: UtcTimestamp,
    direction: Direction,
    variant: &str,
) -> SlotRef {
    let asset_id = ObjectId::new();
    let segment = format!("{}-{variant}", direction_name(direction));
    let source_relative = format!(".area/assets/{segment}/source.png");
    let source = root
        .resolve(&Path::new(AREA_PATH).join(&source_relative))
        .unwrap();
    fs::create_dir_all(source.as_path().parent().unwrap()).unwrap();
    RgbaImage::from_pixel(1, 1, Rgba([70, 220, 160, 255]))
        .save(source.as_path())
        .unwrap();
    write_document(
        root,
        Path::new(AREA_PATH).join(format!(".area/assets/{segment}/asset.json")),
        DomainDocument::Asset(asset_document(asset_id, area_id, &segment, timestamp)),
    );
    let mut revision = asset_revision_document(
        root,
        asset_id,
        profile_ref,
        slot_id,
        direction,
        source_relative,
        timestamp,
    );
    revision.variant = variant.to_owned();
    write_document(
        root,
        Path::new(AREA_PATH).join(format!(".area/assets/{segment}/revision.json")),
        DomainDocument::AssetRevision(revision),
    );
    SlotRef {
        asset_id,
        revision: 1,
        slot_id: slot_id.clone(),
    }
}

fn write_test_pixel(root: &VaultRoot, source_relative: &str, direction: Direction, index: usize) {
    let source = root
        .resolve(&Path::new(AREA_PATH).join(source_relative))
        .unwrap();
    fs::create_dir_all(source.as_path().parent().unwrap()).unwrap();
    let color = match direction {
        Direction::S => [240, 20, 30, 255],
        Direction::E => [20, 40, 240, 255],
        _ => [20 + index as u8, 190, 80, 255],
    };
    RgbaImage::from_pixel(1, 1, Rgba(color))
        .save(source.as_path())
        .unwrap();
}

fn asset_document(
    asset_id: ObjectId,
    area_id: ObjectId,
    segment: &str,
    timestamp: UtcTimestamp,
) -> Asset {
    Asset {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::Asset,
        id: asset_id,
        revision: 1,
        area_id,
        name: format!("Hand {segment}"),
        original_name: format!("hand_{segment}.png"),
        asset_kind: AssetKind::Body,
        label_ids: Vec::new(),
        released_revisions: vec![1],
        origin_note: "Generated test pixel".to_owned(),
        license_note: "CC0".to_owned(),
        archived: false,
        created_at: timestamp,
        updated_at: timestamp,
    }
}

fn asset_revision_document(
    root: &VaultRoot,
    asset_id: ObjectId,
    profile_ref: RevisionRef,
    slot_id: &SlotId,
    direction: Direction,
    source_relative: String,
    timestamp: UtcTimestamp,
) -> AssetRevision {
    let source = root
        .resolve(&Path::new(AREA_PATH).join(&source_relative))
        .unwrap();
    let content_hash = Sha256Digest::parse(format!(
        "{:x}",
        Sha256::digest(fs::read(source.as_path()).unwrap())
    ))
    .unwrap();
    AssetRevision {
        schema_version: SCHEMA_VERSION,
        kind: DocumentKind::AssetRevision,
        asset_id,
        revision: 1,
        profile_ref,
        slot_id: slot_id.clone(),
        direction,
        variant: "base".to_owned(),
        source_file: RelativePath::parse(source_relative).unwrap(),
        image_size_px: PixelSize(1, 1),
        pivot_px: PixelPoint(0, 0),
        content_hash,
        sprite_mirroring_allowed: false,
        published_at: timestamp,
    }
}

include!("outfit_workflow_cases/draft_and_assignment.rs");
include!("outfit_workflow_cases/rendering_and_variants.rs");
include!("outfit_workflow_cases/guides_and_save.rs");
include!("outfit_workflow_cases/apply_and_recovery.rs");

fn npc_paths(saved: &SavedNpc) -> (PathBuf, PathBuf, PathBuf) {
    let root = PathBuf::from(&saved.character_folder);
    let binding_folder = pixel_cutout_sprite_studio_lib::storage::object_folder(
        saved.binding.action_key.as_str(),
        saved.binding.id,
    )
    .unwrap();
    (
        root.join("character.json"),
        root.join("appearances/default.json"),
        root.join(binding_folder).join("binding.json"),
    )
}

fn install_duplicate_binding(root: &VaultRoot, saved: &SavedNpc) {
    let mut duplicate = saved.binding.clone();
    duplicate.id = ObjectId::new();
    let character_root = PathBuf::from(&saved.character_folder);
    let folder = pixel_cutout_sprite_studio_lib::storage::object_folder(
        duplicate.action_key.as_str(),
        duplicate.id,
    )
    .unwrap();
    write_document(
        root,
        character_root.join(folder).join("binding.json"),
        DomainDocument::AnimationBinding(duplicate),
    );
}

fn seed_equipment_assets(
    fixture: &OutfitFixture,
    prefix: &str,
    slot: &str,
    kind: AssetKind,
    palette: u8,
) -> Vec<(Direction, SlotRef)> {
    let slot_id = SlotId::parse(slot).unwrap();
    Direction::ALL
        .into_iter()
        .map(|direction| {
            let asset_id = ObjectId::new();
            let name = format!("{prefix}-{}", direction_name(direction));
            let source_relative = format!(".area/assets/{name}/source.png");
            let source = fixture
                .root
                .resolve(&Path::new(AREA_PATH).join(&source_relative))
                .unwrap();
            fs::create_dir_all(source.as_path().parent().unwrap()).unwrap();
            RgbaImage::from_pixel(1, 1, Rgba(equipment_color(palette, direction)))
                .save(source.as_path())
                .unwrap();
            let mut asset = asset_document(asset_id, fixture.area_id, &name, timestamp());
            asset.name = name.clone();
            asset.original_name = format!("{name}.png");
            asset.asset_kind = kind;
            write_document(
                &fixture.root,
                Path::new(AREA_PATH).join(format!(".area/assets/{name}/asset.json")),
                DomainDocument::Asset(asset),
            );
            write_document(
                &fixture.root,
                Path::new(AREA_PATH).join(format!(".area/assets/{name}/revision.json")),
                DomainDocument::AssetRevision(asset_revision_document(
                    &fixture.root,
                    asset_id,
                    fixture.profile_ref,
                    &slot_id,
                    direction,
                    source_relative,
                    timestamp(),
                )),
            );
            (
                direction,
                SlotRef {
                    asset_id,
                    revision: 1,
                    slot_id: slot_id.clone(),
                },
            )
        })
        .collect()
}

fn equipment_color(palette: u8, direction: Direction) -> [u8; 4] {
    let direction_index = Direction::ALL
        .iter()
        .position(|candidate| *candidate == direction)
        .unwrap() as u8;
    [palette, 30 + direction_index, 220 - direction_index, 255]
}

fn equipment_piece(
    name: &str,
    slot: &str,
    assets: &[(Direction, SlotRef)],
    offset_y: i16,
    layers: impl Fn(Direction) -> i16,
) -> EquipmentPart {
    EquipmentPart {
        id: ObjectId::new(),
        name: name.to_owned(),
        anchor_slot: SlotId::parse(slot).unwrap(),
        asset: assets[0].1.clone(),
        enabled: true,
        follow_mode: FollowMode::Slot,
        own_motion_enabled: false,
        fit_by_direction: assets
            .iter()
            .map(|(direction, asset)| DirectionFit {
                direction: *direction,
                asset: Some(asset.clone()),
                pivot_px: Some(PixelPoint(0, 0)),
                variant_fittings: Vec::new(),
                transform: transform(0, offset_y, 0.0),
                visible: true,
                layer_delta: layers(*direction),
            })
            .collect(),
        own_motion_tracks: Vec::new(),
    }
}

fn equipment_from_parts(name: &str, mut parts: Vec<EquipmentPart>) -> Equipment {
    let primary = parts.remove(0);
    Equipment {
        id: primary.id,
        name: name.to_owned(),
        anchor_slot: primary.anchor_slot,
        asset: primary.asset,
        enabled: primary.enabled,
        follow_mode: primary.follow_mode,
        own_motion_enabled: primary.own_motion_enabled,
        fit_by_direction: primary.fit_by_direction,
        own_motion_tracks: primary.own_motion_tracks,
        additional_parts: parts,
    }
}

fn equipment_track(direction: Direction, enabled: bool, x_at_end: i16) -> EquipmentMotionTrack {
    EquipmentMotionTrack {
        direction,
        enabled,
        interpolation: Interpolation::Linear,
        keys: vec![
            EquipmentMotionKey {
                frame: 0,
                transform: transform(0, 0, 0.0),
            },
            EquipmentMotionKey {
                frame: 1,
                transform: transform(x_at_end, 0, 12.0),
            },
        ],
    }
}

#[path = "outfit_workflow/bindings.rs"]
mod outfit_bindings;
#[path = "outfit_workflow/equipment.rs"]
mod outfit_equipment;
fn write_document(root: &VaultRoot, relative: PathBuf, document: DomainDocument) {
    fs::create_dir_all(root.path().join(&relative).parent().unwrap()).unwrap();
    JsonStore::default()
        .create(&root.resolve(&relative).unwrap(), &document)
        .unwrap();
}

fn timestamp() -> UtcTimestamp {
    UtcTimestamp::parse("2026-09-05T09:00:00Z").unwrap()
}

fn transform(x: i16, y: i16, rotation_deg: f32) -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(x, y),
        rotation_deg,
    }
}

fn direction_name(direction: Direction) -> &'static str {
    match direction {
        Direction::N => "n",
        Direction::Ne => "ne",
        Direction::E => "e",
        Direction::Se => "se",
        Direction::S => "s",
        Direction::Sw => "sw",
        Direction::W => "w",
        Direction::Nw => "nw",
    }
}

fn pixel(rgba: &[u8], width: u32, x: u32, y: u32) -> [u8; 4] {
    let index = ((y * width + x) * 4) as usize;
    rgba[index..index + 4].try_into().unwrap()
}

fn opaque_pixels(rgba: &[u8]) -> usize {
    rgba.chunks_exact(4).filter(|pixel| pixel[3] != 0).count()
}
