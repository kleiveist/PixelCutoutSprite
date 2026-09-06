from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import stat
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.ci_support import load_support_matrix
from tools.tauri import paths
from tools.tauri.build.artifacts import ArtifactFingerprint

PLATFORM_BUNDLE_ORDER = {
    "windows": ("nsis", "msi"),
    "macos": ("dmg",),
}
DEFAULT_BUNDLES = {
    "windows": "nsis",
    "macos": "dmg",
}
BUNDLE_PATTERNS = {
    ("windows", "nsis"): ("*.exe",),
    ("windows", "msi"): ("*.msi",),
    ("macos", "dmg"): ("*.dmg",),
}
MANIFEST_NAME = "native-bundles.json"
CHECKSUMS_NAME = "SHA256SUMS"


class NativeArtifactError(RuntimeError):
    """Raised when a native installer or its evidence is unsafe or incomplete."""


@dataclass(frozen=True, slots=True)
class NativeArtifact:
    bundle_type: str
    path: Path
    relative_path: str
    size: int
    sha256: str

    def as_manifest_entry(self) -> dict[str, str | int]:
        return {
            "type": self.bundle_type,
            "path": self.relative_path,
            "size": self.size,
            "sha256": self.sha256,
        }


@dataclass(frozen=True, slots=True)
class NativeVerification:
    target: str
    architecture: str
    requested: tuple[str, ...]
    artifacts: tuple[NativeArtifact, ...]
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True, slots=True)
class NativeEvidence:
    manifest: Path
    checksums: Path


def normalize_bundles(target: str, value: str | None) -> tuple[str, ...]:
    order = PLATFORM_BUNDLE_ORDER.get(target)
    if order is None:
        raise NativeArtifactError(f"Unsupported native artifact target: {target}.")
    raw = DEFAULT_BUNDLES[target] if value is None else value
    if not raw.strip():
        raise NativeArtifactError(f"{target} bundle list must not be empty.")
    parts = [item.strip().lower() for item in raw.split(",")]
    if any(not item for item in parts):
        raise NativeArtifactError(f"{target} bundle list contains an empty item.")
    unknown = sorted(set(parts) - set(order))
    if unknown:
        raise NativeArtifactError(
            f"Unsupported {target} bundle target(s): {', '.join(unknown)}. Allowed targets: {', '.join(order)}."
        )
    selected = set(parts)
    return tuple(bundle_type for bundle_type in order if bundle_type in selected)


def normalized_architecture(value: str | None = None) -> str:
    machine = (value or platform.machine()).casefold()
    if machine in {"amd64", "x86_64"}:
        return "x86_64"
    if machine in {"arm64", "aarch64"}:
        return "aarch64"
    raise NativeArtifactError(f"Unsupported native artifact architecture: {machine or 'unknown'}.")


def default_bundle_root(target: str) -> Path:
    root = paths.cargo_target_dir()
    if target == "windows":
        return root / "x86_64-pc-windows-msvc" / "release" / "bundle"
    if target == "macos":
        return root / "release" / "bundle"
    raise NativeArtifactError(f"Unsupported native artifact target: {target}.")


def prepare_outputs(
    target: str,
    requested: tuple[str, ...],
    *,
    bundle_root: Path,
    evidence_root: Path,
    repository_root: Path,
    clean_bundles: bool = True,
) -> None:
    requested = normalize_bundles(target, ",".join(requested))
    _validate_roots(target, bundle_root, evidence_root, repository_root)
    if clean_bundles:
        for bundle_type in requested:
            output = bundle_root / bundle_type
            if output.is_symlink():
                raise NativeArtifactError(f"Refusing symlinked {target} bundle directory: {output}")
            if output.exists() and not output.is_dir():
                raise NativeArtifactError(f"{target} bundle output is not a directory: {output}")
            if output.is_dir():
                shutil.rmtree(output)
    if evidence_root.is_dir():
        shutil.rmtree(evidence_root)


