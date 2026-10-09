// Dropdown fields whose options come from the open project: images, tiles,
// tile maps and sprite kinds.

import * as Blockly from 'blockly/core';
import { BUILTIN_KINDS } from '../engine/enums';
import type { Project, PixelRows } from '../project/model';
import { pixelAt } from '../project/model';

let current: Project | null = null;
let kindLabel: (name: string) => string = (n) => n;
let noneLabel = '(none)';
let emptyTileLabel = 'empty';

export function setAssetProject(p: Project | null) {
  current = p;
  previewCache.clear();
}

export function getAssetProject(): Project | null {
  return current;
}

export function setAssetLabels(kind: (name: string) => string, none: string, emptyTile: string) {
  kindLabel = kind;
  noneLabel = none;
  emptyTileLabel = emptyTile;
}

const previewCache = new Map<string, string>();

/** Small picture of pixels as a data URL, for dropdowns and the gallery. */
export function pixelsToDataUrl(rows: PixelRows, width: number, height: number, scale = 2): string {
  const key = `${width}x${height}x${scale}:${rows.join('|')}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  // SVG with one rectangle per pixel. Works without a canvas and stays sharp.
  let rects = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = pixelAt(rows, x, y);
      if (c === '.') continue;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '1' ? '#f2f2f2' : '#111'}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><rect width="${width}" height="${height}" fill="#000" fill-opacity="0.35"/>${rects}</svg>`;
  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  previewCache.set(key, url);
  return url;
}

type Option = [string | Blockly.ImageProperties, string];

function imageOptions(): Option[] {
  const images = current?.images ?? [];
  if (!images.length) return [[noneLabel, '']];
  return images.map((img) => {
    // Give artwork a consistent 32px preview; Blockly grows the containing
    // row to fit the image plus the field's vertical padding.
    const scale = 32 / Math.max(img.width, img.height);
    return [
      { src: pixelsToDataUrl(img.frames[0], img.width, img.height, scale), width: img.width * scale, height: img.height * scale, alt: img.name },
      img.id,
    ];
  });
}

function tileOptions(): Option[] {
  const tiles = current?.tiles ?? [];
  const opts: Option[] = [[emptyTileLabel, 'empty']];
  for (const t of tiles) opts.push([{ src: pixelsToDataUrl(t.pixels, 8, 8, 4), width: 32, height: 32, alt: t.name }, t.id]);
  return opts;
}

function tilemapOptions(): Option[] {
  const maps = current?.tilemaps ?? [];
  if (!maps.length) return [[noneLabel, '']];
  return maps.map((m) => [m.name, m.id]);
}

function kindOptions(): Option[] {
  return [...BUILTIN_KINDS, ...(current?.kinds ?? [])].map((k) => [kindLabel(k), k]);
}

/** A dropdown with options from the open project. */
class AssetDropdown extends Blockly.FieldDropdown {}

class ImageField extends AssetDropdown {
  constructor() {
    super(imageOptions);
  }
  static fromJson() {
    return new ImageField();
  }
}

class TileField extends AssetDropdown {
  constructor() {
    super(tileOptions);
  }
  static fromJson() {
    return new TileField();
  }
}

class TilemapField extends AssetDropdown {
  constructor() {
    super(tilemapOptions);
  }
  static fromJson() {
    return new TilemapField();
  }
}

class KindField extends AssetDropdown {
  constructor() {
    super(kindOptions);
  }
  static fromJson() {
    return new KindField();
  }
}

let registered = false;
export function registerAssetFields() {
  if (registered) return;
  registered = true;
  Blockly.fieldRegistry.register('field_ab_image', ImageField);
  Blockly.fieldRegistry.register('field_ab_tile', TileField);
  Blockly.fieldRegistry.register('field_ab_tilemap', TilemapField);
  Blockly.fieldRegistry.register('field_ab_kind', KindField);
}
