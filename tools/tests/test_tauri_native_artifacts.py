from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pytest

from tools.tauri import paths, smoke
from tools.tauri.build import native_artifacts


def _config(root: Path, *, resources: list[str] | None = None) -> None:
    tauri = root / "src-tauri"
    tauri.mkdir(parents=True, exist_ok=True)
    bundle: dict[str, object] = {"active": True, "targets": "all"}
    if resources is not None:
        bundle["resources"] = resources
    (tauri / "tauri.conf.json").write_text(
        json.dumps(
            {
                "productName": "PixelCutoutSprite Studio",
                "version": "0.1.0",
                "bundle": bundle,
            }
        ),
        encoding="utf-8",
    )


def _bundle_root(root: Path, target: str) -> Path:
    cargo = root / "src-tauri" / "target"
    if target == "windows":
        return cargo / "x86_64-pc-windows-msvc" / "release" / "bundle"
    return cargo / "release" / "bundle"


@pytest.mark.parametrize(
    ("target", "raw", "expected"),
    [
        ("windows", None, ("nsis",)),
        ("windows", " MSI,nsis,nsis ", ("nsis", "msi")),
        ("macos", None, ("dmg",)),
        ("macos", "DMG", ("dmg",)),
    ],
)
def test_native_bundle_lists_are_normalized(
    target: str,
    raw: str | None,
    expected: tuple[str, ...],
) -> None:
    assert native_artifacts.normalize_bundles(target, raw) == expected


@pytest.mark.parametrize(
    ("target", "raw"),
    [
        ("windows", ""),
        ("windows", "nsis,"),
        ("windows", "exe"),
        ("macos", "app"),
        ("linux", "deb"),
    ],
)
def test_native_bundle_lists_reject_unsafe_or_unsupported_values(target: str, raw: str) -> None:
    with pytest.raises(native_artifacts.NativeArtifactError):
        native_artifacts.normalize_bundles(target, raw)


@pytest.mark.parametrize(
    ("target", "bundle_type", "filename"),
    [
        ("windows", "nsis", "PixelCutoutSprite_0.1.0_x64-setup.exe"),
        ("windows", "msi", "PixelCutoutSprite_0.1.0_x64_en-US.msi"),
        ("macos", "dmg", "PixelCutoutSprite_0.1.0_x64.dmg"),
    ],
)
def test_native_bundle_manifest_is_hashed_pinned_and_contains_no_absolute_path(
    tmp_path: Path,
    target: str,
    bundle_type: str,
    filename: str,
) -> None:
    _config(tmp_path)
    source = _bundle_root(tmp_path, target) / bundle_type / filename
    source.parent.mkdir(parents=True)
    source.write_bytes(b"native-installer")
    result = native_artifacts.verify_bundles(
        target,
        (bundle_type,),
        _bundle_root(tmp_path, target),
        repository_root=tmp_path,
        architecture="x86_64",
    )

    assert result.ok
    evidence = native_artifacts.write_evidence(
        result,
        evidence_root=tmp_path / ".dist" / "desktop" / target,
        repository_root=tmp_path,
    )
    payload = json.loads(evidence.manifest.read_text(encoding="utf-8"))
    entry = payload["bundles"][0]
    assert payload["artifact_scope"] == "unsigned-test-candidate"
    assert payload["release_signed"] is False
    assert payload["user_vault_embedded"] is False
    assert payload["toolchain"] == {
        "node": "24.19.0",
        "npm": "11.17.0",
        "rust": "1.97.1",
        "tauri_cli": "2.10.1",
        "tauri_core": "2.11.5",
        "tauri_build": "2.6.3",
        "tauri_dialog": "2.7.3",
    }
    assert entry["sha256"] == hashlib.sha256(b"native-installer").hexdigest()
    assert str(tmp_path) not in evidence.manifest.read_text(encoding="utf-8")
    assert evidence.checksums.read_text(encoding="utf-8") == (f"{entry['sha256']}  {entry['path']}\n")


def test_native_bundle_verification_rejects_configured_external_resources(tmp_path: Path) -> None:
    _config(tmp_path, resources=["../vault"])
    source = _bundle_root(tmp_path, "windows") / "nsis" / "setup.exe"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"installer")

    with pytest.raises(native_artifacts.NativeArtifactError, match="user-data and secret review"):
        native_artifacts.verify_bundles(
            "windows",
            ("nsis",),
            _bundle_root(tmp_path, "windows"),
            repository_root=tmp_path,
        )


def test_native_bundle_verification_rejects_unchanged_no_clean_output(tmp_path: Path) -> None:
    _config(tmp_path)
    root = _bundle_root(tmp_path, "macos")
    source = root / "dmg" / "studio.dmg"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"stale")
    snapshot = native_artifacts.snapshot_outputs("macos", ("dmg",), root)

    result = native_artifacts.verify_bundles(
        "macos",
        ("dmg",),
        root,
        repository_root=tmp_path,
        previous_snapshot=snapshot,
    )

    assert not result.ok
    assert any("was not refreshed" in error for error in result.errors)


def test_native_output_preparation_removes_only_requested_generated_directories(tmp_path: Path) -> None:
    _config(tmp_path)
    root = _bundle_root(tmp_path, "windows")
    nsis = root / "nsis" / "old.exe"
    msi = root / "msi" / "keep.msi"
    cache = root.parent / "deps" / "keep.rlib"
    for file in (nsis, msi, cache):
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(b"generated")

    native_artifacts.prepare_outputs(
        "windows",
        ("nsis",),
        bundle_root=root,
        evidence_root=tmp_path / ".dist" / "desktop" / "windows",
        repository_root=tmp_path,
    )

    assert not nsis.exists()
    assert msi.read_bytes() == b"generated"
    assert cache.read_bytes() == b"generated"


class _RunningProcess:
    def __init__(self) -> None:
        self.returncode = None

    def poll(self):
        return self.returncode

    def terminate(self) -> None:
        self.returncode = 0

    def kill(self) -> None:
        self.returncode = -9

    def communicate(self, timeout=None):
        return "", ""


def test_native_smoke_uses_isolated_state_and_writes_bounded_evidence(
    monkeypatch,
    tmp_path: Path,
) -> None:
    executable = tmp_path / "studio"
    executable.write_bytes(b"executable")
    executable.chmod(0o755)
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "DIST_DIR", tmp_path / ".dist" / "desktop")
    monkeypatch.setattr(smoke, "native_artifacts_target_for_host", lambda: "linux")
    monkeypatch.setattr(smoke.subprocess, "Popen", lambda *_args, **_kwargs: _RunningProcess())
    monkeypatch.setattr(smoke, "POLL_SECONDS", 0.001)

    code = smoke.main(argparse.Namespace(target="linux", executable=str(executable), startup_seconds=1.0))

    assert code == 0
    payload = json.loads((tmp_path / ".dist/desktop/linux/native-start-smoke.json").read_text(encoding="utf-8"))
    assert payload["status"] == "PASS"
    assert payload["source"] == "explicit-executable"
    assert payload["isolated_user_state"] is True


def test_native_smoke_refuses_executable_outside_repository(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside-native-smoke"
    outside.write_bytes(b"outside")
    outside.chmod(0o755)
    with (
        pytest.raises(smoke.NativeSmokeError, match="safe regular file"),
        smoke.launch_target("linux", str(outside)),
    ):
        pass
