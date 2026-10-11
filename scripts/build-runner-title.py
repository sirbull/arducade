"""Export the native 1-bit Void Runner title PNG; never resize or generate art.

Run: uv run --with pillow python scripts/build-runner-title.py [--check]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
with Image.open(root / 'assets/templates/void-runner/mono/title-screen.png') as image:
    if image.size != (128, 64) or image.mode != '1':
        raise ValueError('Title must be native 128x64, 1-bit artwork')
    rows = [''.join('1' if image.getpixel((x, y)) else '0' for x in range(128)) for y in range(64)]
    if any('1' in row for row in rows[55:]):
        raise ValueError('Bottom nine rows must be empty for the localized start prompt')
    artwork = [f'{int(row, 2):032x}' for row in rows]
target = root / 'src/templates/endlessrunner-title.json'
if args.check:
    if json.loads(target.read_text()) != artwork:
        raise ValueError('Template pixels differ from the native PNG')
else:
    target.write_text(json.dumps(artwork, indent=2) + '\n')
print('Void Runner title: native 128x64, 1 bit, template pixels verified')
