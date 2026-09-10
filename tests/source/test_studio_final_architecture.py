"""Shared P22 architecture contracts and P37 Cutout-removal evidence."""

from __future__ import annotations

import json
import re
from pathlib import Path

import tomllib

ROOT = Path(__file__).resolve().parents[2]


def _dependency_names(table: dict[str, object]) -> set[str]:
    return {name.replace("_", "-").lower() for name in table}


def _rust_product_sources() -> str:
    return "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted((ROOT / "src-tauri" / "src").rglob("*.rs"))
    )


def test_studio_has_no_database_or_python_runtime() -> None:
    cargo = tomllib.loads(
        (ROOT / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")
    )
    frontend = json.loads(
        (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    )
    rust_dependencies = _dependency_names(cargo["dependencies"])
    node_dependencies = _dependency_names(
        frontend["dependencies"] | frontend["devDependencies"]
    )

    assert rust_dependencies.isdisjoint(
        {
            "diesel",
            "mongodb",
            "mysql",
            "postgres",
            "pyo3",
            "rusqlite",
            "sea-orm",
            "sqlx",
        }
    )
    assert node_dependencies.isdisjoint(
        {
            "better-sqlite3",
            "mysql",
            "pg",
            "prisma",
            "python-shell",
            "sequelize",
            "sqlite3",
        }
    )

    sources = _rust_product_sources()
    for forbidden in (
        r"std::process::Command",
        r"tokio::process",
        r"tauri_plugin_shell",
        r"\.sidecar\s*\(",
        r"Command::new\s*\(\s*[\"']python",
    ):
        assert re.search(forbidden, sources, re.IGNORECASE) is None


def test_studio_has_only_native_desktop_distribution_targets() -> None:
    frontend = json.loads(
        (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    )
    node_dependencies = _dependency_names(
        frontend["dependencies"] | frontend["devDependencies"]
    )
    config = json.loads(
        (ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8")
    )
    bundle = config["bundle"]

    assert config["build"]["frontendDist"] == "../frontend/dist"
    assert bundle["active"] is True
    assert not any(key in bundle for key in ("externalBin", "resources"))
    assert node_dependencies.isdisjoint(
        {
            "@capacitor/core",
            "electron",
            "expo",
            "next",
            "nuxt",
            "react-native",
            "vite-plugin-pwa",
        }
    )
    for product_directory in ("android", "ios", "mobile", "web"):
        assert not (ROOT / product_directory).exists()
        assert not (ROOT / "src-tauri" / product_directory).exists()


def test_desktop_capability_cannot_spawn_sidecars_or_shells() -> None:
    capability = json.loads(
        (ROOT / "src-tauri" / "capabilities" / "default.json").read_text(
            encoding="utf-8"
        )
    )

    assert capability["windows"] == ["main"]
    # Native close is deliberately delayed until the shared save queue flushes.
    assert capability["permissions"] == [
        "core:default",
        "dialog:allow-open",
        "core:window:allow-destroy",
        "core:webview:allow-set-webview-zoom",
    ]
    assert all("shell" not in permission for permission in capability["permissions"])


def test_p37_removes_legacy_product_sources_and_imports() -> None:
    """RQ-37/38's retired exporter is replaced by R-C01 removal evidence."""
    retired_frontend = {
        "features/projects",
        "features/areas",
        "features/animations",
        "features/dummy-editor",
        "features/outfit",
        "features/npcs",
        "features/inventory",
        "features/export",
        "features/directions",
        "features/timeline",
        "domain",
    }
    for directory in retired_frontend:
        assert not list((ROOT / "frontend/src" / directory).glob("**/*.*")), directory
    for directory in (
        "animation",
        "asset_io",
        "directions",
        "editor",
        "exports",
        "render",
    ):
        assert not list((ROOT / "src-tauri/src" / directory).glob("**/*.rs")), directory
    for name in ("project", "area", "motion", "npc", "outfit", "asset", "export"):
        assert not (ROOT / "frontend/src/api" / f"{name}-client.ts").exists()
    assert not (ROOT / "frontend/src/styles/projects.css").exists()
    forbidden = re.compile(
        r"features/(projects|areas|animations|dummy-editor|outfit|npcs|inventory|export|timeline)"
        r"|api/(project|area|motion|npc|outfit|asset|export)-client"
        r"|PromptHandoff|handoff_prompt_to_area"
    )
    for path in (ROOT / "frontend/src").rglob("*"):
        if path.suffix not in {".ts", ".tsx"} or ".test." in path.name:
            continue
        assert forbidden.search(path.read_text(encoding="utf-8")) is None, path
    app = (ROOT / "frontend/src/app/App.tsx").read_text(encoding="utf-8")
    assert "CutoutStudio" in app
    cutout = (ROOT / "frontend/src/cutout-studio/CutoutStudio.tsx").read_text(
        encoding="utf-8"
    )
    assert "CutoutWelcome" in cutout
    assert "ModuleNavigationRow" in app
    assert "DataFolderWorkspace" in app
    handler = (ROOT / "src-tauri/src/lib.rs").read_text(encoding="utf-8")
    registered = set(re.findall(r"commands::(\w+),", handler))
    assert {
        "open_vault",
        "list_workspace_entries",
        "save_prompt_vault_draft",
    } <= registered
    for command in registered:
        if command == "save_cutout_project":
            continue  # P38's mask document is not the retired generic project workflow.
        assert (
            re.search(r"project|area|motion|npc|outfit|export|handoff|example", command)
            is None
        )
