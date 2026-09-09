#!/usr/bin/env python3
"""Prüft das Planpaket, NICHT die zu implementierende Desktop-App.

Aufruf: python pruefung/validate_package.py
Zusätzlich benötigt: das Python-Paket jsonschema (Draft 2020-12).
Liest nur Dateien; schreibt oder verändert nichts. Bild-Platzhalter werden
bewusst nicht als existente, geprüfte PNGs behandelt.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def unique(values: list[Any], label: str) -> None:
    ensure(len(values) == len(set(values)), f"Doppelte Werte: {label}")


def inside(path: Path) -> Path:
    resolved = path.resolve()
    ensure(resolved.is_relative_to(ROOT), f"Pfad außerhalb des Pakets: {path}")
    return resolved


def check_parts(data: dict[str, Any], catalog: dict[str, Any]) -> None:
    entries = {item["partId"]: item for item in catalog["parts"]}
    required = {key for key, value in entries.items() if value["required"]}
    parts = data["parts"]
    ids = [part["partId"] for part in parts]
    unique(ids, "Manifest-Part-IDs")
    unique([part["file"] for part in parts], "Manifest-Dateinamen")
    unique([part["defaultZ"] for part in parts], "Default-Z-Werte")
    ensure(set(ids) <= entries.keys(), "Unbekannte Part-ID")
    for choices in catalog["exclusiveChoices"]:
        ensure(len(set(ids) & set(choices)) <= 1, "Exklusive Extras gleichzeitig")
    omitted = [item["partId"] for item in data["omittedParts"]]
    unique(omitted, "Ausgelassene Teile")
    ensure(not (set(omitted) & set(ids)), "Teil zugleich vorhanden und ausgelassen")
    ensure(set(omitted) <= required, "Nur Pflichtteile müssen als fehlend begründet werden")
    ensure(required <= (set(ids) | set(omitted)), "Unbegründet fehlendes Pflichtteil")
    if data["complete"]:
        ensure(required <= set(ids) and not omitted, "Vollständigkeit unzutreffend")
    source = data["source"]
    ensure(source["width"] * source["height"] <= 16_777_216, "Pixelbudget überschritten")
    for part in parts:
        ensure(part["file"] == entries[part["partId"]]["file"], "Falscher Standarddateiname")
        rect, pivot, pos = part["sourceRect"], part["pivot"], part["defaultPosition"]
        ensure(rect["x"] >= 0 and rect["y"] >= 0, "Negative Quellkoordinate")
        ensure(rect["width"] > 0 and rect["height"] > 0, "Leeres Quellrechteck")
        ensure(rect["x"] + rect["width"] <= source["width"], "Ausschnitt rechts außerhalb")
        ensure(rect["y"] + rect["height"] <= source["height"], "Ausschnitt unten außerhalb")
        ensure(0 <= pivot["x"] <= rect["width"] and 0 <= pivot["y"] <= rect["height"], "Pivot außerhalb")
        ensure(pos["x"] == rect["x"] + pivot["x"] and pos["y"] == rect["y"] + pivot["y"], "Pivotformel verletzt")
        ensure(part["parentId"] is None or part["parentId"] in ids, "Fehlender Parent")
    parents = {part["partId"]: part["parentId"] for part in parts}
    for part_id in ids:
        seen: set[str] = set()
        cursor: str | None = part_id
        while cursor is not None:
            ensure(cursor not in seen, "Zyklischer Parent-Graph")
            seen.add(cursor)
            cursor = parents[cursor]


def check_scene(scene: dict[str, Any], manifest: dict[str, Any]) -> None:
    ensure(scene["setId"] == manifest["setId"], "Szene referenziert falsches Set")
    ensure(scene["generationId"] == manifest["generationId"], "Szene referenziert falsche Generation")
    ids = [layer["partId"] for layer in scene["layers"]]
    unique(ids, "Szenen-Layer-IDs")
    unique([layer["zIndex"] for layer in scene["layers"]], "Szenen-Z-Werte")
    ensure(set(ids) == {part["partId"] for part in manifest["parts"]}, "Szenen-/Manifest-Teile weichen ab")


def rejected(action: Any, label: str) -> None:
    try:
        action()
    except ValueError:
        return
    raise ValueError(f"Negativprobe wurde nicht abgelehnt: {label}")


def run() -> dict[str, int]:
    try:
        from jsonschema import Draft202012Validator, FormatChecker
    except ImportError:
        raise RuntimeError("Paketprüfung nicht vollständig möglich: Python-Paket jsonschema fehlt.") from None

    all_files = [p for p in ROOT.rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    json_files = [p for p in all_files if p.suffix == ".json"]
    for path in json_files:
        read_json(path)
    schema_files = sorted((ROOT / "vertraege").glob("*.schema.json"))
    ensure(len(schema_files) == 8, "Erwartet werden acht Schemafamilien")
    validators: dict[str, Any] = {}
    for path in schema_files:
        schema = read_json(path)
        Draft202012Validator.check_schema(schema)
        kind = schema["properties"]["kind"]["const"]
        ensure(kind not in validators, "Doppelte Schema-kind")
        validators[kind] = Draft202012Validator(schema, format_checker=FormatChecker())
    examples = sorted((ROOT / "beispiele").rglob("*.json"))
    for path in examples:
        data = read_json(path)
        ensure(data.get("kind") in validators, f"Kein Schema für {path}")
        errors = sorted(validators[data["kind"]].iter_errors(data), key=lambda e: str(e.path))
        ensure(not errors, f"Schemafehler in {path.relative_to(ROOT)}: {[e.message for e in errors]}")

    phases = read_json(ROOT / "vertraege/phasen.json")
    requirements = read_json(ROOT / "vertraege/anforderungen.json")
    tests = read_json(ROOT / "vertraege/tests.json")
    phase_ids = [phase["id"] for phase in phases]
    ensure(phase_ids == [f"P{i}" for i in range(28, 44)], "Phasenfolge nicht P28–P43")
    test_ids = [test["id"] for test in tests]
    unique(test_ids, "Test-IDs")
    unique([req["id"] for req in requirements], "Anforderungs-IDs")
    for phase in phases:
        ensure(inside(ROOT / phase["prompt"]).is_file(), "Fehlender Phasen-Prompt")
        ensure(set(phase["dependsOn"]) <= set(phase_ids[:phase_ids.index(phase["id"])]), "Zyklische/fehlende Phasenvoraussetzung")
    for req in requirements:
        ensure(bool(req["phases"]) and set(req["phases"]) <= set(phase_ids), "Anforderung ohne gültige Phase")
        ensure(bool(req["tests"]) and set(req["tests"]) <= set(test_ids), "Anforderung ohne gültigen Test")
    ensure(set(test_ids) <= {t for req in requirements for t in req["tests"]}, "Test ohne Anforderungsbezug")

    checked_links = 0
    for path in [p for p in all_files if p.suffix == ".md"]:
        text = path.read_text(encoding="utf-8")
        ensure("\ufffd" not in text, f"Unicode-Ersatzzeichen in {path}")
        for target in re.findall(r"\[[^\]\n]+\]\(([^)]+)\)", text):
            target = target.strip().split("#", 1)[0]
            if not target or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target):
                continue
            ensure(inside(path.parent / target).exists(), f"Toter lokaler Link: {path}: {target}")
            checked_links += 1

    catalog = read_json(ROOT / "vertraege/sprite-parts.catalog.json")
    ensure(len(catalog["groups"]) == 6, "Nicht sechs Körpergruppen")
    ensure(all(len(group["slots"]) == 3 for group in catalog["groups"]), "Nicht drei Slots je Gruppe")
    ensure(len([p for p in catalog["parts"] if p["required"]]) == 15, "Nicht 15 Pflichtteile")
    type_catalog = read_json(ROOT / "vertraege/type-catalog.json")
    ensure(len(type_catalog["categories"]) == 9, "Nicht neun Typen")
    unique([cat["id"] for cat in type_catalog["categories"]], "Kategorie-IDs")
    unique([cat["folder"].casefold() for cat in type_catalog["categories"]], "Kategorie-Pfade")

    vault = ROOT / "beispiele/VaultProjekt1"
    sprite_dir = vault / "Bilder/Kleif"
    manifest = read_json(sprite_dir / "sprite.parts.json")
    scene = read_json(sprite_dir / "sprite.scene.json")
    cutout = read_json(sprite_dir / "cutout.project.json")
    check_parts(manifest, catalog)
    check_scene(scene, manifest)
    manifest_by_id = {part["partId"]: part for part in manifest["parts"]}
    for layer in scene["layers"]:
        part = manifest_by_id[layer["partId"]]
        ensure(layer["position"] == part["defaultPosition"] and layer["pivot"] == part["pivot"], "Beispiel-Originalanordnung inkonsistent")
    ensure(cutout["source"] == manifest["source"], "Cutout-/Manifest-Quellen inkonsistent")
    ensure(cutout["revision"] == manifest["cutoutRevision"], "Cutout-Revision inkonsistent")
    ensure({part["partId"] for part in cutout["parts"]} == set(manifest_by_id), "Cutout-Masken unvollständig")
    profile_dir = vault / ".PixelPrompt/Charakter/Held/Kleif"
    profile = read_json(profile_dir / "Kleif-profile.json")
    base = read_json(vault / ".PixelPrompt/basisprofil.json")
    ensure(profile["baseProfileId"] == base["id"], "Profil-/Basisreferenz inkonsistent")
    ensure(profile["folderName"] == profile_dir.name, "Profilordner falsch")
    ensure(profile["status"] == "incomplete" and profile["outputs"]["status"] == "stale", "Beispiel muss seine Unvollständigkeit offenlegen")
    ensure(profile["outputs"]["generatedFrom"]["draftRevision"] < profile["draftRevision"], "Beispielrevisionen nicht konsistent veraltet")
    ensure({file["part"] for file in profile["outputs"]["files"]} == {"main", "negative", "technical", "combined"}, "Nicht alle vier Ausgabearten")
    for file in profile["outputs"]["files"]:
        data = inside(profile_dir / file["relativePath"]).read_bytes()
        ensure(hashlib.sha256(data).hexdigest() == file["sha256"], "Falscher echter MD-Dateihash")

    negative_probes = 0
    def schema_reject(data: dict[str, Any], label: str) -> None:
        nonlocal negative_probes
        ensure(not validators[data["kind"]].is_valid(data), f"Negative Schema-Probe akzeptiert: {label}")
        negative_probes += 1

    bad = read_json(ROOT / "beispiele/Geraet/global-settings.json")
    bad["profiles"] = []
    schema_reject(bad, "Zentrale Profile in UI-Settings")
    bad = copy.deepcopy(profile); bad["schemaVersion"] = 999
    schema_reject(bad, "Unbekannte Schema-Version")
    bad = copy.deepcopy(profile); bad["status"] = "ready"; bad["baseProfileId"] = None
    schema_reject(bad, "Fertiges Profil ohne Basis")
    for path in ("../outside.png", "/tmp/outside.png", "C:\\outside.png", "folder/../outside.png"):
        bad = copy.deepcopy(manifest); bad["parts"][0]["file"] = path
        schema_reject(bad, "Unsicherer relativer Pfad")
    bad = copy.deepcopy(manifest); bad["parts"][0]["sourceRect"]["x"] = 9999
    rejected(lambda: check_parts(bad, catalog), "Ausschnitt außerhalb"); negative_probes += 1
    bad = copy.deepcopy(manifest); bad["parts"][0]["defaultPosition"]["x"] += 1
    rejected(lambda: check_parts(bad, catalog), "Falsche Pivotformel"); negative_probes += 1
    bad = copy.deepcopy(manifest); bad["parts"][0]["parentId"] = bad["parts"][0]["partId"]
    rejected(lambda: check_parts(bad, catalog), "Parent-Zyklus"); negative_probes += 1
    bad = copy.deepcopy(manifest); bad["parts"].append(copy.deepcopy(bad["parts"][0]))
    rejected(lambda: check_parts(bad, catalog), "Doppelte Teile"); negative_probes += 1
    bad = copy.deepcopy(manifest); bad["parts"] = [p for p in bad["parts"] if p["partId"] != "head"]
    rejected(lambda: check_parts(bad, catalog), "Fehlendes Pflichtteil"); negative_probes += 1
    bad = copy.deepcopy(manifest)
    sword = copy.deepcopy(next(p for p in bad["parts"] if p["partId"] == "belt_accessory"))
    sword.update(partId="sword", file="17_sword.png", defaultZ=99)
    bad["parts"].append(sword)
    rejected(lambda: check_parts(bad, catalog), "Gürtel und Schwert gleichzeitig"); negative_probes += 1
    bad = copy.deepcopy(scene); bad["generationId"] = "wrong_generation"
    rejected(lambda: check_scene(bad, manifest), "Falsche Szenengeneration"); negative_probes += 1

    checksum_count = 0
    checksum_path = ROOT / "SHA256SUMS.txt"
    if checksum_path.is_file():
        for line in checksum_path.read_text(encoding="utf-8").splitlines():
            if not line:
                continue
            checksum, relative = line.split("  ", 1)
            path = inside(ROOT / relative)
            ensure(path.is_file(), f"Fehlende Datei in Hashliste: {relative}")
            ensure(hashlib.sha256(path.read_bytes()).hexdigest() == checksum, f"Paket-Hashabweichung: {relative}")
            checksum_count += 1

    return {"json_dateien": len(json_files), "schemas": len(schema_files), "validierte_beispiele": len(examples),
            "phasen": len(phases), "anforderungen": len(requirements), "geplante_abnahmetests": len(tests),
            "lokale_markdown_links": checked_links, "negative_paketproben": negative_probes,
            "echte_md_hashes": len(profile["outputs"]["files"]), "gepruefte_pakethashes": checksum_count}


def main() -> int:
    try:
        result = run()
    except Exception as exc:
        print(f"PAKETPRÜFUNG FEHLGESCHLAGEN: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "bestanden", "umfang": "Planpaket, keine App-Ausführung", **result}, ensure_ascii=False, indent=2))
    print("Nicht geprüft: echte PNGs/Masken, Segmentierungsqualität, Desktop-Build oder App-Laufzeit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
