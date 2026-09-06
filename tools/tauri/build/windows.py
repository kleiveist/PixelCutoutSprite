from __future__ import annotations

import argparse

from tools import logger
from tools.tauri import common, paths
from tools.tauri.build import native_artifacts

DEFAULT_WINDOWS_BUNDLES = native_artifacts.DEFAULT_BUNDLES["windows"]


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    try:
        requested = native_artifacts.normalize_bundles("windows", getattr(args, "bundles", None))
    except native_artifacts.NativeArtifactError as exc:
        logger.fail(str(exc))
        return 1
    if common.host_os() != "windows" and not dry_run:
        logger.fail("Windows build requires a Windows host. Use windows-cross-linux on Linux.")
        return 1
    previous = None
    if not dry_run:
        try:
            native_artifacts.prepare_outputs(
                "windows",
                requested,
                bundle_root=_bundle_root(),
                evidence_root=_evidence_root(),
                repository_root=paths.ROOT,
                clean_bundles=not bool(getattr(args, "no_clean", False)),
            )
            if getattr(args, "no_clean", False):
                previous = native_artifacts.snapshot_outputs("windows", requested, _bundle_root())
        except (native_artifacts.NativeArtifactError, OSError) as exc:
            logger.fail(f"Could not prepare Windows bundle outputs: {exc}")
            return 1
    bundles = ",".join(requested)
    command = common.tauri_cli_command(
        "build",
        "--target",
        "x86_64-pc-windows-msvc",
        "--bundles",
        bundles,
    )
    common.print_build_plan("windows", command, dry_run=dry_run, bundles=bundles)
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run)
    code = common.print_result(result, "Windows Tauri build completed", "Windows Tauri build failed")
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        try:
            verification, evidence = native_artifacts.verify_and_write(
                "windows",
                requested,
                bundle_root=_bundle_root(),
                repository_root=paths.ROOT,
                evidence_root=_evidence_root(),
                architecture="x86_64",
                previous_snapshot=previous,
            )
        except (native_artifacts.NativeArtifactError, OSError) as exc:
            logger.fail(f"Windows bundle verification failed: {exc}")
            return 1
        native_artifacts.log_verification(verification)
        if not verification.ok or evidence is None:
            return 1
        logger.ok(f"Windows bundle manifest: {evidence.manifest.relative_to(paths.ROOT)}")
        logger.ok(f"Windows bundle checksums: {evidence.checksums.relative_to(paths.ROOT)}")
        common.print_build_artifacts()
    return code


def _bundle_root():
    return native_artifacts.default_bundle_root("windows")


def _evidence_root():
    return paths.DIST_DIR / "windows"
