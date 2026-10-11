/** Toolbox recipes are project metadata, separate from the executable workspace. */
export interface FavouriteBlock {
  category: string;
  block: Record<string, unknown> & { type: string };
}

export function cleanRecipe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanRecipe);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !['id', 'x', 'y', 'gap', 'enabled', 'abFavouriteCategory'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, cleanRecipe(child)]));
}
export const favouriteKey = (item: FavouriteBlock) => `${item.category}:${JSON.stringify(cleanRecipe(item.block))}`;

export function normalizeFavourites(value: unknown): FavouriteBlock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 512).flatMap(item => {
    if (!item || typeof item.category !== 'string' || !/^ab_[a-z]+$/.test(item.category) ||
      !item.block || typeof item.block !== 'object' || typeof item.block.type !== 'string') return [];
    const clean = { category: item.category, block: cleanRecipe(item.block) as FavouriteBlock['block'] };
    const key = favouriteKey(clean);
    if (seen.has(key)) return [];
    seen.add(key);
    return [clean];
  });
}

export function toggleFavourite(items: FavouriteBlock[], item: FavouriteBlock): FavouriteBlock[] {
  const key = favouriteKey(item);
  return items.some(other => favouriteKey(other) === key)
    ? items.filter(other => favouriteKey(other) !== key)
    : normalizeFavourites([...items, item]);
}
