"""Real Linux desktop acceptance on a fresh, synthetic, disposable vault.

Requires native_desktop_support dependencies, a running X11/accessibility bus,
the release executable and the compiled native_offline_launcher.c. All product
actions use real accessibility/pointer/keyboard input; no IPC or filesystem mocks.
The harness creates its own fixture directory, preserves evidence and never opens
an existing user vault. See the P43 acceptance report for the tested environment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import native_desktop_support as gui
from native_fixture_image import make_source

ROOT = Path(__file__).resolve().parents[2]


def wait_until(predicate, message: str, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError(message)


def select_part(group: str, label: str):
    name = next(
        n.name
        for n in gui.nodes()
        if n.getRoleName() == "combo box" and n.name.startswith(group + ",")
    )
    gui.click(name, "combo box")
    dialog = gui.find(group + ": Teil auswählen", "dialog")
    name = next(
        n.name
        for n in gui.nodes(dialog)
        if n.getRoleName() == "toggle button" and n.name.startswith(label + " ")
    )
    gui.click(name, "toggle button")


def complete_cutout(vault: Path, evidence: Path):
    # Head and torso have been drawn through the real UI by the first stage.
    catalog = json.loads(
        (ROOT / "frontend/src/shared/image/sprite-parts.catalog.json").read_text()
    )
    groups = {g["id"]: g["label"] for g in catalog["groups"]}
    for part in catalog["parts"]:
        if not part["required"] or part["partId"] in {"head", "torso"}:
            continue
        select_part(groups[part["group"]], part["label"])
        gui.fill(
            "Begründung für „nicht vorhanden“",
            "Im synthetischen Zweiteilebild nicht vorhanden",
        )
        gui.click("Als nicht vorhanden markieren")
        print("Native cutout omission:", part["partId"], flush=True)
    gui.click("Ausgabe prüfen")
    gui.click("PNG-Teile jetzt erzeugen")
    verify_cutout(vault, evidence)


def verify_cutout(vault: Path, evidence: Path):
    manifest_path = vault / "Held/sprite.parts.json"
    wait_until(manifest_path.exists, "Native PNG generation did not publish a manifest")
    manifest = json.loads(manifest_path.read_text())
    assert len(manifest["parts"]) == 2
    assert manifest["complete"] is False
    masks = {
        p: json.loads((vault / f"Held/.masks/{p}.json").read_text())
        for p in ["head", "torso"]
    }
    indices = {
        p: {i for start, length in m["confirmed"] for i in range(start, start + length)}
        for p, m in masks.items()
    }
    assert len(indices["head"]) == 144
    assert len(indices["torso"]) == 280
    assert len(indices["head"] & indices["torso"]) == 45
    for part in manifest["parts"]:
        assert (
            hashlib.sha256((vault / "Held" / part["file"]).read_bytes()).hexdigest()
            == part["sha256"]
        )
    gui.screenshot(evidence / "p43-native-generated.png")
    print(
        "Native PNG generation: 2 exact parts; 45 overlapping source pixels; 13 explicit omissions",
        flush=True,
    )
    return manifest


def choose_vault(vault: Path):
    gui.click("Choose vault")
    chooser = gui.find("Choose a PixelCutoutSprite vault", "file chooser")
    gui.focus_window("Choose a PixelCutoutSprite vault")
    # GTK's Recent view does not navigate Location until a real folder is chosen.
    sidebar = next(
        n
        for n in gui.nodes(chooser)
        if n.name in {"workspace", "Home"} and n.getRoleName() == "label"
    )
    box = sidebar.queryComponent().getExtents(gui.pyatspi.DESKTOP_COORDS)
    gui.pyatspi.Registry.generateMouseEvent(
        box.x + box.width // 2, box.y + box.height // 2, "b1c"
    )
    gui.press("Control_L", "l")
    wait_until(
        lambda: any(
            "placeholder-text:Location" in n.getAttributes() for n in gui.nodes(chooser)
        ),
        "GTK Location entry missing",
    )
    location = next(
        n
        for n in gui.nodes(chooser)
        if "placeholder-text:Location" in n.getAttributes()
    )
    location.queryEditableText().setTextContents(str(vault) + "/")
    gui.press("Return")
    wait_until(
        (vault / ".PixelStudio/vault.json").exists, "Native vault initialization failed"
    )
    gui.focus_window()


def prompt_roundtrip(vault: Path, evidence: Path):
    gui.click("PixelPromptStudio Generator öffnen")
    gui.click("Profile")
    name = next(
        n.name
        for n in gui.nodes()
        if n.getRoleName() == "push button" and "Basisprofil anlegen" in n.name
    )
    gui.click(name)
    gui.find("Vault-Basisprofil anlegen", "dialog")
    gui.fill("Name", "P43 Offlinebasis")
    gui.click("Basisprofil speichern")
    basis = vault / ".PixelPrompt/basisprofil.json"
    wait_until(basis.exists, "Basis was not saved")
    assert "P43 Offlinebasis" in basis.read_text()
    gui.click("Wizard")
    gui.fill("Name des Assets", "P43 Kleif")
    gui.click("Charakter / Figur NPC · Held · Boss", "radio button")
    gui.click("Untertyp PFLICHTFELD", "combo box")
    gui.click("NPC", "menu item")
    gui.click("Weiter →")
    gui.find("Identität und Varianten", "heading")
    gui.click("Rolle / Beruf", "combo box")
    gui.click("Eigene Eingabe", "menu item")
    role = "Waldhueter mit ueberlappender Hand"
    gui.fill("Eigene Eingabe für Rolle / Beruf", role)
    gui.click("← Zurück")
    gui.find("Asset und Bildart", "heading")
    gui.click("Weiter →")
    assert (
        gui.find("Eigene Eingabe für Rolle / Beruf", "entry").queryText().getText(0, -1)
        == role
    )
    pages = []
    for _ in range(20):
        current = next(n.name for n in gui.nodes() if n.getRoleName() == "form")
        pages.append(current)
        print("Native wizard page:", current, flush=True)
        if current == "Prüfung":
            break
        gui.click("Weiter →")
        wait_until(
            lambda current=current: any(
                n.getRoleName() == "form" and n.name != current for n in gui.nodes()
            ),
            "Wizard page did not change",
        )
    else:
        raise AssertionError("Wizard did not reach review")
    gui.click("Schritt prüfen")
    folder = vault / ".PixelPrompt/Charakter/NPC/P43 Kleif"
    profile = folder / "P43 Kleif-profile.json"
    wait_until(
        lambda: (
            profile.exists()
            and len(list(folder.glob("*.md"))) == 16
            and '"fresh"' in profile.read_text()
        ),
        "Automatic prompt publication did not finish",
    )
    assert role in profile.read_text()
    gui.click("Dashboard")
    gui.click("Charakter / Figur: 1 Profile")
    gui.click("P43 Kleif laden")
    gui.find("Prüfung", "heading")
    assert (
        gui.find("Name des Assets", "entry").queryText().getText(0, -1) == "P43 Kleif"
    )
    # Inspect the actual restored input, not a possibly abbreviated review label.
    for _ in range(8):
        current = next(n.name for n in gui.nodes() if n.getRoleName() == "form")
        gui.click("← Zurück")
        wait_until(
            lambda current=current: any(
                n.getRoleName() == "form" and n.name != current for n in gui.nodes()
            ),
            "Restored wizard did not go back",
        )
    assert (
        gui.find("Eigene Eingabe für Rolle / Beruf", "entry").queryText().getText(0, -1)
        == role
    )
    gui.screenshot(evidence / "p43-native-prompt-loaded.png")
    print(
        "Native prompt: basis + paginated wizard + 16 automatic MDs + dashboard roundtrip",
        flush=True,
    )
    return {
        "pages": pages,
        "markdownFiles": 16,
        "profile": str(profile.relative_to(vault)),
    }


def mark_cutout(vault: Path, evidence: Path):
    original = make_source(vault / "Held.png")
    gui.click("PixelCutoutSprite Studio öffnen")
    gui.click("Dateien aktualisieren")
    gui.click("Held.png PNG")
    canvas = gui.find("Maskeneditor im Quellpixelraum", "image")
    canvas.queryComponent().grabFocus()
    time.sleep(0.3)
    box = canvas.queryComponent().getExtents(gui.pyatspi.DESKTOP_COORDS)
    scale = min(box.width / 32, box.height / 48)
    left, top = (
        box.x + (box.width - 32 * scale) / 2,
        box.y + (box.height - 48 * scale) / 2,
    )
    for x, y, action in [(4.1, 3.1, "b1p"), (15.9, 14.9, "b1r")]:
        gui.pyatspi.Registry.generateMouseEvent(
            round(left + x * scale), round(top + y * scale), "abs"
        )
        gui.pyatspi.Registry.generateMouseEvent(
            round(left + x * scale), round(top + y * scale), action
        )

    def saved_head_pixels():
        return any(
            sum(length for _, length in json.loads(p.read_text())["draft"]) == 144
            for p in (vault / ".PixelStudio/recovery/cutout").glob("*/.masks/head.json")
        )

    wait_until(
        saved_head_pixels, "Native pointer rectangle did not persist 144 source pixels"
    )
    gui.click("Auswahl bestätigen")
    select_part("Körper", "Torso")
    for name, value in [("X", "7"), ("Y", "10"), ("Breite", "14"), ("Höhe", "20")]:
        gui.fill(name, value)
    gui.click("Rechteck markieren")
    gui.click("Auswahl bestätigen")
    complete_cutout(vault, evidence)
    assert (vault / "Held.png").read_bytes() == original
    return hashlib.sha256(original).hexdigest()


def open_sprite():
    gui.click("PixelSpriteStudio öffnen")
    gui.click("Dateien aktualisieren")
    gui.click("Held Teile-Set · beim Öffnen prüfen")
    gui.find("Sprite-Kompositionseditor", "landmark")
    gui.click("View", "page tab")


def desktop_checks(vault: Path, evidence: Path):
    minimum = gui.minimum_window_size()
    assert minimum == (480, 360)
    sizes = []
    for width, height in [(480, 360), (960, 540)]:
        gui.resize_window(width, height)
        time.sleep(0.5)
        frame = gui.find("PixelCutoutSprite Studio", "frame")
        box = frame.queryComponent().getExtents(gui.pyatspi.DESKTOP_COORDS)
        assert (box.width, box.height) == (width, height)
        sizes.append([box.width, box.height])
        gui.click("Globale Einstellungen öffnen")
        dialog = gui.find("Globale Einstellungen", "dialog")
        gui.focus_window()
        for key in [("Tab",), ("Shift_L", "Tab")]:
            gui.press(*key)
            time.sleep(0.1)
            assert any(
                n.getState().contains(gui.pyatspi.STATE_FOCUSED)
                for n in gui.nodes(dialog)
            )
        gui.screenshot(evidence / f"p43-native-settings-{width}.png")
        gui.press("Escape")
        wait_until(
            lambda: (
                not any(
                    n.getRoleName() == "dialog" and n.name == "Globale Einstellungen"
                    for n in gui.nodes()
                )
            ),
            "Native Escape did not dismiss settings",
        )
    gui.resize_window(960, 720)
    time.sleep(0.4)
    field = gui.find("Position X", "entry")
    baseline_height = (
        field.queryComponent().getExtents(gui.pyatspi.DESKTOP_COORDS).height
    )
    gui.focus_window()
    for _ in range(5):
        gui.press("Control_L", "equal")
        time.sleep(0.15)
    time.sleep(0.4)
    zoom_height = (
        gui.find("Position X", "entry")
        .queryComponent()
        .getExtents(gui.pyatspi.DESKTOP_COORDS)
        .height
    )
    assert 1.8 <= zoom_height / baseline_height <= 2.2, (baseline_height, zoom_height)
    gui.click("Globale Einstellungen öffnen")
    dialog = gui.find("Globale Einstellungen", "dialog")
    box = dialog.queryComponent().getExtents(gui.pyatspi.DESKTOP_COORDS)
    assert (
        box.x >= 0
        and box.y >= 0
        and box.x + box.width <= 960
        and box.y + box.height <= 720
    )
    gui.screenshot(evidence / "p43-native-200-percent.png")
    gui.focus_window()
    gui.press("Escape")
    time.sleep(0.2)
    gui.press("Control_L", "0")
    gui.resize_window(1440, 900)
    time.sleep(0.4)
    print(
        "Native desktop: 480x360 minimum + resize, keyboard modal focus, real 200% WebKit hotkeys",
        flush=True,
    )

    # A real running org.freedesktop.FileManager1 implementation is required.
    gui.click("PixelPromptStudio Generator öffnen")
    gui.click("Dashboard")
    gui.click("Charakter / Figur: 1 Profile")
    gui.click("Profil-JSON im Dateimanager öffnen: P43 Kleif")

    def selected_file(suffix):
        for frame in gui.nodes():
            if frame.getRoleName() != "frame" or not frame.name.endswith(" - Thunar"):
                continue
            for node in gui.nodes(frame):
                if node.getRoleName() == "status bar" and suffix in node.name:
                    return frame.name, node.name
        return None

    wait_until(
        lambda: selected_file("P43 Kleif-profile.json"),
        "Real file manager did not select profile JSON",
    )
    json_selection = selected_file("P43 Kleif-profile.json")
    gui.screenshot(evidence / "p43-native-filemanager-json.png", json_selection[0])
    gui.focus_window()
    gui.click("Profilordner im Dateimanager öffnen: P43 Kleif")
    wait_until(
        lambda: selected_file('"P43 Kleif"'),
        "Real file manager did not select profile folder",
    )
    folder_selection = selected_file('"P43 Kleif"')
    gui.screenshot(evidence / "p43-native-filemanager-folder.png", folder_selection[0])
    gui.focus_window()
    # The file manager may display its window before the asynchronous reveal
    # receipt has re-enabled dialog dismissal. Wait for that real UI state.
    wait_until(
        lambda: (
            gui.find("Dialog schließen").getState().contains(gui.pyatspi.STATE_ENABLED)
        ),
        "Profile dialog remained busy after reveal",
    )
    gui.click("Dialog schließen")
    time.sleep(0.3)
    gui.click("Ausgabe")
    gui.click("MD im Dateimanager öffnen")
    wait_until(
        lambda: selected_file(".md"), "Real file manager did not select Markdown"
    )
    md_selection = selected_file(".md")
    gui.screenshot(evidence / "p43-native-filemanager-md.png", md_selection[0])
    gui.focus_window()
    print(
        "Native Linux file manager: JSON, folder and MD really selected in Thunar",
        flush=True,
    )
    return {
        "minimum": minimum,
        "sizes": sizes,
        "zoomInputHeight": [baseline_height, zoom_height],
        "fileManager": {
            "json": json_selection,
            "folder": folder_selection,
            "markdown": md_selection,
        },
    }


def scene_roundtrip(app: subprocess.Popen, launch, vault: Path, evidence: Path):
    open_sprite()
    gui.click("Torso nach vorn")
    gui.click("Torso sichtbar", "check box")
    gui.click("Torso sperren", "check box")
    gui.click("Kopf auswählen", "toggle button")
    gui.click("Freie Transformationen aktivieren", "check box")
    values = {
        "Position X": "23.25",
        "Position Y": "-5.5",
        "Pivot X": "0.25",
        "Pivot Y": "0.75",
        "Rotation in Grad": "90",
        "Skalierung X": "1.5",
        "Skalierung Y": "2",
    }
    for name, value in values.items():
        gui.fill(name, value)
    gui.click("Szene jetzt sichern")
    scene = vault / "Held/sprite.scene.json"
    wait_until(scene.exists, "Scene was not persisted")
    time.sleep(0.7)
    before = scene.read_bytes()
    gui.fill("Position X", "")
    gui.close_window()
    time.sleep(1)
    assert app.poll() is None, "Invalid numeric input must block native close"
    assert scene.read_bytes() == before
    gui.screenshot(evidence / "p43-native-invalid-close.png")
    gui.fill("Position X", "23.25")
    time.sleep(0.7)
    gui.fill("Position X", "42.25")
    # Prove the last edit was still pending, not merely a successful older autosave.
    assert json.loads(scene.read_text())["layers"][1]["position"]["x"] != 42.25
    gui.close_window()
    assert app.wait(timeout=20) == 0
    expected = json.loads(scene.read_text())
    assert expected["layers"][1]["position"]["x"] == 42.25
    print(
        "Native close: invalid input blocked; pending final edit flushed; exit 0",
        flush=True,
    )
    app = launch("reopen")
    gui.click(str(vault))
    open_sprite()
    gui.click("Kopf auswählen", "toggle button")
    values["Position X"] = "42.25"
    for name, value in values.items():
        assert gui.find(name, "entry").queryText().getText(0, -1) == value, name
    assert (
        not gui.find("Torso sichtbar", "check box")
        .getState()
        .contains(gui.pyatspi.STATE_CHECKED)
    )
    assert (
        gui.find("Torso sperren", "check box")
        .getState()
        .contains(gui.pyatspi.STATE_CHECKED)
    )
    assert json.loads(scene.read_text()) == expected
    gui.screenshot(evidence / "p43-native-scene-reopened.png")
    print(
        "Native restart: transforms, visibility, lock and scene revision restored",
        flush=True,
    )
    return app, expected


def run(args):
    evidence = args.evidence.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    fixture = Path(tempfile.mkdtemp(prefix="p43-native-roundtrip-", dir=evidence))
    vault = fixture / "vault"
    vault.mkdir()
    env = os.environ.copy()
    for key, folder in [
        ("XDG_CONFIG_HOME", "config"),
        ("XDG_DATA_HOME", "data"),
        ("XDG_CACHE_HOME", "cache"),
    ]:
        env[key] = str(fixture / folder)
    env.update(GIO_USE_VFS="local", GSETTINGS_BACKEND="memory")
    processes, logs = [], []
    result = {
        "status": "running",
        "fixture": str(fixture),
        "platform": "Linux",
        "executableSha256": hashlib.sha256(args.executable.read_bytes()).hexdigest(),
        "offline": "seccomp rejects IPv4/IPv6 socket creation; Unix IPC allowed",
    }

    def launch(label):
        log = (evidence / f"p43-native-{label}.log").open("x")
        logs.append(log)
        process = subprocess.Popen(
            [str(args.offline_launcher.resolve()), str(args.executable.resolve())],
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        processes.append(process)
        gui.find("PixelCutoutSprite Studio", "frame", timeout=30)
        gui.find("Choose vault", timeout=30)
        gui.focus_window()
        return process

    try:
        app = launch("start")
        choose_vault(vault)
        result["prompt"] = prompt_roundtrip(vault, evidence)
        result["originalPngSha256"] = mark_cutout(vault, evidence)
        assert len(list((vault / ".PixelPrompt").rglob("*-profile.json"))) == 1, (
            "Dashboard editing created a duplicate profile"
        )
        immutable = {
            str(p.relative_to(vault)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [
                vault / "Held.png",
                vault / "Held/sprite.parts.json",
                *sorted((vault / "Held").glob("*.png")),
            ]
        }
        app, result["sceneAfterRestart"] = scene_roundtrip(app, launch, vault, evidence)
        if args.desktop_checks:
            result["desktop"] = desktop_checks(vault, evidence)
        assert all(
            hashlib.sha256((vault / p).read_bytes()).hexdigest() == digest
            for p, digest in immutable.items()
        )
        result["unchangedSourceAndParts"] = immutable
        result["maskPixels"] = {"head": 144, "torso": 280, "overlap": 45}
        gui.close_window()
        assert app.wait(timeout=20) == 0
        result["nativeExits"] = [p.returncode for p in processes]
        result["status"] = "passed"
    except Exception as error:
        result.update(status="failed", error=f"{type(error).__name__}: {error}")
        try:
            gui.screenshot(evidence / "p43-native-failure.png")
        except (
            AssertionError,
            OSError,
            gui.GLib.Error,
            AttributeError,
        ) as screenshot_error:
            result["screenshotError"] = str(screenshot_error)
        raise
    finally:
        # Only this harness's child processes are stopped; fixtures are never deleted.
        for process in processes:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        for log in logs:
            log.close()
        (evidence / "p43-native-roundtrip.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        )
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--executable", type=Path, required=True)
    parser.add_argument("--offline-launcher", type=Path, required=True)
    parser.add_argument(
        "--desktop-checks",
        action="store_true",
        help="Also require a real Thunar file-manager service and verify native zoom/keyboard/resize",
    )
    args = parser.parse_args()
    if not args.executable.is_file() or not args.offline_launcher.is_file():
        parser.error("Existing native app and compiled offline launcher required")
    run(args)
