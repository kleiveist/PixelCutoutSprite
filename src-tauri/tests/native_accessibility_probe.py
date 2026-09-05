#!/usr/bin/env python3
"""Inspect a running PixelCutoutSprite WebView through the real AT-SPI bus."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from collections import Counter
from dataclasses import dataclass

ACCESSIBLE = "org.a11y.atspi.Accessible"
ACTION = "org.a11y.atspi.Action"
COMPONENT = "org.a11y.atspi.Component"
PROPERTIES = "org.freedesktop.DBus.Properties"
REGISTRY = "org.a11y.atspi.Registry"
ROOT = "/org/a11y/atspi/accessible/root"
DEVICE = "/org/a11y/atspi/registry/deviceeventcontroller"
PAIR = re.compile(r"\('([^']+)', (?:objectpath )?'([^']+)'\)")
FRAME_PROBE = re.compile(
    r"P19_FRAME_PROBE samples=(?P<samples>\d+) "
    r"viewport=(?P<width>\d+)x(?P<height>\d+) "
    r"dpr=(?P<dpr>[0-9.]+) "
    r"p50=(?P<p50>[0-9.]+)ms p95=(?P<p95>[0-9.]+)ms max=(?P<maximum>[0-9.]+)ms"
)


@dataclass(frozen=True)
class Reference:
    destination: str
    path: str


@dataclass
class Node:
    reference: Reference
    name: str
    role: str
    interfaces: list[str]
    states: list[int]
    extents: tuple[int, int, int, int] | None

    def has_state(self, state: int) -> bool:
        word = state // 32
        bit = state % 32
        return word < len(self.states) and bool(self.states[word] & (1 << bit))


def call(
    address: str, destination: str, path: str, method: str, *arguments: str
) -> str:
    command = [
        "gdbus",
        "call",
        "--address",
        address,
        "--dest",
        destination,
        "--object-path",
        path,
        "--method",
        method,
        *arguments,
    ]
    return subprocess.run(
        command, check=True, capture_output=True, text=True
    ).stdout.strip()


def references(value: str) -> list[Reference]:
    return [Reference(destination, path) for destination, path in PAIR.findall(value)]


def quoted(value: str) -> str:
    matches = re.findall(r"'((?:\\'|[^'])*)'", value)
    return matches[-1].replace("\\'", "'") if matches else ""


def children(address: str, reference: Reference) -> list[Reference]:
    try:
        return references(
            call(
                address,
                reference.destination,
                reference.path,
                f"{ACCESSIBLE}.GetChildren",
            )
        )
    except subprocess.CalledProcessError:
        return []


def property_value(address: str, reference: Reference, name: str) -> str:
    try:
        return call(
            address,
            reference.destination,
            reference.path,
            f"{PROPERTIES}.Get",
            ACCESSIBLE,
            name,
        )
    except subprocess.CalledProcessError:
        return ""


def inspect_node(address: str, reference: Reference) -> Node | None:
    try:
        role = quoted(
            call(
                address,
                reference.destination,
                reference.path,
                f"{ACCESSIBLE}.GetRoleName",
            )
        )
        interface_output = call(
            address,
            reference.destination,
            reference.path,
            f"{ACCESSIBLE}.GetInterfaces",
        )
        interfaces = re.findall(r"'([^']+)'", interface_output)
        state_output = call(
            address, reference.destination, reference.path, f"{ACCESSIBLE}.GetState"
        )
    except subprocess.CalledProcessError:
        return None
    states = [int(value) for value in re.findall(r"(?:uint32 )?(\d+)", state_output)]
    extents = None
    if COMPONENT in interfaces:
        try:
            values = re.findall(
                r"-?\d+",
                call(
                    address,
                    reference.destination,
                    reference.path,
                    f"{COMPONENT}.GetExtents",
                    "0",
                ),
            )
            if len(values) >= 4:
                extents = tuple(int(value) for value in values[-4:])
        except subprocess.CalledProcessError:
            pass
    return Node(
        reference=reference,
        name=quoted(property_value(address, reference, "Name")),
        role=role,
        interfaces=interfaces,
        states=states,
        extents=extents,
    )


def find_application(address: str, target: str) -> Reference:
    registry_root = Reference(REGISTRY, ROOT)
    for reference in children(address, registry_root):
        if (
            target.casefold()
            in quoted(property_value(address, reference, "Name")).casefold()
        ):
            return reference
    raise RuntimeError(f"AT-SPI application containing {target!r} was not found")


def walk(address: str, root: Reference, limit: int = 2000) -> list[Node]:
    pending = [root]
    visited: set[Reference] = set()
    nodes: list[Node] = []
    while pending and len(visited) < limit:
        reference = pending.pop(0)
        if reference in visited:
            continue
        visited.add(reference)
        node = inspect_node(address, reference)
        if node is None:
            continue
        nodes.append(node)
        pending.extend(children(address, reference))
    if pending:
        raise RuntimeError(f"AT-SPI tree exceeded the safety limit of {limit} nodes")
    return nodes


def focused_node(address: str, nodes: list[Node]) -> Node | None:
    focused: list[Node] = []
    for node in nodes:
        refreshed = inspect_node(address, node.reference)
        if refreshed is not None and refreshed.has_state(12):
            focused.append(refreshed)
    return next(
        (
            node
            for node in focused
            if node.name.strip() and "org.a11y.atspi.Hyperlink" in node.interfaces
        ),
        next(
            (node for node in focused if node.name.strip()),
            focused[0] if focused else None,
        ),
    )


def activate_named(address: str, nodes: list[Node], query: str) -> Node:
    candidates = [
        node
        for node in nodes
        if ACTION in node.interfaces
        and node.has_state(11)
        and query.casefold() in node.name.casefold()
    ]
    matches = [node for node in candidates if node.has_state(25)]
    if not matches and len(candidates) == 1 and COMPONENT in candidates[0].interfaces:
        selected = candidates[0]
        scrolled = call(
            address,
            selected.reference.destination,
            selected.reference.path,
            f"{COMPONENT}.ScrollTo",
            "6",
        )
        if "true" in scrolled.casefold():
            time.sleep(0.2)
            refreshed = inspect_node(address, selected.reference)
            if refreshed is not None and refreshed.has_state(25):
                matches = [refreshed]
    if len(matches) != 1:
        names = sorted({node.name for node in candidates})
        raise RuntimeError(
            f"activation query {query!r} matched {len(matches)} showing actions "
            f"from {len(candidates)} focusable candidates: {names}"
        )
    selected = matches[0]
    outcome = call(
        address,
        selected.reference.destination,
        selected.reference.path,
        f"{ACTION}.DoAction",
        "0",
    )
    if "true" not in outcome.casefold():
        raise RuntimeError(f"AT-SPI action {query!r} was rejected: {outcome}")
    return selected


def tab_sequence(address: str, nodes: list[Node], count: int) -> list[str]:
    sequence: list[str] = []
    focusable = [node for node in nodes if node.has_state(11)]
    for _ in range(count):
        call(
            address,
            REGISTRY,
            DEVICE,
            "org.a11y.atspi.DeviceEventController.GenerateKeyboardEvent",
            "65289",
            "''",
            "3",
        )
        time.sleep(0.08)
        focused = focused_node(address, focusable)
        sequence.append(f"{focused.role}:{focused.name}" if focused else "unreported")
    return sequence


def frame_probe(nodes: list[Node]) -> dict[str, int | float] | None:
    for node in nodes:
        match = FRAME_PROBE.search(node.name)
        if match:
            return {
                "samples": int(match.group("samples")),
                "viewport_width": int(match.group("width")),
                "viewport_height": int(match.group("height")),
                "dpr": float(match.group("dpr")),
                "p50_ms": float(match.group("p50")),
                "p95_ms": float(match.group("p95")),
                "max_ms": float(match.group("maximum")),
            }
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default="pixel-cutout-sprite-studio")
    parser.add_argument("--expected-width", type=int, required=True)
    parser.add_argument("--expected-height", type=int, required=True)
    parser.add_argument("--tabs", type=int, default=12)
    parser.add_argument("--require", action="append", default=[])
    parser.add_argument("--require-action", action="append", default=[])
    parser.add_argument("--activate", action="append", default=[])
    parser.add_argument("--settle-seconds", type=float, default=1.0)
    parser.add_argument("--probe-viewport")
    parser.add_argument("--probe-dpr", type=float)
    parser.add_argument("--maximum-p95-ms", type=float)
    parser.add_argument("--require-focus")
    parser.add_argument("--require-keyboard-synthesis", action="store_true")
    parser.add_argument("--summary-only", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    arguments = parser.parse_args()
    address = os.environ.get("AT_SPI_BUS_ADDRESS")
    if not address:
        raise RuntimeError("AT_SPI_BUS_ADDRESS is required")

    application = find_application(address, arguments.target)
    nodes = walk(address, application)
    activated: list[str] = []
    for query in arguments.activate:
        selected = activate_named(address, nodes, query)
        activated.append(selected.name)
        time.sleep(arguments.settle_seconds)
        application = find_application(address, arguments.target)
        nodes = walk(address, application)
    interactive = [
        node
        for node in nodes
        if node.has_state(11)
        and ACTION in node.interfaces
        and (
            "org.a11y.atspi.Hyperlink" in node.interfaces
            or node.role
            in {
                "button",
                "push button",
                "toggle button",
                "combo box",
                "entry",
                "link",
                "check box",
                "radio button",
                "slider",
            }
        )
    ]
    frames = [
        node for node in nodes if node.role in {"frame", "window"} and node.extents
    ]
    window = (
        max(frames, key=lambda node: node.extents[2] * node.extents[3])
        if frames
        else None
    )
    documents = [
        node
        for node in nodes
        if "org.a11y.atspi.Document" in node.interfaces and node.extents
    ]
    surface = (
        max(documents, key=lambda node: node.extents[2] * node.extents[3])
        if documents
        else window
    )
    issues: list[str] = []
    if surface is None:
        issues.append("no accessible application surface exposes screen extents")
    else:
        x, y, width, height = surface.extents
        minimum_content_height = max(1, arguments.expected_height - 64)
        if (
            width != arguments.expected_width
            or height < minimum_content_height
            or height > arguments.expected_height
        ):
            issues.append(
                f"content is {width}x{height}; expected width {arguments.expected_width} "
                f"and height {minimum_content_height}..{arguments.expected_height}"
            )
        for node in interactive:
            if not node.has_state(25) or node.extents is None:
                continue
            item_x, item_y, item_width, item_height = node.extents
            if item_width <= 0 or item_height <= 0:
                issues.append(f"showing {node.role} {node.name!r} has empty extents")
            elif not (
                item_x >= x
                and item_y >= y
                and item_x + item_width <= x + width
                and item_y + item_height <= y + height
            ):
                issues.append(
                    f"showing {node.role} {node.name!r} is clipped outside the window"
                )
    for node in interactive:
        if node.has_state(25) and not node.name.strip():
            issues.append(f"showing {node.role} has no accessible name")
    names = [node.name for node in nodes]
    for required in arguments.require:
        if not any(required.casefold() in name.casefold() for name in names):
            issues.append(f"required accessible text {required!r} is absent")
    for required in arguments.require_action:
        matches = [
            node
            for node in interactive
            if node.has_state(25)
            and node.extents is not None
            and node.extents[2] > 0
            and node.extents[3] > 0
            and required.casefold() in node.name.casefold()
        ]
        if not matches:
            issues.append(
                f"required visible, focusable action {required!r} is absent"
            )

    measured_frame_probe = frame_probe(nodes)
    if arguments.probe_viewport:
        expected = re.fullmatch(r"(\d+)x(\d+)", arguments.probe_viewport)
        if expected is None:
            raise RuntimeError("--probe-viewport must use WIDTHxHEIGHT")
        if measured_frame_probe is None:
            issues.append("completed P19 frame probe is absent")
        else:
            expected_viewport = (int(expected.group(1)), int(expected.group(2)))
            measured_viewport = (
                measured_frame_probe["viewport_width"],
                measured_frame_probe["viewport_height"],
            )
            if measured_viewport != expected_viewport:
                issues.append(
                    f"frame probe viewport is {measured_viewport[0]}x{measured_viewport[1]}, "
                    f"expected {expected_viewport[0]}x{expected_viewport[1]}"
                )
    if arguments.probe_dpr is not None:
        if measured_frame_probe is None:
            issues.append("completed P19 frame probe is absent")
        elif abs(float(measured_frame_probe["dpr"]) - arguments.probe_dpr) > 0.01:
            issues.append(
                f"frame probe DPR is {measured_frame_probe['dpr']}, expected {arguments.probe_dpr}"
            )
    if arguments.maximum_p95_ms is not None:
        if measured_frame_probe is None:
            issues.append("completed P19 frame probe is absent")
        elif float(measured_frame_probe["p95_ms"]) > arguments.maximum_p95_ms:
            issues.append(
                f"frame probe p95 is {measured_frame_probe['p95_ms']} ms, "
                f"above {arguments.maximum_p95_ms} ms"
            )

    current_focus = (
        focused_node(address, nodes)
        if arguments.require_focus or arguments.tabs > 0
        else None
    )
    if arguments.require_focus and (
        current_focus is None
        or arguments.require_focus.casefold() not in current_focus.name.casefold()
    ):
        description = "unreported" if current_focus is None else current_focus.name
        issues.append(
            f"focused control is {description!r}, expected {arguments.require_focus!r}"
        )

    sequence = tab_sequence(address, nodes, arguments.tabs)
    reported = [item for item in sequence if item != "unreported"]
    if arguments.require_keyboard_synthesis and len(set(reported)) < 2:
        issues.append("Tab traversal did not report at least two distinct controls")
    result = {
        "status": "PASS" if not issues else "FAIL",
        "application": arguments.target,
        "node_count": len(nodes),
        "interactive_count": len(interactive),
        "roles": dict(sorted(Counter(node.role for node in nodes).items())),
        "window_extents": window.extents if window else None,
        "window_title": window.name if window else None,
        "content_extents": surface.extents if surface else None,
        "activated": activated,
        "required_actions": arguments.require_action,
        "tab_sequence": sequence,
        "focused_node": (
            {"name": current_focus.name, "role": current_focus.role}
            if current_focus is not None
            else None
        ),
        "keyboard_synthesis": "observed" if reported else "unavailable",
        "frame_probe": measured_frame_probe,
        "issues": sorted(set(issues)),
    }
    if not arguments.summary_only:
        result["interactive_nodes"] = [
            {
                "name": node.name,
                "role": node.role,
                "extents": node.extents,
                "reference": node.reference.path,
            }
            for node in interactive
        ]
    if arguments.verbose:
        result["named_nodes"] = [
            {
                "name": node.name,
                "role": node.role,
                "states": node.states,
                "interfaces": node.interfaces,
                "extents": node.extents,
                "reference": [node.reference.destination, node.reference.path],
            }
            for node in nodes
            if node.name
        ]
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
