use crate::domain::Direction;

use super::{
    AssetCoverage, AssetCoverageState, AssetNeed, AssetOrigin, AssetResolver, CoverageIssue,
    DirectionCoverage, DirectionCoverageState, DirectionResolver, ReleaseCoverage,
    RequiredPartVisibility,
};

pub fn check_release_coverage(
    directions: &DirectionResolver<'_>,
    assets: &AssetResolver<'_>,
    needs: &[AssetNeed],
) -> ReleaseCoverage {
    let mut direction_coverage = Vec::with_capacity(Direction::ALL.len());
    let mut issues = Vec::new();
    for direction in Direction::ALL {
        match directions.resolve(direction) {
            Ok(resolved) if resolved.mirror_count == 0 => {
                direction_coverage.push(DirectionCoverage {
                    direction,
                    state: DirectionCoverageState::Explicit,
                });
            }
            Ok(resolved) => direction_coverage.push(DirectionCoverage {
                direction,
                state: DirectionCoverageState::Mirrored {
                    source: resolved.source,
                    mirror_count: resolved.mirror_count,
                },
            }),
            Err(error) => {
                direction_coverage.push(DirectionCoverage {
                    direction,
                    state: DirectionCoverageState::Missing,
                });
                issues.push(CoverageIssue {
                    direction,
                    slot_id: None,
                    message: error.to_string(),
                });
            }
        }
    }

    let mut asset_coverage = Vec::with_capacity(needs.len());
    for need in needs {
        if need.visibility == RequiredPartVisibility::Hidden {
            asset_coverage.push(AssetCoverage {
                need: need.clone(),
                state: AssetCoverageState::Hidden,
            });
            continue;
        }
        let resolution = match directions.resolve(need.direction) {
            Ok(resolution) => resolution,
            Err(error) => {
                asset_coverage.push(AssetCoverage {
                    need: need.clone(),
                    state: AssetCoverageState::Blocked,
                });
                issues.push(CoverageIssue {
                    direction: need.direction,
                    slot_id: Some(need.slot_id.clone()),
                    message: format!("asset cannot be checked: {error}"),
                });
                continue;
            }
        };
        match assets.resolve(resolution, &need.slot_id, &need.variant) {
            Ok(asset) => {
                let state = match asset.origin {
                    AssetOrigin::Exact => AssetCoverageState::Exact {
                        revision: asset.revision.reference(),
                    },
                    AssetOrigin::Mirrored { source } => AssetCoverageState::Mirrored {
                        revision: asset.revision.reference(),
                        source,
                    },
                };
                asset_coverage.push(AssetCoverage {
                    need: need.clone(),
                    state,
                });
            }
            Err(error) => {
                asset_coverage.push(AssetCoverage {
                    need: need.clone(),
                    state: AssetCoverageState::Blocked,
                });
                issues.push(CoverageIssue {
                    direction: need.direction,
                    slot_id: Some(need.slot_id.clone()),
                    message: error.to_string(),
                });
            }
        }
    }

    ReleaseCoverage {
        directions: direction_coverage,
        assets: asset_coverage,
        issues,
    }
}
