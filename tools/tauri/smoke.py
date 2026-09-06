from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.config import is_server_only_name
from tools.process import prepare_command
from tools.tauri import paths

STARTUP_SECONDS = 3.0
POLL_SECONDS = 0.1


class NativeSmokeError(RuntimeError):
    """Raised when an installer payload cannot complete the bounded start smoke."""


@dataclass(frozen=True, slots=True)
class LaunchTarget:
    executable: Path
    source: str
    artifact: str


def main(args: argparse.Namespace) -> int:
    target = getattr(args, "target", None)
    if target not in {"linux", "windows", "macos"}:
        logger.fail(f"Unsupported native smoke target: {target!r}.")
        return 1
    seconds = float(getattr(args, "startup_seconds", STARTUP_SECONDS))
    if not 1.0 <= seconds <= 30.0:
        logger.fail("Native smoke startup seconds must stay within 1..=30.")
        return 1
    if target != native_artifacts_target_for_host():
        logger.fail(f"Native {target} smoke must run on a {target} host.")
        return 1

    try:
        with launch_target(target, getattr(args, "executable", None)) as selected:
            result = run_start_smoke(selected, target=target, startup_seconds=seconds)
            evidence = write_evidence(result, target=target)
    except (NativeSmokeError, OSError, subprocess.SubprocessError) as exc:
        logger.fail(f"Native {target} start smoke failed: {exc}")
        return 1
    logger.ok(f"Native {target} installer payload stayed alive for {seconds:.1f} seconds")
    logger.ok(f"Native start evidence: {evidence.relative_to(paths.ROOT)}")
    return 0


def native_artifacts_target_for_host() -> str:
    import platform

    return {"linux": "linux", "windows": "windows", "darwin": "macos"}.get(platform.system().casefold(), "unsupported")


@contextmanager
def launch_target(target: str, explicit: str | None = None) -> Iterator[LaunchTarget]:
    if explicit:
        executable = _safe_executable(Path(explicit), paths.ROOT)
        yield LaunchTarget(executable, "explicit-executable", _relative(executable))
        return
    if target == "linux":
        with _linux_deb_target() as selected:
            yield selected
        return
    if target == "windows":
        executable = _safe_executable(
            paths.cargo_target_dir() / "x86_64-pc-windows-msvc" / "release" / "pixel-cutout-sprite-studio.exe",
            paths.ROOT,
        )
        yield LaunchTarget(executable, "windows-build-output", _relative(executable))
        return
    if target == "macos":
        bundle_dir = paths.cargo_target_dir() / "release" / "bundle" / "macos"
        candidates = sorted(
            (
                path
                for app in bundle_dir.glob("*.app")
                for path in (app / "Contents" / "MacOS").iterdir()
                if path.is_file()
            ),
            key=lambda path: path.as_posix(),
        )
        if len(candidates) != 1:
            raise NativeSmokeError(f"Expected one macOS app executable, found {len(candidates)}.")
        executable = _safe_executable(candidates[0], paths.ROOT)
        yield LaunchTarget(executable, "macos-app-bundle", _relative(executable))
        return
    raise NativeSmokeError(f"Unsupported native smoke target: {target}.")


