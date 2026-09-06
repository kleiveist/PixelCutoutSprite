from __future__ import annotations

import argparse

from tools import logger
from tools.tauri import common, paths
from tools.tauri.build import native_artifacts

DEFAULT_MACOS_BUNDLES = native_artifacts.DEFAULT_BUNDLES["macos"]


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    try:
        requested = native_artifacts.normalize_bundles("macos", getattr(args, "bundles", None))
    except native_artifacts.NativeArtifactError as exc:
        logger.fail(str(exc))
        return 1
    if common.host_os() != "darwin" and not dry_run:
        logger.fail("macOS build requires a macOS host.")
        return 1
    previous = None
    if not dry_run:
        try:
            native_artifacts.prepare_outputs(
                "macos",
                requested,
                bundle_root=_bundle_root(),
                evidence_root=_evidence_root(),
                repository_root=paths.ROOT,
                clean_bundles=not bool(getattr(args, "no_clean", False)),
            )
            if getattr(args, "no_clean", False):
                previous = native_artifacts.snapshot_outputs("macos", requested, _bundle_root())
        except (native_artifacts.NativeArtifactError, OSError) as exc:
            logger.fail(f"Could not prepare macOS bundle outputs: {exc}")
            return 1
    bundles = ",".join(requested)
    command = common.tauri_cli_command("build", "--bundles", bundles)
    common.print_build_plan("macos", command, dry_run=dry_run, bundles=bundles)
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run)
    code = common.print_result(result, "macOS Tauri build completed", "macOS Tauri build failed")
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        try:
            verification, evidence = native_artifacts.verify_and_write(
                "macos",
                requested,
                bundle_root=_bundle_root(),
                repository_root=paths.ROOT,
                evidence_root=_evidence_root(),
                previous_snapshot=previous,
            )
        except (native_artifacts.NativeArtifactError, OSError) as exc:
            logger.fail(f"macOS bundle verification failed: {exc}")
            return 1
        native_artifacts.log_verification(verification)
        if not verification.ok or evidence is None:
            return 1
        logger.ok(f"macOS bundle manifest: {evidence.manifest.relative_to(paths.ROOT)}")
        logger.ok(f"macOS bundle checksums: {evidence.checksums.relative_to(paths.ROOT)}")
        common.print_build_artifacts()
    return code


def _bundle_root():
    return native_artifacts.default_bundle_root("macos")


def _evidence_root():
    return paths.DIST_DIR / "macos"
