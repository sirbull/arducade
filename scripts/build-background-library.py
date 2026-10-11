"""Export the approved native PNGs into compact editor pixels.

Run: uv run --with pillow python scripts/build-background-library.py [--check]
This does not generate or resize artwork. It only reads assets/backgrounds/mono
and writes src/project/background-art.json (or verifies it with --check).
"""

import argparse
import json
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify without writing')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'assets/backgrounds/manifest.json').read_text())
    artwork = {}
    for item in manifest:
        asset_id = item['id']
        if asset_id in artwork:
            raise ValueError(f'Duplicate background: {asset_id}')
        with Image.open(root / 'assets/backgrounds/mono' / f'{asset_id}.png') as source:
            if source.size != (128, 64) or source.mode != '1':
                raise ValueError(f'{asset_id}: expected a native 128x64, 1-bit PNG')
            image = source.convert('RGB')
            if {color for _, color in image.getcolors(8192)} != {(0, 0, 0), (255, 255, 255)}:
                raise ValueError(f'{asset_id}: expected only black and white')
            rows = [''.join('1' if image.getpixel((x, y))[0] else '0' for x in range(128)) for y in range(64)]
            if item['layout'] == 'play' and any('1' in row for row in rows[40:]):
                raise ValueError(f'{asset_id}: lower 24 rows must be empty')
            artwork[asset_id] = [f'{int(row, 2):032x}' for row in rows]
    target = root / 'src/project/background-art.json'
    if args.check:
        if json.loads(target.read_text()) != artwork:
            raise ValueError('Editor pixels differ from the approved PNGs; rebuild them')
    else:
        target.write_text(json.dumps(artwork, indent=2) + '\n')
    print(f'{len(artwork)} backgrounds: native 128x64, 1 bit, editor pixels verified')


if __name__ == '__main__':
    main()