@contextmanager
def _linux_deb_target() -> Iterator[LaunchTarget]:
    bundle_root = paths.cargo_target_dir() / "release" / "bundle" / "deb"
    candidates = sorted(bundle_root.rglob("*.deb"), key=lambda path: path.as_posix())
    if len(candidates) != 1:
        raise NativeSmokeError(f"Expected one Linux DEB installer, found {len(candidates)}.")
    bundle = _safe_regular_file(candidates[0], paths.ROOT)
    with tempfile.TemporaryDirectory(prefix="pixelcutoutsprite-p20-deb-") as temporary:
        root = Path(temporary)
        completed = subprocess.run(
            prepare_command(["dpkg-deb", "--extract", str(bundle), str(root)]),
            cwd=paths.ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip()
            raise NativeSmokeError(f"Could not extract DEB installer: {detail}")
        executable = _safe_executable(root / "usr" / "bin" / "pixel-cutout-sprite-studio", root)
        yield LaunchTarget(executable, "linux-deb-payload", _relative(bundle))


def run_start_smoke(
    selected: LaunchTarget,
    *,
    target: str,
    startup_seconds: float,
) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="pixelcutoutsprite-p20-home-") as temporary:
        private_root = Path(temporary)
        runtime = private_root / "runtime"
        runtime.mkdir(mode=0o700)
        environment = {
            name: value
            for name, value in os.environ.items()
            if not is_server_only_name(name)
            and name
            not in {
                "GH_CONFIG_DIR",
                "GITHUB_TOKEN",
                "GH_TOKEN",
                "TAURI_SIGNING_PRIVATE_KEY",
                "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
            }
        }
        environment.update(
            {
                "HOME": str(private_root / "home"),
                "XDG_CACHE_HOME": str(private_root / "cache"),
                "XDG_CONFIG_HOME": str(private_root / "config"),
                "XDG_DATA_HOME": str(private_root / "data"),
                "XDG_RUNTIME_DIR": str(runtime),
            }
        )
        for directory in ("home", "cache", "config", "data"):
            (private_root / directory).mkdir()
        started = time.monotonic()
        process = subprocess.Popen(
            prepare_command([str(selected.executable)]),
            cwd=paths.ROOT,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        deadline = started + startup_seconds
        while time.monotonic() < deadline:
            returncode = process.poll()
            if returncode is not None:
                stdout, stderr = process.communicate(timeout=1)
                raise NativeSmokeError(f"process exited early with code {returncode}: {_tail(stderr or stdout)}")
            time.sleep(POLL_SECONDS)
        process.terminate()
        try:
            process.communicate(timeout=5)
            stop = "terminated"
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate(timeout=5)
            stop = "killed-after-timeout"
        elapsed = time.monotonic() - started
    return {
        "schema_version": 1,
        "status": "PASS",
        "platform": target,
        "source": selected.source,
        "artifact": selected.artifact,
        "startup_seconds": round(startup_seconds, 3),
        "observed_seconds": round(elapsed, 3),
        "stop": stop,
        "isolated_user_state": True,
    }


def write_evidence(payload: dict[str, object], *, target: str) -> Path:
    evidence_root = paths.DIST_DIR / target
    if evidence_root.parts[-2:] != ("desktop", target):
        raise NativeSmokeError(f"Refusing unsafe native smoke evidence root: {evidence_root}")
    if not evidence_root.resolve().is_relative_to(paths.ROOT.resolve()):
        raise NativeSmokeError(f"Native smoke evidence root is outside the repository: {evidence_root}")
    evidence_root.mkdir(parents=True, exist_ok=True)
    output = evidence_root / "native-start-smoke.json"
    descriptor, temporary_name = tempfile.mkstemp(prefix=".native-start-", suffix=".tmp", dir=evidence_root)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(payload, indent=2, sort_keys=True) + "\n")
        temporary.chmod(0o644)
        temporary.replace(output)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    return output


def _safe_regular_file(path: Path, root: Path) -> Path:
    if path.is_symlink():
        raise NativeSmokeError(f"Refusing symlinked native smoke input: {path}")
    try:
        details = path.lstat()
    except OSError as exc:
        raise NativeSmokeError(f"Native smoke input is unavailable: {path}: {exc}") from exc
    resolved = path.resolve()
    if not stat.S_ISREG(details.st_mode) or not resolved.is_relative_to(root.resolve()):
        raise NativeSmokeError(f"Native smoke input is not a safe regular file: {path}")
    if details.st_size <= 0:
        raise NativeSmokeError(f"Native smoke input is empty: {path}")
    return resolved


def _safe_executable(path: Path, root: Path) -> Path:
    resolved = _safe_regular_file(path, root)
    if os.name != "nt" and not os.access(resolved, os.X_OK):
        raise NativeSmokeError(f"Native smoke input is not executable: {path}")
    return resolved


def _relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(paths.ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def _tail(value: str, limit: int = 6) -> str:
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    return " | ".join(lines[-limit:]) if lines else "no process output"
