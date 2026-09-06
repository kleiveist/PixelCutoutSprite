"""Final negative-architecture contracts for PixelCutoutSprite Studio (P22)."""

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
    cargo = tomllib.loads((ROOT / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8"))
    frontend = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
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
    frontend = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    node_dependencies = _dependency_names(
        frontend["dependencies"] | frontend["devDependencies"]
    )
    config = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
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
        (ROOT / "src-tauri" / "capabilities" / "default.json").read_text(encoding="utf-8")
    )

    assert capability["windows"] == ["main"]
    assert capability["permissions"] == ["core:default", "dialog:allow-open"]
    assert all("shell" not in permission for permission in capability["permissions"])


def test_exporter_emits_sprite_only_godot_resources_without_a_rig() -> None:
    exporter = (ROOT / "src-tauri" / "src" / "exports" / "godot.rs").read_text(
        encoding="utf-8"
    )

    assert 'type=\\\"Node2D\\\"' in exporter
    assert 'type=\\\"AnimatedSprite2D\\\"' in exporter
    for forbidden_node in ("Bone2D", "MeshInstance2D", "Polygon2D", "Skeleton2D"):
        assert f'type=\\\"{forbidden_node}\\\"' not in exporter
    assert "script = ExtResource" not in exporter
