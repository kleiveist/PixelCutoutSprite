"""Source contracts for P20 desktop packaging and Codespaces support."""

from __future__ import annotations

import json
import re
from pathlib import Path

import tomllib

from tools.ci_support import load_support_matrix

ROOT = Path(__file__).resolve().parents[2]


def _cargo_versions() -> dict[str, str]:
    payload = tomllib.loads((ROOT / "src-tauri" / "Cargo.lock").read_text(encoding="utf-8"))
    return {
        package["name"]: package["version"]
        for package in payload["package"]
        if package["name"] in {"tauri", "tauri-build", "tauri-plugin-dialog"}
    }


def test_desktop_toolchain_versions_are_exact_and_cross_language_aligned() -> None:
    support = load_support_matrix()
    frontend = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    frontend_lock = json.loads((ROOT / "frontend" / "package-lock.json").read_text(encoding="utf-8"))
    rust_toolchain = tomllib.loads((ROOT / "rust-toolchain.toml").read_text(encoding="utf-8"))

    assert (ROOT / ".node-version").read_text(encoding="utf-8").strip() == (support.node_primary)
    assert frontend["packageManager"] == f"npm@{support.npm_version}"
    assert frontend["engines"] == {
        "node": support.node_primary,
        "npm": support.npm_version,
    }
    assert frontend["devDependencies"]["@tauri-apps/cli"] == support.tauri_cli
    assert frontend["dependencies"]["@tauri-apps/plugin-dialog"] == (support.tauri_dialog)
    assert frontend_lock["packages"][""]["dependencies"]["@tauri-apps/plugin-dialog"] == support.tauri_dialog
    assert rust_toolchain["toolchain"] == {
        "channel": support.rust_channel,
        "components": ["clippy", "rustfmt"],
        "profile": "minimal",
    }
    assert _cargo_versions() == {
        "tauri": support.tauri_core,
        "tauri-build": support.tauri_build,
        "tauri-plugin-dialog": support.tauri_dialog,
    }


def test_tauri_bundles_are_active_without_vault_or_external_payloads() -> None:
    config = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    bundle = config["bundle"]

    assert bundle["active"] is True
    assert bundle["targets"] == "all"
    assert bundle["icon"] == [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico",
    ]
    assert not any(key in bundle for key in ("resources", "externalBin"))
    assert "updater" not in config.get("plugins", {})


def test_studio_ci_builds_and_starts_each_unsigned_native_candidate() -> None:
    workflow = (ROOT / ".github/workflows/ci-studio.yml").read_text(encoding="utf-8")

    assert "fromJSON(needs.support-matrix.outputs.os_matrix)" in workflow
    for target, bundle in (("linux", "deb"), ("windows", "nsis"), ("macos", "dmg")):
        assert f"tauri build --target {target} --bundles {bundle}" in workflow
        assert f"tauri smoke --target {target}" in workflow
    assert "authoritative_npc_export_renders_multiple_actions" in workflow
    assert "Verify native dialog adapter contract" in workflow
    assert "npm-version: ${{ needs.support-matrix.outputs.npm_version }}" in workflow
    assert "git diff --exit-code HEAD --" in workflow
    assert workflow.count("libdbus-1-dev") == 2
    assert "contents: read" in workflow
    assert "retention-days: 7" in workflow
    assert not re.search(r"\bgh\s+release\b|\bgit\s+push\b|\btauri\s+signer\b", workflow)
    assert "contents: write" not in workflow


def test_devcontainer_is_pinned_and_does_not_claim_a_web_preview() -> None:
    dockerfile = (ROOT / ".devcontainer" / "Dockerfile").read_text(encoding="utf-8")
    config = json.loads((ROOT / ".devcontainer" / "devcontainer.json").read_text(encoding="utf-8"))
    guidance = (ROOT / ".devcontainer" / "README.md").read_text(encoding="utf-8")
    support = load_support_matrix()

    assert re.search(r"^FROM .+@sha256:[0-9a-f]{64}$", dockerfile, re.MULTILINE)
    assert config["build"]["args"] == {
        "NODE_VERSION": support.node_primary,
        "NPM_VERSION": support.npm_version,
        "RUST_VERSION": support.rust_channel,
    }
    assert config["remoteUser"] == "vscode"
    assert "libdbus-1-dev" in dockerfile
    assert "forwardPorts" not in config
    assert "keine native Windows-, Linux- oder macOS-Desktop-Sitzung" in guidance
    assert "gilt weder als Webprodukt noch als native GUI-Abnahme" in guidance
    assert "Veröffentlichung, Tagging und Push" in guidance