def snapshot_outputs(
    target: str,
    requested: tuple[str, ...],
    bundle_root: Path,
) -> dict[str, ArtifactFingerprint]:
    requested = normalize_bundles(target, ",".join(requested))
    snapshot: dict[str, ArtifactFingerprint] = {}
    for bundle_type in requested:
        output = bundle_root / bundle_type
        if output.is_symlink():
            continue
        for candidate in _candidates(target, bundle_type, output):
            try:
                details = candidate.lstat()
            except OSError:
                continue
            if candidate.is_symlink() or not stat.S_ISREG(details.st_mode):
                continue
            relative = candidate.relative_to(bundle_root).as_posix()
            snapshot[relative] = _fingerprint(candidate, details)
    return snapshot


def verify_bundles(
    target: str,
    requested: tuple[str, ...],
    bundle_root: Path,
    *,
    repository_root: Path,
    architecture: str | None = None,
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None = None,
) -> NativeVerification:
    requested = normalize_bundles(target, ",".join(requested))
    architecture = normalized_architecture(architecture)
    repository = repository_root.resolve()
    resolved_root = bundle_root.resolve()
    if not resolved_root.is_relative_to(repository):
        raise NativeArtifactError(f"{target} bundle root is outside the repository: {bundle_root}")
    _reject_symlinked_components(bundle_root, repository_root, f"{target} bundle root")
    _validate_bundle_configuration(repository_root)

    verified: list[NativeArtifact] = []
    errors: list[str] = []
    for bundle_type in requested:
        output = bundle_root / bundle_type
        if output.is_symlink() or not output.resolve().is_relative_to(resolved_root):
            errors.append(f"Requested {target} bundle '{bundle_type}' has an unsafe output directory: {output}")
            continue
        found = False
        for candidate in _candidates(target, bundle_type, output):
            artifact, error = _verify_candidate(
                target,
                bundle_type,
                candidate,
                output,
                bundle_root,
                repository,
                previous_snapshot,
            )
            if error:
                errors.append(error)
            elif artifact is not None:
                verified.append(artifact)
                found = True
        if not found and not any(f"'{bundle_type}'" in error for error in errors):
            errors.append(f"Requested {target} bundle '{bundle_type}' was not produced.")

    order = PLATFORM_BUNDLE_ORDER[target]
    verified.sort(key=lambda item: (order.index(item.bundle_type), item.relative_path))
    return NativeVerification(
        target=target,
        architecture=architecture,
        requested=requested,
        artifacts=tuple(verified),
        errors=tuple(errors),
    )


