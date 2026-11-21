#!/usr/bin/env python3
"""Extract the original Equalizer APO Configuration Editor icon for iOS.

Source: upstream Equalizer APO Editor.rc:
    IDI_ICON1 ICON DISCARDABLE "icons\\accessories-text-editor.ico"
Never draws a replacement; chooses the largest embedded PNG from the official
Windows .ico and resizes that exact artwork to Apple's 1024px app-icon slot.
"""
import pathlib
import struct
import subprocess
import sys
import tempfile


def embedded_png(path: pathlib.Path) -> bytes:
    data = path.read_bytes()
    if len(data) < 6:
        raise ValueError("Invalid ICO file")
    reserved, kind, count = struct.unpack_from("<HHH", data, 0)
    if reserved != 0 or kind != 1 or not count:
        raise ValueError("Not a valid Windows icon")
    choices = []
    for i in range(count):
        off = 6 + 16 * i
        if off + 16 > len(data):
            raise ValueError("Truncated ICO directory")
        width = data[off] or 256
        height = data[off + 1] or 256
        size, start = struct.unpack_from("<II", data, off + 8)
        if start + size > len(data):
            raise ValueError("Truncated ICO image")
        payload = data[start:start + size]
        if payload.startswith(b"\x89PNG\r\n\x1a\n"):
            choices.append((width * height, payload))
    if not choices:
        raise ValueError("Original editor ICO has no PNG frame")
    return max(choices, key=lambda x: x[0])[1]


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_original_icon.py <official editor .ico> <AppIcon-1024.png>")
    src, dst = map(pathlib.Path, sys.argv[1:])
    dst.parent.mkdir(parents=True, exist_ok=True)
    original_png = embedded_png(src)
    with tempfile.TemporaryDirectory() as tmpdir:
        source_png = pathlib.Path(tmpdir) / "apo-original-frame.png"
        source_png.write_bytes(original_png)
        # macOS includes sips; no invented logo, colors or additional markings.
        subprocess.run(["sips", "-z", "1024", "1024", str(source_png), "--out", str(dst)],
                       check=True)
    final = dst.read_bytes()
    if final[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Icon conversion did not produce PNG")
    w, h = struct.unpack_from(">II", final, 16)
    if (w, h) != (1024, 1024):
        raise ValueError(f"Wrong icon dimensions: {w} x {h}")
    print(f"Original APO Editor icon: {src} -> {dst} ({w} x {h})")


if __name__ == "__main__":
    main()
