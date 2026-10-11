import type { LocalizedText, PixelRows } from './model';
import artwork from './background-art.json';

export type BackgroundDetail = 'simple' | 'medium' | 'rich';
export type BackgroundLayout = 'play' | 'scene';
export interface LibraryBackground {
  id: string;
  name: LocalizedText;
  genre: LocalizedText;
  detail: BackgroundDetail;
  layout: BackgroundLayout;
  width: number;
  height: number;
  frames: PixelRows[];
}

// Generated directly at 128 × 64 with PixelLab, then verified as 1-bit PNGs.
// Native files and generation provenance live in assets/backgrounds/.
// Run scripts/build-background-library.py to rebuild this compact pixel data.
const entry = (id: keyof typeof artwork, en: string, nb: string, detail: BackgroundDetail, layout: BackgroundLayout, genre: LocalizedText): LibraryBackground => ({
  id, name: { en, nb }, genre, detail, layout, width: 128, height: 64,
  frames: [artwork[id].map(row => [...row].map(digit => parseInt(digit, 16).toString(2).padStart(4, '0')).join(''))],
});
const platform = { en: 'Platformer · runner', nb: 'Plattform · løpespill' };
const adventure = { en: 'Adventure · RPG', nb: 'Eventyr · RPG' };
const shooter = { en: 'Shooter · arcade', nb: 'Skytespill · arkade' };

export const LIBRARY_BACKGROUNDS: LibraryBackground[] = [
  entry('mountain-play', 'Mountain horizon', 'Fjellhorisont', 'rich', 'play', platform),
  entry('mountain-lake', 'Alpine lake', 'Fjellvann', 'rich', 'scene', adventure),
  entry('forest-play', 'Forest treeline', 'Skog i det fjerne', 'medium', 'play', platform),
  entry('forest-path', 'Forest sanctuary', 'Helligdom i skogen', 'rich', 'scene', adventure),
  entry('city-play', 'Distant space city', 'Romby i det fjerne', 'rich', 'play', platform),
  entry('city-street', 'Midnight avenue', 'Midnattsaveny', 'rich', 'scene', adventure),
  entry('desert-play', 'Quiet dunes', 'Stille sanddyner', 'simple', 'play', platform),
  entry('desert-ruins', 'Pyramids in the sand', 'Pyramider i sanden', 'rich', 'scene', adventure),
  entry('castle', 'Castle by the lake', 'Slott ved innsjøen', 'rich', 'scene', adventure),
  entry('cave-play', 'Cave ceiling', 'Grottetak', 'simple', 'play', platform),
  entry('crystal-cave', 'Crystal cavern', 'Krystallgrotte', 'rich', 'scene', adventure),
  entry('space-play', 'Stars and crescent planet', 'Stjerner og planet', 'simple', 'play', shooter),
  entry('moon-base', 'Outpost on the moon', 'Månebase', 'rich', 'scene', shooter),
  entry('ocean-play', 'Water and bubbles', 'Vann og bobler', 'simple', 'play', shooter),
  entry('shipwreck', 'Sunken sailing ship', 'Sunket seilskip', 'rich', 'scene', adventure),
  entry('space-station', 'Orbital control room', 'Kontrollrom i bane', 'rich', 'scene', shooter),
  entry('harbor', 'Lighthouse harbor', 'Havn med fyrtårn', 'rich', 'scene', adventure),
  entry('castle-hills-play', 'Castle on distant hills', 'Slott på fjerne åser', 'rich', 'play', platform),
  entry('forest-ruins-play', 'Ancient forest ruins', 'Gamle skogruiner', 'rich', 'play', platform),
  entry('desert-temple-play', 'Temple beyond the dunes', 'Tempel bak sanddynene', 'rich', 'play', platform),
  entry('crystal-ridge-play', 'Distant crystal cavern', 'Krystallgrotte i det fjerne', 'rich', 'play', adventure),
  entry('orbital-port-play', 'Orbital harbor skyline', 'Horisont ved romhavnen', 'rich', 'play', shooter),
];
