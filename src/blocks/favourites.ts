import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';
import type { Project } from '../project/model';
import { cleanRecipe, favouriteKey, toggleFavourite, type FavouriteBlock } from '../project/favourites';
import { buildToolbox } from './toolbox';

type Entry = Record<string, unknown>;
const hosts = new WeakMap<Blockly.Workspace, { project: () => Project; changed: () => void }>();

export function favouriteItems(items: Blockly.utils.toolbox.FlyoutItemInfo[], category: string): Blockly.utils.toolbox.FlyoutItemInfo[] {
  return items.map(item => item.kind === 'block' ? { ...item, abFavouriteCategory: category } : item);
}

export function favouritesFlyout(workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfo[] {
  const saved = hosts.get(workspace)?.project().favouriteBlocks ?? [];
  const result: Entry[] = [];
  for (const category of buildToolbox().contents as Entry[]) {
    const style = String(category.categorystyle);
    const group = saved.filter(item => item.category === style);
    if (!group.length) continue;
    const current = category.custom
      ? workspace.getToolboxCategoryCallback(String(category.custom))?.(workspace) ?? []
      : category.contents;
    const entries = Blockly.utils.toolbox.convertFlyoutDefToJsonArray(current as Blockly.utils.toolbox.FlyoutDefinition);
    const keys = entries.filter(item => item.kind === 'block').map(block => favouriteKey({ category: style, block: block as unknown as FavouriteBlock['block'] }));
    group.sort((a, b) => {
      const rank = (item: FavouriteBlock) => { const i = keys.indexOf(favouriteKey(item)); return i < 0 ? keys.length : i; };
      return rank(a) - rank(b);
    });
    result.push({ kind: 'label', text: Blockly.utils.parsing.replaceMessageReferences(String(category.name)), 'web-class': 'ab-favourite-heading' });
    for (const item of group) {
      // Removed extensions must not prevent opening the rest of the palette.
      const types = JSON.stringify(item.block).matchAll(/"type":"([^"]+)"/g);
      if ([...types].every(match => Blockly.Blocks[match[1]])) result.push({ ...(entries[keys.indexOf(favouriteKey(item))] ?? item.block), kind: 'block', abFavouriteCategory: style });
    }
  }
  return (result.length ? result : [{ kind: 'label', text: t('favourites.empty') }]) as unknown as Blockly.utils.toolbox.FlyoutItemInfo[];
}

export function bindFavourites(workspace: Blockly.WorkspaceSvg, project: () => Project, changed: () => void) {
  hosts.set(workspace, { project, changed });
  workspace.registerToolboxCategoryCallback('FAVOURITES', favouritesFlyout);
}

export function refreshFavourites(workspace: Blockly.WorkspaceSvg) {
  const flyout = workspace.getFlyout();
  if (!flyout) return;
  for (const block of flyout.getWorkspace().getTopBlocks(false)) {
    const icon = block.getIcon(FavouriteIcon.TYPE);
    if (icon instanceof FavouriteIcon) icon.refresh();
  }
  const selected = workspace.getToolbox()?.getSelectedItem();
  if (selected instanceof Blockly.ToolboxCategory && selected.getName() === Blockly.Msg.AB_CAT_FAVOURITES) {
    const scrollY = flyout.getWorkspace().scrollY;
    flyout.show(favouritesFlyout(workspace));
    flyout.getWorkspace().scroll(0, scrollY);
  }
}

export class FavouriteIcon extends Blockly.icons.Icon {
  static readonly TYPE = new Blockly.icons.IconType<FavouriteIcon>('ab_favourite');
  private readonly recipe: FavouriteBlock;
  private readonly host;
  constructor(block: Blockly.BlockSvg, definition: Blockly.utils.toolbox.BlockInfo, target: Blockly.WorkspaceSvg) {
    super(block);
    this.host = hosts.get(target);
    this.recipe = { category: String((definition as unknown as Entry).abFavouriteCategory ?? ''), block: cleanRecipe(definition) as FavouriteBlock['block'] };
  }
  override getType() { return FavouriteIcon.TYPE; }
  override getSize() { return new Blockly.utils.Size(28, 28); }
  override isShownWhenCollapsed() { return true; }
  override isClickableInFlyout() { return true; }
  override initView(listener: (e: PointerEvent) => void) {
    if (this.svgRoot) return;
    super.initView(listener);
    this.svgRoot!.classList.add('ab-favourite-star');
    this.svgRoot!.setAttribute('tabindex', '0');
    this.svgRoot!.setAttribute('role', 'button');
    Blockly.utils.dom.createSvgElement('rect', { width: 28, height: 28, fill: 'transparent' }, this.svgRoot);
    Blockly.utils.dom.createSvgElement('path', { d: 'M14 3l3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6L7.2 24l1.3-7.5L3 11.1l7.6-1.1z', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linejoin': 'miter' }, this.svgRoot);
    this.svgRoot!.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); this.onClick(); }
    });
    this.refresh();
  }
  refresh() {
    const active = this.host?.project().favouriteBlocks?.some(item => favouriteKey(item) === favouriteKey(this.recipe)) ?? false;
    const label = t(active ? 'favourites.remove' : 'favourites.add');
    this.svgRoot?.querySelector('path')?.setAttribute('fill', active ? '#ffdc59' : 'none');
    this.svgRoot?.setAttribute('aria-pressed', String(active));
    this.svgRoot?.setAttribute('aria-label', label);
    this.setTooltip(label);
  }
  override onClick() {
    if (!this.host || !this.recipe.category) return;
    const project = this.host.project();
    project.favouriteBlocks = toggleFavourite(project.favouriteBlocks ?? [], this.recipe);
    this.host.changed();
    this.refresh();
    // Finish the pointer gesture before replacing the current flyout blocks.
    const workspace = (this.sourceBlock.workspace as Blockly.WorkspaceSvg).targetWorkspace;
    requestAnimationFrame(() => { if (workspace && Blockly.Workspace.getById(workspace.id) === workspace) refreshFavourites(workspace); });
  }
}
