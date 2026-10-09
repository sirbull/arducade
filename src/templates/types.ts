import type { ImageAsset, LocalizedText, ThumbnailScript, TileAsset, TilemapAsset } from '../project/model';

/** A template as written in src/templates, turned into a project file by scripts/build-templates.ts. */
export interface TemplateSource {
  id: string;
  /** Position in the gallery. */
  order: number;
  title: LocalizedText;
  description: LocalizedText;
  tips: LocalizedText[];
  strings: Record<string, Record<string, string>>;
  kinds: string[];
  images: ImageAsset[];
  tiles: TileAsset[];
  tilemaps: TilemapAsset[];
  blocks: unknown;
  thumbnail?: ThumbnailScript;
}