def write_evidence(
    result: NativeVerification,
    *,
    evidence_root: Path,
    repository_root: Path,
) -> NativeEvidence:
    if not result.ok:
        raise NativeArtifactError("Cannot write native bundle evidence for a failed verification.")
    _validate_evidence_root(result.target, evidence_root, repository_root)
    evidence_root.mkdir(parents=True, exist_ok=True)
    metadata = _product_metadata(repository_root)
    versions = load_support_matrix()
    payload = {
        "schema_version": 1,
        "product": metadata["productName"],
        "version": metadata["version"],
        "platform": result.target,
        "architecture": result.architecture,
        "artifact_scope": "unsigned-test-candidate",
        "release_signed": False,
        "user_vault_embedded": False,
        "toolchain": {
            "node": versions.node_primary,
            "npm": versions.npm_version,
            "rust": versions.rust_channel,
            "tauri_cli": versions.tauri_cli,
            "tauri_core": versions.tauri_core,
            "tauri_build": versions.tauri_build,
            "tauri_dialog": versions.tauri_dialog,
        },
        "bundles": [artifact.as_manifest_entry() for artifact in result.artifacts],
    }
    manifest = evidence_root / MANIFEST_NAME
    checksums = evidence_root / CHECKSUMS_NAME
    _write_text_atomically(manifest, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    _write_text_atomically(
        checksums,
        "".join(f"{item.sha256}  {item.relative_path}\n" for item in result.artifacts),
    )
    return NativeEvidence(manifest=manifest, checksums=checksums)


def verify_and_write(
    target: str,
    requested: tuple[str, ...],
    *,
    bundle_root: Path,
    repository_root: Path,
    evidence_root: Path,
    architecture: str | None = None,
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None = None,
) -> tuple[NativeVerification, NativeEvidence | None]:
    result = verify_bundles(
        target,
        requested,
        bundle_root,
        repository_root=repository_root,
        architecture=architecture,
        previous_snapshot=previous_snapshot,
    )
    if not result.ok:
        return result, None
    return result, write_evidence(result, evidence_root=evidence_root, repository_root=repository_root)


def render_summary(result: NativeVerification) -> str:
    if not result.ok:
        raise NativeArtifactError("Cannot render a native bundle summary for a failed verification.")
    lines = [
        f"## Unsigned {result.target} {result.architecture} test candidates",
        "",
        "| Format | Architecture | File | Size | SHA-256 |",
        "| --- | --- | --- | ---: | --- |",
    ]
    for artifact in result.artifacts:
        lines.append(
            f"| {artifact.bundle_type.upper()} | {result.architecture} | "
            f"`{artifact.relative_path}` | {artifact.size} | `{artifact.sha256}` |"
        )
    return "\n".join(lines) + "\n"


def log_verification(result: NativeVerification) -> None:
    logger.info(f"{result.target} native bundle verification")
    for artifact in result.artifacts:
        logger.ok(f"PASS {artifact.relative_path} ({artifact.size} bytes)")
    for error in result.errors:
        logger.fail(f"FAIL: {error}")


def _verify_candidate(
    target: str,
    bundle_type: str,
    candidate: Path,
    output: Path,
    bundle_root: Path,
    repository: Path,
    previous_snapshot: Mapping[str, ArtifactFingerprint] | None,
) -> tuple[NativeArtifact | None, str | None]:
    try:
        details = candidate.lstat()
    except OSError as exc:
        return None, f"{target} bundle could not be inspected: {candidate}: {exc}"
    resolved = candidate.resolve()
    if (
        candidate.is_symlink()
        or not stat.S_ISREG(details.st_mode)
        or not resolved.is_relative_to(output.resolve())
        or not resolved.is_relative_to(bundle_root.resolve())
    ):
        return None, f"{target} bundle is not a safe regular file: {candidate}"
    if details.st_size <= 0:
        return None, f"Requested {target} bundle '{bundle_type}' is empty: {candidate}"
    digest = _sha256(candidate)
    final_details = candidate.lstat()
    if _stat_identity(details) != _stat_identity(final_details):
        return None, f"Requested {target} bundle '{bundle_type}' changed during verification: {candidate}"
    relative_to_bundle = candidate.relative_to(bundle_root).as_posix()
    fingerprint = ArtifactFingerprint(
        final_details.st_size,
        final_details.st_mtime_ns,
        final_details.st_ctime_ns,
        digest,
    )
    if previous_snapshot is not None and previous_snapshot.get(relative_to_bundle) == fingerprint:
        return None, f"Requested {target} bundle '{bundle_type}' was not refreshed: {candidate}"
    return (
        NativeArtifact(
            bundle_type=bundle_type,
            path=candidate,
            relative_path=resolved.relative_to(repository).as_posix(),
            size=final_details.st_size,
            sha256=digest,
        ),
        None,
    )


def _candidates(target: str, bundle_type: str, output: Path) -> list[Path]:
    patterns = BUNDLE_PATTERNS[(target, bundle_type)]
    return sorted(
        {candidate for pattern in patterns for candidate in output.rglob(pattern)},
        key=lambda path: path.as_posix(),
    )


def _product_metadata(repository_root: Path) -> dict[str, object]:
    config = repository_root / "src-tauri" / "tauri.conf.json"
    try:
        payload = json.loads(config.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise NativeArtifactError(f"Could not read Tauri bundle configuration: {exc}") from exc
    if not isinstance(payload, dict):
        raise NativeArtifactError("Tauri bundle configuration must be a JSON object.")
    return payload


def _validate_bundle_configuration(repository_root: Path) -> None:
    payload = _product_metadata(repository_root)
    bundle = payload.get("bundle")
    if not isinstance(bundle, dict) or bundle.get("active") is not True:
        raise NativeArtifactError("Tauri bundling must be active before installer evidence is accepted.")
    for key in ("resources", "externalBin"):
        configured = bundle.get(key)
        if configured not in (None, [], {}):
            raise NativeArtifactError(
                f"Tauri bundle.{key} requires an explicit user-data and secret review before packaging."
            )
    for section, key in (("windows", "signCommand"), ("macOS", "signingIdentity")):
        settings = bundle.get(section)
        if isinstance(settings, dict) and settings.get(key) not in (None, ""):
            raise NativeArtifactError("P20 accepts only unsigned test candidates; release signing is separate.")


def _validate_roots(
    target: str,
    bundle_root: Path,
    evidence_root: Path,
    repository_root: Path,
) -> None:
    repository = repository_root.resolve()
    if bundle_root.parts[-2:] != ("release", "bundle"):
        raise NativeArtifactError(f"Refusing unsafe {target} bundle cleanup root: {bundle_root}")
    if evidence_root.parts[-2:] != ("desktop", target):
        raise NativeArtifactError(f"Refusing unsafe {target} evidence cleanup root: {evidence_root}")
    if not bundle_root.resolve().is_relative_to(repository):
        raise NativeArtifactError(f"{target} bundle cleanup root is outside the repository: {bundle_root}")
    if not evidence_root.resolve().is_relative_to(repository):
        raise NativeArtifactError(f"{target} evidence cleanup root is outside the repository: {evidence_root}")
    _reject_symlinked_components(bundle_root, repository_root, f"{target} bundle cleanup root")
    _reject_symlinked_components(evidence_root, repository_root, f"{target} evidence cleanup root")
    if evidence_root.exists() and not evidence_root.is_dir():
        raise NativeArtifactError(f"{target} evidence output is not a directory: {evidence_root}")


def _validate_evidence_root(target: str, evidence_root: Path, repository_root: Path) -> None:
    if evidence_root.exists() and not evidence_root.is_dir():
        raise NativeArtifactError(f"{target} evidence output is not a directory: {evidence_root}")
    if evidence_root.parts[-2:] != ("desktop", target):
        raise NativeArtifactError(f"Refusing unsafe {target} evidence output root: {evidence_root}")
    if not evidence_root.resolve().is_relative_to(repository_root.resolve()):
        raise NativeArtifactError(f"{target} evidence output is outside the repository: {evidence_root}")
    _reject_symlinked_components(evidence_root, repository_root, f"{target} evidence output root")


def _reject_symlinked_components(path: Path, repository_root: Path, label: str) -> None:
    repository = Path(os.path.abspath(repository_root))
    target = Path(os.path.abspath(path))
    try:
        relative = target.relative_to(repository)
    except ValueError as exc:
        raise NativeArtifactError(f"{label} is outside the repository: {path}") from exc
    current = repository
    for component in relative.parts:
        current /= component
        if current.is_symlink():
            raise NativeArtifactError(f"Refusing symlinked component in {label}: {current}")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fingerprint(path: Path, details: os.stat_result) -> ArtifactFingerprint:
    return ArtifactFingerprint(
        details.st_size,
        details.st_mtime_ns,
        details.st_ctime_ns,
        _sha256(path),
    )


def _stat_identity(details: os.stat_result) -> tuple[int, int, int]:
    return details.st_size, details.st_mtime_ns, details.st_ctime_ns


def _write_text_atomically(path: Path, content: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        temporary.chmod(0o644)
        temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
