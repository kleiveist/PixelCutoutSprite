"""Linux AT-SPI/X11 helpers for the real, unmodified Tauri WebView.

No invoke interception, DOM script evaluation or fabricated native responses.
Requires python3-pyatspi, python3-gi, an X11 display and a session accessibility bus.
"""

from __future__ import annotations

import ctypes as c
import time
from pathlib import Path

import gi
import pyatspi

gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib


def nodes(root=None):
    queue = [root or pyatspi.Registry.getDesktop(0)]
    count = 0
    while queue and count < 10000:
        node = queue.pop(0)
        count += 1
        if node is None:
            continue
        try:
            if node.getState().contains(pyatspi.STATE_DEFUNCT):
                continue
            yield node
            queue.extend(node.getChildAtIndex(i) for i in range(node.childCount))
        except GLib.Error:
            # Accessible objects can disappear between two IPC calls on navigation.
            continue


def find(name: str, role: str | None = None, timeout: float = 10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for node in nodes():
            try:
                matches = node.name == name or (
                    role == "entry" and node.name.startswith(name + " ")
                )
                if matches and (role is None or node.getRoleName() == role):
                    return node
            except gi.repository.GLib.Error:
                continue
        time.sleep(0.1)
    raise AssertionError(f"Native accessible not found: {role} {name!r}")


def click(name: str, role: str | None = None):
    node = find(name, role)
    if not node.getState().contains(pyatspi.STATE_ENABLED):
        raise AssertionError(f"Native control is disabled: {name}")
    node.queryComponent().grabFocus()
    # WebKit's accessible click synthesizes pointer input. Let focus scrolling
    # and dialog entrance layout settle before dispatching that real action.
    time.sleep(0.2)
    if not node.queryAction().doAction(0):
        raise AssertionError(f"Native action rejected: {name}")
    return node


def fill(name: str, value: str):
    node = find(name, "entry")
    focus_window()
    if not node.queryComponent().grabFocus():
        raise AssertionError(f"Native field focus rejected: {name}")
    press("Control_L", "a")
    if value:
        pyatspi.Registry.generateKeyboardEvent(0, value, pyatspi.KEY_STRING)
    else:
        press("BackSpace")
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if node.queryText().getText(0, -1) == value:
            return node
        time.sleep(0.05)
    raise AssertionError(
        f"Native input did not settle: {name}: {node.queryText().getText(0, -1)!r}"
    )


def screenshot(path: Path, title="PixelCutoutSprite Studio"):
    frame = find(title, "frame")
    box = frame.queryComponent().getExtents(pyatspi.DESKTOP_COORDS)
    pixbuf = Gdk.pixbuf_get_from_window(
        Gdk.get_default_root_window(), box.x, box.y, box.width, box.height
    )
    pixbuf.savev(str(path), "png", [], [])


def press(*key_names: str):
    x = c.CDLL("libX11.so.6")
    xt = c.CDLL("libXtst.so.6")
    x.XOpenDisplay.argtypes, x.XOpenDisplay.restype = [c.c_char_p], c.c_void_p
    x.XStringToKeysym.argtypes, x.XStringToKeysym.restype = [c.c_char_p], c.c_ulong
    x.XKeysymToKeycode.argtypes, x.XKeysymToKeycode.restype = (
        [c.c_void_p, c.c_ulong],
        c.c_ubyte,
    )
    x.XFlush.argtypes = [c.c_void_p]
    x.XCloseDisplay.argtypes = [c.c_void_p]
    xt.XTestFakeKeyEvent.argtypes = [c.c_void_p, c.c_uint, c.c_int, c.c_ulong]
    display = x.XOpenDisplay(None)
    assert display
    try:
        codes = [
            x.XKeysymToKeycode(display, x.XStringToKeysym(name.encode()))
            for name in key_names
        ]
        assert all(codes), key_names
        for code in codes:
            xt.XTestFakeKeyEvent(display, code, 1, 0)
        for code in reversed(codes):
            xt.XTestFakeKeyEvent(display, code, 0, 0)
        x.XFlush(display)
    finally:
        x.XCloseDisplay(display)


def close_window():
    """Send the same WM_DELETE_WINDOW protocol as a window-manager close button."""
    _window_action("PixelCutoutSprite Studio", close=True)


def focus_window(title="PixelCutoutSprite Studio"):
    """Activate a real X11 window, including on Xvfb without a window manager."""
    _window_action(title, close=False)


def resize_window(width: int, height: int):
    _window_action("PixelCutoutSprite Studio", close=False, size=(width, height))


def minimum_window_size():
    return _window_action("PixelCutoutSprite Studio", close=False, minimum=True)


def _window_action(title: str, *, close: bool, size=None, minimum=False):
    x = c.CDLL("libX11.so.6")
    ptr, window = c.c_void_p, c.c_ulong
    x.XOpenDisplay.argtypes, x.XOpenDisplay.restype = [c.c_char_p], ptr
    x.XDefaultRootWindow.argtypes, x.XDefaultRootWindow.restype = [ptr], window
    x.XQueryTree.argtypes = [
        ptr,
        window,
        c.POINTER(window),
        c.POINTER(window),
        c.POINTER(c.POINTER(window)),
        c.POINTER(c.c_uint),
    ]
    x.XFetchName.argtypes = [ptr, window, c.POINTER(c.c_char_p)]
    x.XFree.argtypes = [ptr]
    x.XInternAtom.argtypes, x.XInternAtom.restype = (
        [ptr, c.c_char_p, c.c_int],
        c.c_ulong,
    )
    x.XFlush.argtypes = [ptr]
    x.XCloseDisplay.argtypes = [ptr]
    x.XSetInputFocus.argtypes = [ptr, window, c.c_int, c.c_ulong]
    x.XRaiseWindow.argtypes = [ptr, window]
    x.XResizeWindow.argtypes = [ptr, window, c.c_uint, c.c_uint]

    class Data(c.Union):
        _fields_ = [("b", c.c_char * 20), ("s", c.c_short * 10), ("l", c.c_long * 5)]

    class ClientMessage(c.Structure):
        _fields_ = [
            ("type", c.c_int),
            ("serial", c.c_ulong),
            ("send_event", c.c_int),
            ("display", ptr),
            ("window", window),
            ("message_type", c.c_ulong),
            ("format", c.c_int),
            ("data", Data),
        ]

    class Event(c.Union):
        _fields_ = [("client", ClientMessage), ("padding", c.c_long * 24)]

    x.XSendEvent.argtypes = [ptr, window, c.c_int, c.c_long, c.POINTER(Event)]
    display = x.XOpenDisplay(None)
    if not display:
        raise AssertionError("X11 display unavailable")
    try:
        queue = [x.XDefaultRootWindow(display)]
        while queue:
            candidate = queue.pop(0)
            name = c.c_char_p()
            if x.XFetchName(display, candidate, c.byref(name)) and name.value:
                label = name.value.decode(errors="replace")
                x.XFree(name)
                if label == title:
                    if minimum:

                        class SizeHints(c.Structure):
                            _fields_ = [("flags", c.c_long)] + [
                                (key, c.c_int)
                                for key in (
                                    "x",
                                    "y",
                                    "width",
                                    "height",
                                    "min_width",
                                    "min_height",
                                    "max_width",
                                    "max_height",
                                    "width_inc",
                                    "height_inc",
                                    "min_aspect_x",
                                    "min_aspect_y",
                                    "max_aspect_x",
                                    "max_aspect_y",
                                    "base_width",
                                    "base_height",
                                    "win_gravity",
                                )
                            ]

                        x.XGetWMNormalHints.argtypes = [
                            ptr,
                            window,
                            c.POINTER(SizeHints),
                            c.POINTER(c.c_long),
                        ]
                        hints, supplied = SizeHints(), c.c_long()
                        assert x.XGetWMNormalHints(
                            display, candidate, c.byref(hints), c.byref(supplied)
                        )
                        assert hints.flags & (1 << 4), (
                            "Native minimum-size hint missing"
                        )
                        return hints.min_width, hints.min_height
                    if size:
                        x.XResizeWindow(display, candidate, *size)
                        x.XFlush(display)
                        return
                    if not close:
                        x.XRaiseWindow(display, candidate)
                        x.XSetInputFocus(display, candidate, 2, 0)
                        x.XFlush(display)
                        return
                    event = Event()
                    event.client.type = 33
                    event.client.send_event = 1
                    event.client.display = display
                    event.client.window = candidate
                    event.client.message_type = x.XInternAtom(
                        display, b"WM_PROTOCOLS", 0
                    )
                    event.client.format = 32
                    event.client.data.l[0] = x.XInternAtom(
                        display, b"WM_DELETE_WINDOW", 0
                    )
                    if not x.XSendEvent(display, candidate, 0, 0, c.byref(event)):
                        raise AssertionError("X11 rejected close request")
                    x.XFlush(display)
                    return
            root, parent, children, count = (
                window(),
                window(),
                c.POINTER(window)(),
                c.c_uint(),
            )
            if x.XQueryTree(
                display,
                candidate,
                c.byref(root),
                c.byref(parent),
                c.byref(children),
                c.byref(count),
            ):
                queue.extend(children[i] for i in range(count.value))
                if children:
                    x.XFree(children)
        raise AssertionError("Native app window not found")
    finally:
        x.XCloseDisplay(display)
