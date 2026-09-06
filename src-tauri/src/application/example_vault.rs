use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use image::{Rgba, RgbaImage};
use serde::Serialize;
use thiserror::Error;

use crate::animation::PresetKind;
use crate::asset_io::{
    AssetPackage, ImportDecision, PackageEntry, SizeHandling, ASSET_PACKAGE_FORMAT,
};
use crate::domain::{
    AtlasSize, CharacterStatus, ClippingPolicy, Direction, DirectionFit, DomainError, Equipment,
    ExportJumpMode, ExportProfileSnapshot, ExportRootMotionMode, FollowMode, LabelScope,
    LocalOverride, LoopMode, ObjectId, ObjectType, OutfitLocalOverride, PixelPoint, PixelSize,
    ProfileRevision, RevisionRef, SlotDefinition, SlotId, SlotRef, Transform2D,
};
use crate::exports::NeverCancel;
use crate::storage::{object_folder, StorageError, VaultRoot};

use super::{
    AddBindingRequest, AppearanceService, AppearanceServiceError, AreaService, AssetInventory,
    AssetService, AssetServiceError, BindingService, ConfirmAssetImportRequest, CreateAreaRequest,
    CreateMotionRequest, ExportOutputFormat, ExportProfileService, ExportProfileServiceError,
    LabelService, MotionService, NpcExportError, NpcExportService, OutfitDraftEdits, OutfitTarget,
    ProjectService, ReviewBindingRequest, SaveNpcExportProfileRequest, SaveNpcRequest,
    SetCharacterStatusRequest, StartNpcExportRequest, UpdateBindingOverridesRequest,
    VaultInspection, VaultService,
};

const PROJECT_NAME: &str = "Lichterhain";
const AREA_NAME: &str = "Dorf-NPCs";
const ASSET_ORIGIN: &str =
    "Programmatically generated geometric RGBA8 pixel art; no external source was used.";
const ASSET_LICENSE: &str = "MIT; see LICHTERHAIN-LICENSE.txt in the vault root.";
const LICENSE_TEXT: &str = include_str!("../../../LICENSE");
const IMPORT_BATCH_LIMIT: usize = 64;
const EXAMPLE_README: &str = r#"# Lichterhain example vault

This vault was generated locally by PixelCutoutSprite Studio through its production services.
It contains the 80 px humanoid area `Dorf-NPCs`, the shared released motions Walk, Sprint, and
Jump, and the differently equipped NPCs Mira and Borin. Both NPCs reference the same immutable
motion releases and include a local fitting correction. Their complete generic PNG/JSON and
Godot 4.7.2 packages are stored below each NPC's `_exports` directory.

All included sprite PNGs are programmatically generated geometric RGBA8 pixel art. No external
artwork or network source was used. The generated example assets are licensed under the MIT
license in `LICHTERHAIN-LICENSE.txt`.

Open this directory as a vault in PixelCutoutSprite Studio. The authoritative sources are the
ordinary JSON and PNG files; caches and `_exports` are derived and can be recreated.
"#;

