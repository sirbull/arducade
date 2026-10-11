/** Search metadata can be extended with docs.keywords.<section id or block type>
 * in locale files. These aliases also work across the editor's languages. */
export const DOCS_KEYWORDS: Record<string, string> = {
  start: 'beginner getting started nybegynner komme i gang save lagre cartridge kassett',
  blocks: 'programming programmering coding kode events hendelser toolbox verktøykasse',
  assets: 'graphics grafikk artwork tegne animation animasjon background bakgrunn tilemap fliser kart',
  sim: 'testing teste emulator simulator controls kontroller gamepad touch berøring',
  sound: 'audio lyd music musikk melody melodi song sang piano sequencer komponere',
  debug: 'debugging feilsøking breakpoint bruddpunkt inspect inspisere pause step steg',
  shortcuts: 'keyboard tastatur shortcuts hurtigtaster snarveier',
  device: 'usb upload laste opp compile kompilere export eksportere firmware',
  hardware: 'device maskinvare hardware board kretskort espboy arduboy',
  homemade: 'diy hjemmelaget wiring kobling lodde solder pro micro strøm batteri',
  attiny: 'tiny attiny85 wiring kobling isp programmering',
  ab_on_overlap: 'collision kollisjon collide overlap overlapping berøring treffe krasj',
  ab_sprite_projectile: 'bullet kule shoot skyte skudd missile rakett',
  ab_sprite_projectile_position: 'bullet kule shoot skyte skudd missile rakett',
  ab_bg_layer_set: 'parallax parallakse scrolling bakgrunn lag',
  ab_sprite_say: 'speech bubble snakkeboble dialog dialogue snakke',
  ab_sprite_say_for: 'speech bubble snakkeboble dialog dialogue snakke',
  ab_move_sprite: 'controls kontroller movement bevegelse styre gamepad',
};

export interface DocsSearchEntry {
  sectionId: string;
  blockType?: string;
  title: string;
  sectionTitle: string;
  text: string;
  keywords: string;
}

export function normalizeDocsSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae');
}

/** All words must match; titles and aliases rank ahead of body-only matches. */
export function searchDocs(entries: DocsSearchEntry[], query: string): DocsSearchEntry[] {
  const terms = [...new Set(normalizeDocsSearch(query).trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  return entries.map((entry, index) => {
    const title = normalizeDocsSearch(entry.title);
    const keywords = normalizeDocsSearch(entry.keywords);
    const text = normalizeDocsSearch(`${entry.sectionTitle} ${entry.text}`);
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      else if (keywords.includes(term)) score += 6;
      else if (text.includes(term)) score += 1;
      else return { entry, index, score: 0 };
    }
    return { entry, index, score };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(hit => hit.entry);
}

/** A short excerpt around a body match, also for matches far into a guide. */
export function docsSearchExcerpt(text: string, query: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  const terms = normalizeDocsSearch(query).trim().split(/\s+/).filter(Boolean);
  // Search the original characters so accent folding cannot shift the excerpt.
  const pattern = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const words = [...compact.matchAll(/\S+/g)];
  const match = words.find(word => pattern.test(normalizeDocsSearch(word[0])));
  const start = Math.max(0, (match?.index ?? 0) - 60);
  const end = Math.min(compact.length, start + 240);
  return `${start ? '…' : ''}${compact.slice(start, end)}${end < compact.length ? '…' : ''}`;
}
