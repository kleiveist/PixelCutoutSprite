"""Small asymmetric, partially transparent PNG fixture; no user artwork."""

import struct
import zlib
from pathlib import Path


def make_source(path: Path, width: int = 32, height: int = 48) -> bytes:
    def chunk(kind, payload):
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload))
        )

    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            visible = (4 <= x < 16 and 3 <= y < 15) or (7 <= x < 21 and 10 <= y < 30)
            rows.extend(
                (x * 7 % 256, y * 5 % 256, (x * 3 + y * 2) % 256, 255 if visible else 0)
            )
    png = b"\x89PNG\r\n\x1a\n" + chunk(
        b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    )
    png += chunk(b"IDAT", zlib.compress(bytes(rows))) + chunk(b"IEND", b"")
    # The caller supplies a newly created temporary fixture vault.
    with path.open("xb") as output:
        output.write(png)
    return png