#[derive(Debug, Error)]
pub enum ExampleVaultError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Asset(#[from] AssetServiceError),
    #[error(transparent)]
    Appearance(#[from] AppearanceServiceError),
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Export(#[from] NpcExportError),
    #[error(transparent)]
    ExportProfile(#[from] ExportProfileServiceError),
    #[error("example-vault filesystem operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("example-vault PNG generation failed: {0}")]
    Image(#[from] image::ImageError),
    #[error("example-vault package generation failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("example-vault invariant failed: {0}")]
    Invalid(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExampleVaultOutcome {
    pub vault_path: String,
    pub project_id: ObjectId,
    pub area_id: ObjectId,
    pub profile_ref: RevisionRef,
    pub generated_asset_count: usize,
    pub motions: Vec<ExampleMotion>,
    pub npcs: Vec<ExampleNpc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExampleMotion {
    pub name: String,
    pub action_key: String,
    pub template_ref: RevisionRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExampleNpc {
    pub name: String,
    pub character_id: ObjectId,
    pub appearance_id: ObjectId,
    pub binding_ids: Vec<ObjectId>,
    pub generic_build: String,
    pub godot_package: String,
    pub animation_names: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExampleExportProfile {
    pub profile: ExportProfileSnapshot,
    pub root_motion_mode: ExportRootMotionMode,
    pub jump_mode: ExportJumpMode,
    pub format: ExportOutputFormat,
    pub include_godot_scene: bool,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ExampleVaultService;

impl ExampleVaultService {
    /// Creates the complete Lichterhain sample in an empty real directory. All authoritative
    /// vault data is produced through the same services used by Tauri commands.
    pub fn generate(output: &Path) -> Result<ExampleVaultOutcome, ExampleVaultError> {
        ensure_empty_output(output)?;
        match VaultService::inspect(output)? {
            VaultInspection::Empty { .. } => {}
            _ => {
                return Err(ExampleVaultError::Invalid(
                    "the destination must be an empty directory".to_owned(),
                ))
            }
        }

        let mut vaults = VaultService::default();
        let opened = vaults.initialize(output, None)?;
        let generated = generate_open_vault(&mut vaults, opened.session_id, &opened.path);
        let closed = vaults.close(opened.session_id);
        match (generated, closed) {
            (Ok(outcome), Ok(())) => Ok(outcome),
            (Err(error), _) => Err(error),
            (Ok(_), Err(error)) => Err(error.into()),
        }
    }
}

fn generate_open_vault(
    vaults: &mut VaultService,
    session_id: ObjectId,
    vault_path: &str,
) -> Result<ExampleVaultOutcome, ExampleVaultError> {
    let sample_label = LabelService::create(
        vaults,
        session_id,
        LabelScope::Workspace,
        None,
        "Beispiel".to_owned(),
        "#8fcf73".to_owned(),
    )?;
    let project = ProjectService::create(
        vaults,
        session_id,
        PROJECT_NAME.to_owned(),
        vec![sample_label.id],
    )?;
    let villager_label = LabelService::create(
        vaults,
        session_id,
        LabelScope::Project,
        Some(project.id),
        "Dorfbewohner".to_owned(),
        "#e0a45f".to_owned(),
    )?;
    let area = AreaService::create(
        vaults,
        session_id,
        CreateAreaRequest {
            project_id: project.id,
            name: AREA_NAME.to_owned(),
            object_type: ObjectType::Humanoid,
            reference_height_px: 80,
            default_frame_size_px: None,
            default_ground_origin_px: None,
            label_ids: vec![villager_label.id],
        },
    )?;
    let project_path = object_folder(PROJECT_NAME, project.id)?;
    let area_path = project_path.join(object_folder(AREA_NAME, area.area.id)?);
    let root = vaults.session_root(session_id, true)?;
    fs::write(root.path().join("LICHTERHAIN-LICENSE.txt"), LICENSE_TEXT)?;
    fs::write(root.path().join("LICHTERHAIN-README.md"), EXAMPLE_README)?;

    let source = GeneratedSource::new()?;
    let specs = asset_specs(&area.profile)?;
    write_source_assets(source.path(), &specs)?;
    import_source_assets(
        vaults,
        session_id,
        area.area.id,
        area.profile.reference(),
        source.path(),
        &specs,
    )?;
    let inventory = AssetService::inventory(vaults, session_id, area.area.id)?;
    require_asset_inventory(&inventory, &specs)?;

    let motions = create_shared_motions(vaults, session_id, area.area.id)?;
    let export_profile = save_export_profile(&root, &area_path, area.area.id)?;
    let mut npcs = Vec::new();
    for persona in [Persona::Mira, Persona::Borin] {
        npcs.push(create_npc(
            vaults,
            session_id,
            &root,
            &area_path,
            &inventory,
            &specs,
            &motions,
            villager_label.id,
            &export_profile,
            persona,
        )?);
    }

    Ok(ExampleVaultOutcome {
        vault_path: vault_path.to_owned(),
        project_id: project.id,
        area_id: area.area.id,
        profile_ref: area.profile.reference(),
        generated_asset_count: specs.len(),
        motions,
        npcs,
    })
}

fn create_shared_motions(
    vaults: &mut VaultService,
    session_id: ObjectId,
    area_id: ObjectId,
) -> Result<Vec<ExampleMotion>, ExampleVaultError> {
    let plans = [
        (PresetKind::Walk, "Walk", "walk", 12, 12, LoopMode::Loop),
        (
            PresetKind::Sprint,
            "Sprint",
            "sprint",
            8,
            16,
            LoopMode::Loop,
        ),
        (PresetKind::Jump, "Jump", "jump", 12, 12, LoopMode::Once),
    ];
    plans
        .into_iter()
        .map(
            |(preset_kind, name, action_key, frame_count, fps, loop_mode)| {
                let card = MotionService::create(
                    vaults,
                    session_id,
                    CreateMotionRequest {
                        area_id,
                        name: name.to_owned(),
                        action_key: action_key.to_owned(),
                        frame_count,
                        fps,
                        loop_mode,
                        frame_size_px: None,
                        ground_origin_px: None,
                        label_ids: Vec::new(),
                        preset_kind: Some(preset_kind),
                    },
                )?;
                let release = MotionService::publish(vaults, session_id, card.id)?;
                Ok(ExampleMotion {
                    name: name.to_owned(),
                    action_key: action_key.to_owned(),
                    template_ref: release.reference(),
                })
            },
        )
        .collect()
}

fn save_export_profile(
    root: &VaultRoot,
    area_path: &Path,
    area_id: ObjectId,
) -> Result<ExampleExportProfile, ExampleVaultError> {
    let request = ExampleExportProfile {
        profile: ExportProfileSnapshot {
            name: "Lichterhain Godot 4.7.2".to_owned(),
            directions: Direction::ALL.to_vec(),
            max_page_size_px: AtlasSize(2048, 2048),
            max_pages: 64,
            memory_budget_bytes: 256 * 1024 * 1024,
            padding_px: 0,
            extrude_edges: false,
            individual_frames: false,
            include_shadow: true,
            normalize_geometry: false,
            clipping_policy: ClippingPolicy::Block,
            allow_incomplete_test: false,
        },
        root_motion_mode: ExportRootMotionMode::Baked,
        jump_mode: ExportJumpMode::Baked,
        format: ExportOutputFormat::GodotPackage,
        include_godot_scene: true,
    };
    ExportProfileService.save(
        root,
        area_path,
        area_id,
        SaveNpcExportProfileRequest {
            profile_id: None,
            expected_revision: None,
            profile: request.profile.clone(),
            root_motion_mode: request.root_motion_mode,
            jump_mode: request.jump_mode,
            format: request.format,
            include_godot_scene: request.include_godot_scene,
        },
    )?;
    Ok(request)
}

#[allow(clippy::too_many_arguments)]
fn create_npc(
    vaults: &mut VaultService,
    session_id: ObjectId,
    root: &VaultRoot,
    area_path: &Path,
    inventory: &AssetInventory,
    specs: &[AssetSpec],
    motions: &[ExampleMotion],
    label_id: ObjectId,
    export_profile: &ExampleExportProfile,
    persona: Persona,
) -> Result<ExampleNpc, ExampleVaultError> {
    let walk = motion(motions, "walk")?;
    let draft =
        AppearanceService.start_draft(root, area_path, walk.template_ref, OutfitTarget::NewNpc)?;
    let body_refs = asset_references(inventory, specs, persona, AssetRole::Body)?
        .into_iter()
        .map(|asset| asset.reference)
        .collect();
    let assigned = AppearanceService.auto_assign(
        root,
        area_path,
        draft.draft.id,
        draft.draft.revision,
        body_refs,
    )?;
    let mut fittings = assigned.draft.fittings.clone();
    let correction_slot = SlotId::parse(persona.fitting_slot())?;
    let correction = fittings
        .iter_mut()
        .find(|fitting| {
            fitting.slot_id == correction_slot && fitting.direction == persona.fitting_direction()
        })
        .ok_or_else(|| {
            ExampleVaultError::Invalid(format!(
                "{} fitting correction target is missing",
                persona.name()
            ))
        })?;
    correction.transform.offset_px = persona.fitting_offset();
    let local_overrides = if persona == Persona::Mira {
        vec![OutfitLocalOverride {
            slot_id: SlotId::parse("hand_r")?,
            direction: Direction::Se,
            transform: transform(1, 0, 0.0),
        }]
    } else {
        Vec::new()
    };
    let equipment = vec![build_equipment(inventory, specs, persona)?];
    let dressed = AppearanceService.autosave_draft(
        root,
        area_path,
        assigned.draft.id,
        assigned.draft.revision,
        OutfitDraftEdits {
            fittings,
            asset_fallback_approvals: assigned.draft.asset_fallback_approvals,
            local_overrides,
            equipment,
        },
    )?;
    let saved = AppearanceService.save_as_npc(
        root,
        area_path,
        dressed.draft.id,
        dressed.draft.revision,
        SaveNpcRequest {
            name: persona.name().to_owned(),
            description: persona.description().to_owned(),
            label_ids: vec![label_id],
        },
    )?;
    vaults.refresh_index(session_id)?;

    let mut bindings = vec![saved.binding];
    for action in ["sprint", "jump"] {
        bindings.push(BindingService.add_binding(
            root,
            area_path,
            AddBindingRequest {
                character_id: saved.character.id,
                template_ref: motion(motions, action)?.template_ref,
                variant_action_key: None,
            },
        )?);
        vaults.refresh_index(session_id)?;
    }
    if persona == Persona::Borin {
        let sprint = bindings
            .iter()
            .find(|binding| binding.action_key.as_str() == "sprint")
            .ok_or_else(|| {
                ExampleVaultError::Invalid("Borin sprint binding is missing".to_owned())
            })?
            .clone();
        let updated = BindingService.update_local_overrides(
            root,
            area_path,
            UpdateBindingOverridesRequest {
                binding_id: sprint.id,
                expected_revision: sprint.revision,
                local_overrides: vec![LocalOverride {
                    slot_id: SlotId::parse("forearm_l")?,
                    direction: Direction::W,
                    transform: transform(-1, 0, 0.0),
                }],
            },
        )?;
        let index = bindings
            .iter()
            .position(|binding| binding.id == updated.id)
            .expect("the updated binding came from this list");
        bindings[index] = updated;
        vaults.refresh_index(session_id)?;
    }
    for binding in &mut bindings {
        *binding = BindingService.review_binding(
            root,
            area_path,
            ReviewBindingRequest {
                binding_id: binding.id,
                expected_revision: binding.revision,
            },
        )?;
        vaults.refresh_index(session_id)?;
    }
    BindingService.set_character_status(
        root,
        area_path,
        SetCharacterStatusRequest {
            character_id: saved.character.id,
            expected_revision: saved.character.revision,
            status: CharacterStatus::Reviewed,
        },
    )?;
    vaults.refresh_index(session_id)?;

    let inspection = NpcExportService.inspect(root, area_path, saved.character.id)?;
    if inspection.bindings.len() != motions.len()
        || inspection
            .bindings
            .iter()
            .any(|binding| !binding.ready || !binding.reviewed)
    {
        return Err(ExampleVaultError::Invalid(format!(
            "{} does not have three reviewed export-ready bindings",
            persona.name()
        )));
    }
    let binding_ids = bindings
        .iter()
        .map(|binding| binding.id)
        .collect::<Vec<_>>();
    let exported = NpcExportService.execute(
        root,
        area_path,
        StartNpcExportRequest {
            character_id: saved.character.id,
            binding_ids: binding_ids.clone(),
            profile: export_profile.profile.clone(),
            root_motion_mode: export_profile.root_motion_mode,
            jump_mode: export_profile.jump_mode,
            format: export_profile.format,
            include_godot_scene: export_profile.include_godot_scene,
        },
        &NeverCancel,
        &mut |_| {},
    )?;
    if !exported.generic.manifest.complete {
        return Err(ExampleVaultError::Invalid(format!(
            "{} generic export is incomplete",
            persona.name()
        )));
    }
    let godot = exported.godot_package.ok_or_else(|| {
        ExampleVaultError::Invalid(format!("{} Godot package is missing", persona.name()))
    })?;
    if godot.animation_names.len() != motions.len() * Direction::ALL.len() || godot.scene.is_none()
    {
        return Err(ExampleVaultError::Invalid(format!(
            "{} Godot package is not the complete three-action/eight-direction scene package",
            persona.name()
        )));
    }
    let generic_build = Path::new(&saved.character_folder)
        .join("_exports")
        .join(exported.generic.build.as_str());
    Ok(ExampleNpc {
        name: persona.name().to_owned(),
        character_id: saved.character.id,
        appearance_id: saved.appearance.id,
        binding_ids,
        generic_build: portable_text(&generic_build),
        godot_package: portable_text(&godot.package_directory),
        animation_names: godot.animation_names,
    })
}

fn motion<'a>(
    motions: &'a [ExampleMotion],
    action_key: &str,
) -> Result<&'a ExampleMotion, ExampleVaultError> {
    motions
        .iter()
        .find(|motion| motion.action_key == action_key)
        .ok_or_else(|| ExampleVaultError::Invalid(format!("motion `{action_key}` is missing")))
}

fn build_equipment(
    inventory: &AssetInventory,
    specs: &[AssetSpec],
    persona: Persona,
) -> Result<Equipment, ExampleVaultError> {
    let assets = asset_references(inventory, specs, persona, AssetRole::Equipment)?;
    if assets.len() != Direction::ALL.len() {
        return Err(ExampleVaultError::Invalid(format!(
            "{} equipment needs one image for every direction",
            persona.name()
        )));
    }
    let first = assets
        .first()
        .ok_or_else(|| ExampleVaultError::Invalid("equipment images are missing".to_owned()))?;
    Ok(Equipment {
        id: ObjectId::new(),
        name: persona.equipment_name().to_owned(),
        anchor_slot: first.reference.slot_id.clone(),
        asset: first.reference.clone(),
        enabled: true,
        follow_mode: FollowMode::Slot,
        own_motion_enabled: false,
        fit_by_direction: assets
            .into_iter()
            .map(|asset| DirectionFit {
                direction: asset.direction,
                asset: Some(asset.reference),
                pivot_px: Some(asset.pivot),
                variant_fittings: Vec::new(),
                transform: transform(0, 0, 0.0),
                visible: true,
                layer_delta: if matches!(
                    asset.direction,
                    Direction::N | Direction::Ne | Direction::Nw
                ) {
                    -2
                } else {
                    3
                },
            })
            .collect(),
        own_motion_tracks: Vec::new(),
        additional_parts: Vec::new(),
    })
}

#[derive(Debug, Clone)]
struct ImportedReference {
    reference: SlotRef,
    direction: Direction,
    pivot: PixelPoint,
}

fn asset_references(
    inventory: &AssetInventory,
    specs: &[AssetSpec],
    persona: Persona,
    role: AssetRole,
) -> Result<Vec<ImportedReference>, ExampleVaultError> {
    let by_name = inventory
        .items
        .iter()
        .map(|item| (item.name.as_str(), item))
        .collect::<HashMap<_, _>>();
    let mut result = Vec::new();
    for direction in Direction::ALL {
        for spec in specs.iter().filter(|spec| {
            spec.persona == persona && spec.role == role && spec.direction == direction
        }) {
            let item = by_name.get(spec.name.as_str()).ok_or_else(|| {
                ExampleVaultError::Invalid(format!("imported asset `{}` is missing", spec.name))
            })?;
            result.push(ImportedReference {
                reference: SlotRef {
                    asset_id: item.id,
                    revision: item.released_revision,
                    slot_id: item.slot_id.clone(),
                },
                direction: item.direction,
                pivot: item.pivot_px,
            });
        }
    }
    Ok(result)
}

fn require_asset_inventory(
    inventory: &AssetInventory,
    specs: &[AssetSpec],
) -> Result<(), ExampleVaultError> {
    if inventory.items.len() != specs.len() {
        return Err(ExampleVaultError::Invalid(format!(
            "expected {} imported assets, found {}",
            specs.len(),
            inventory.items.len()
        )));
    }
    let mut names = inventory
        .items
        .iter()
        .map(|item| item.name.as_str())
        .collect::<Vec<_>>();
    names.sort_unstable();
    names.dedup();
    if names.len() != specs.len() {
        return Err(ExampleVaultError::Invalid(
            "generated asset names are not unique".to_owned(),
        ));
    }
    Ok(())
}

fn import_source_assets(
    vaults: &mut VaultService,
    session_id: ObjectId,
    area_id: ObjectId,
    profile_ref: RevisionRef,
    source_root: &Path,
    specs: &[AssetSpec],
) -> Result<(), ExampleVaultError> {
    for (batch, specs) in specs.chunks(IMPORT_BATCH_LIMIT).enumerate() {
        let package = AssetPackage {
            format: ASSET_PACKAGE_FORMAT.to_owned(),
            format_version: 1,
            profile_ref,
            entries: specs.iter().map(AssetSpec::package_entry).collect(),
        };
        let package_path = source_root.join(format!("package-{batch:02}.json"));
        fs::write(&package_path, serde_json::to_vec_pretty(&package)?)?;
        let inspection = AssetService::inspect_sources(
            vaults,
            session_id,
            area_id,
            vec![package_path.to_string_lossy().into_owned()],
        )?;
        let decisions = inspection
            .entries
            .iter()
            .map(|entry| {
                Ok(ImportDecision {
                    entry_index: entry.entry_index,
                    slot_id: entry.declared_slot_id.clone().ok_or_else(|| {
                        ExampleVaultError::Invalid(format!(
                            "package entry {} lost its declared slot",
                            entry.entry_index
                        ))
                    })?,
                    direction: entry.declared_direction.ok_or_else(|| {
                        ExampleVaultError::Invalid(format!(
                            "package entry {} lost its declared direction",
                            entry.entry_index
                        ))
                    })?,
                    size_handling: SizeHandling::KeepOriginal,
                })
            })
            .collect::<Result<Vec<_>, ExampleVaultError>>()?;
        AssetService::import(
            vaults,
            session_id,
            ConfirmAssetImportRequest {
                area_id,
                inspection_fingerprint: inspection.inspection_fingerprint,
                source: inspection.source,
                decisions,
            },
        )?;
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Persona {
    Mira,
    Borin,
}

impl Persona {
    fn slug(self) -> &'static str {
        match self {
            Self::Mira => "mira",
            Self::Borin => "borin",
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Mira => "Mira",
            Self::Borin => "Borin",
        }
    }

    fn description(self) -> &'static str {
        match self {
            Self::Mira => "Kräuterkundige aus Lichterhain mit einer starren Handlaterne.",
            Self::Borin => "Dorfwächter aus Lichterhain mit einem starren Unterarmschild.",
        }
    }

    fn equipment_name(self) -> &'static str {
        match self {
            Self::Mira => "Handlaterne",
            Self::Borin => "Unterarmschild",
        }
    }

    fn equipment_slug(self) -> &'static str {
        match self {
            Self::Mira => "lantern",
            Self::Borin => "shield",
        }
    }

    fn equipment_slot(self) -> &'static str {
        match self {
            Self::Mira => "hand_r",
            Self::Borin => "forearm_l",
        }
    }

    fn fitting_slot(self) -> &'static str {
        match self {
            Self::Mira => "hair",
            Self::Borin => "torso_upper",
        }
    }

    fn fitting_direction(self) -> Direction {
        match self {
            Self::Mira => Direction::S,
            Self::Borin => Direction::N,
        }
    }

    fn fitting_offset(self) -> PixelPoint {
        match self {
            Self::Mira => PixelPoint(1, 0),
            Self::Borin => PixelPoint(-1, 0),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AssetRole {
    Body,
    Equipment,
}

#[derive(Debug, Clone)]
struct AssetSpec {
    persona: Persona,
    role: AssetRole,
    name: String,
    source: String,
    asset_kind: crate::domain::AssetKind,
    slot_id: SlotId,
    direction: Direction,
    size: PixelSize,
    pivot: PixelPoint,
    base_color: [u8; 4],
    accent_color: [u8; 4],
}

impl AssetSpec {
    fn package_entry(&self) -> PackageEntry {
        PackageEntry {
            name: self.name.clone(),
            source: self.source.clone(),
            asset_kind: self.asset_kind,
            slot_id: Some(self.slot_id.to_string()),
            direction: Some(self.direction),
            variant: "base".to_owned(),
            image_size_px: self.size,
            pivot_px: self.pivot,
            sheet_rect_px: None,
            sprite_mirroring_allowed: false,
            origin_note: ASSET_ORIGIN.to_owned(),
            license_note: ASSET_LICENSE.to_owned(),
        }
    }
}

fn asset_specs(profile: &ProfileRevision) -> Result<Vec<AssetSpec>, ExampleVaultError> {
    let slots = profile
        .slots
        .iter()
        .map(|slot| (slot.id.as_str(), slot))
        .collect::<HashMap<_, _>>();
    let mut result = Vec::new();
    for persona in [Persona::Mira, Persona::Borin] {
        for (slot_index, slot) in profile.slots.iter().enumerate() {
            for (direction_index, direction) in Direction::ALL.into_iter().enumerate() {
                let (base_color, accent_color) =
                    body_colors(persona, slot.id.as_str(), slot_index, direction_index);
                result.push(AssetSpec {
                    persona,
                    role: AssetRole::Body,
                    name: format!(
                        "{} {} {}",
                        persona.name(),
                        slot.id,
                        direction_slug(direction)
                    ),
                    source: format!(
                        "{}-{}-{}-body.png",
                        persona.slug(),
                        slot.id,
                        direction_slug(direction)
                    ),
                    asset_kind: body_asset_kind(slot),
                    slot_id: slot.id.clone(),
                    direction,
                    size: slot.size_px,
                    pivot: slot.pivot_px,
                    base_color,
                    accent_color,
                });
            }
        }
        let anchor = slots.get(persona.equipment_slot()).ok_or_else(|| {
            ExampleVaultError::Invalid(format!(
                "profile has no equipment anchor `{}`",
                persona.equipment_slot()
            ))
        })?;
        for (direction_index, direction) in Direction::ALL.into_iter().enumerate() {
            let (base_color, accent_color) = equipment_colors(persona, direction_index);
            result.push(AssetSpec {
                persona,
                role: AssetRole::Equipment,
                name: format!(
                    "{} {} {}",
                    persona.name(),
                    persona.equipment_name(),
                    direction_slug(direction)
                ),
                source: format!(
                    "{}-{}-{}-equipment.png",
                    persona.slug(),
                    persona.equipment_slug(),
                    direction_slug(direction)
                ),
                asset_kind: crate::domain::AssetKind::Equipment,
                slot_id: anchor.id.clone(),
                direction,
                size: anchor.size_px,
                pivot: anchor.pivot_px,
                base_color,
                accent_color,
            });
        }
    }
    Ok(result)
}

fn body_asset_kind(slot: &SlotDefinition) -> crate::domain::AssetKind {
    if matches!(slot.id.as_str(), "hair" | "torso_lower" | "torso_upper") {
        crate::domain::AssetKind::Clothing
    } else {
        crate::domain::AssetKind::Body
    }
}

fn write_source_assets(source_root: &Path, specs: &[AssetSpec]) -> Result<(), ExampleVaultError> {
    for (index, spec) in specs.iter().enumerate() {
        let mut image = RgbaImage::from_pixel(
            u32::from(spec.size.0),
            u32::from(spec.size.1),
            Rgba([0, 0, 0, 0]),
        );
        let width = image.width();
        let height = image.height();
        for y in 0..height {
            for x in 0..width {
                let corner = width > 2
                    && height > 2
                    && (x == 0 || x + 1 == width)
                    && (y == 0 || y + 1 == height);
                if corner {
                    continue;
                }
                let edge = x == 0 || y == 0 || x + 1 == width || y + 1 == height;
                image.put_pixel(
                    x,
                    y,
                    Rgba(if edge {
                        darken(spec.base_color)
                    } else {
                        spec.base_color
                    }),
                );
            }
        }
        let marker_x = (index as u32 * 3 + 1) % width;
        let marker_y = (index as u32 * 5 + 1) % height;
        image.put_pixel(marker_x, marker_y, Rgba(spec.accent_color));
        image.save(source_root.join(&spec.source))?;
    }
    Ok(())
}

fn body_colors(
    persona: Persona,
    slot: &str,
    slot_index: usize,
    direction_index: usize,
) -> ([u8; 4], [u8; 4]) {
    let base = if slot == "hair" {
        match persona {
            Persona::Mira => [91, 52, 111, 255],
            Persona::Borin => [68, 48, 31, 255],
        }
    } else if slot == "head" || slot.starts_with("hand") {
        match persona {
            Persona::Mira => [221, 158, 119, 255],
            Persona::Borin => [174, 118, 82, 255],
        }
    } else if slot.starts_with("torso") {
        match persona {
            Persona::Mira => [64, 145, 101, 255],
            Persona::Borin => [64, 91, 156, 255],
        }
    } else {
        match persona {
            Persona::Mira => [106, 84, 157, 255],
            Persona::Borin => [116, 87, 57, 255],
        }
    };
    let delta = ((slot_index * 7 + direction_index * 3) % 18) as u8;
    (
        brighten(base, delta),
        match persona {
            Persona::Mira => [226, 238, 142, 255],
            Persona::Borin => [174, 211, 231, 255],
        },
    )
}

fn equipment_colors(persona: Persona, direction_index: usize) -> ([u8; 4], [u8; 4]) {
    let delta = (direction_index * 3) as u8;
    match persona {
        Persona::Mira => (brighten([194, 123, 39, 255], delta), [255, 237, 128, 255]),
        Persona::Borin => (brighten([121, 137, 151, 255], delta), [181, 52, 55, 255]),
    }
}

fn brighten(mut color: [u8; 4], delta: u8) -> [u8; 4] {
    for channel in &mut color[..3] {
        *channel = channel.saturating_add(delta);
    }
    color
}

fn darken(mut color: [u8; 4]) -> [u8; 4] {
    for channel in &mut color[..3] {
        *channel = channel.saturating_sub(36);
    }
    color
}

fn direction_slug(direction: Direction) -> &'static str {
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

fn transform(x: i16, y: i16, rotation_deg: f32) -> Transform2D {
    Transform2D {
        offset_px: PixelPoint(x, y),
        rotation_deg,
    }
}

fn portable_text(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn ensure_empty_output(output: &Path) -> Result<(), ExampleVaultError> {
    match fs::symlink_metadata(output) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(ExampleVaultError::Invalid(
                    "the destination must be a real directory, not a symlink or file".to_owned(),
                ));
            }
            if fs::read_dir(output)?.next().transpose()?.is_some() {
                return Err(ExampleVaultError::Invalid(
                    "the destination must be empty; existing files are never replaced".to_owned(),
                ));
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let parent = output
                .parent()
                .filter(|path| !path.as_os_str().is_empty())
                .unwrap_or_else(|| Path::new("."));
            let metadata = fs::symlink_metadata(parent)?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(ExampleVaultError::Invalid(
                    "the destination parent must be a real directory".to_owned(),
                ));
            }
            fs::create_dir(output)?;
        }
        Err(error) => return Err(error.into()),
    }
    Ok(())
}

struct GeneratedSource {
    path: PathBuf,
}

impl GeneratedSource {
    fn new() -> Result<Self, ExampleVaultError> {
        let path = std::env::temp_dir().join(format!(
            "pixelcutoutsprite-lichterhain-source-{}",
            ObjectId::new()
        ));
        fs::create_dir(&path)?;
        Ok(Self {
            path: path.canonicalize()?,
        })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for GeneratedSource {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}
