// The editor: connects the block workspace, the asset tabs, the code view,
// the simulator and the device panel.

import * as Blockly from 'blockly/core';
import { varType } from '../blocks/var-types';
import 'blockly/blocks';
import '../blocks/category';
import { setAssetLabels, setAssetProject } from '../blocks/assets';
import { defineBlocks } from '../blocks/defs';
import { setBlockInfoHandler } from '../blocks/info-icon';
import { buildToolbox } from '../blocks/toolbox';
import { searchBlocks } from '../blocks/search';
import { getChip } from '../hw/chips';
import { BUILTIN_PROFILES, DEFAULT_PROFILE_ID, type Profile } from '../hw/profile';
import { currentLanguage, kindName, LANGUAGES, loadLanguage, t, translatePage } from '../i18n/i18n';
import type { Diagnostic } from '../ir/ir';
import { instantiateTemplate, localized, newProject, parseProject, type Project } from '../project/model';
import { sketchZip } from '../project/sketch';
import { downloadFile, loadSettings, pickProjectFile, profiles as profileStore, projects as projectStore, safeFileName, saveSettings, type Settings } from '../project/store';
import { readCartridge } from '../project/cartridge';
import { saveCartridge } from './save-dialog';
import { Runner, type PixelColor } from '../sim/runner';
import { BUTTON_IDS } from '../engine/enums';
import { BackgroundsPane, ImagesPane, MapPane, TilesPane } from './assets-panes';
import { buildWorkspace, type BuildResult } from './build';
import type { TextEditor } from './text-editor';
import { generateSource, parseSource, SourceError, type TextLanguage } from '../text/languages';
import { CodeView } from './code-view';
import { confirmDialog } from './dialogs';
import { openDocs } from './docs';
import { $, clear, h, toast } from './dom';
import { loadTemplates, openGallery, openProjectsDialog, starButton, thumbnail } from './gallery';
import { allProfiles, loadServerProfiles, openProfileDialog, profileFromUrl, setSecretProfiles } from './profile-editor';
import { openFirstRun, openSettings } from './settings-dialog';
import { CommentsPanel } from './comments';
import { ToolboxDeleteOverlay } from './toolbox-delete-overlay';
import { applyPageTheme, BLOCK_RENDERER, blocklyTheme, THEME_IDS, type ThemeId } from './themes';
import { DeviceTools } from './device';
import { GuidePanel } from './guide-panel';
import { guideProject, type Guide } from '../guides/guide';
import { renderGuideCatalog, reachedStep } from './guide-catalog';

// Picked once per page load so the header only changes on refresh.
const headerImage = Math.floor(Math.random() * 5) + 1;

const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'color',
  pixelColor: 'white',
  profileId: DEFAULT_PROFILE_ID,
  muted: false,
  firstRunDone: false,
};

export class App {
  settings: Settings = loadSettings(DEFAULT_SETTINGS);
  project: Project = newProject('Game');
  ws!: Blockly.WorkspaceSvg;
  private comments?: CommentsPanel;
  private deleteOverlay?: ToolboxDeleteOverlay;
  runner!: Runner;
  build: BuildResult | null = null;
  private codeView!: CodeView;
  private textEditors: Partial<Record<TextLanguage, TextEditor>> = {};
  private images!: ImagesPane;
  private tiles!: TilesPane;
  private backgrounds!: BackgroundsPane;
  private map!: MapPane;
  private device!: DeviceTools;
  private guide!: GuidePanel;
  private buildTimer = 0;
  private saveTimer = 0;
  private loading = false;
  private activeTab = 'blocks';
  private tabRequest = 0;
  private lastJs = '';
  private homeVisible = false;
  private simStandalone = false;
  private simSize = 0;
  private hasProject = false;
  private homeRender = 0;

  async init() {
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang');
    if (lang && LANGUAGES.some((l) => l.code === lang)) this.settings.language = lang;
    if (!THEME_IDS.includes(this.settings.theme as ThemeId)) this.settings.theme = 'arduboy';

    applyPageTheme(this.settings.theme as ThemeId);
    await loadLanguage(this.settings.language);
    translatePage();
    this.fillLanguageSelect();
    defineBlocks();
    setAssetLabels(kindName, t('ui.none'), t('tiles.emptyTile'));

    this.codeView = new CodeView($('#code'));
    this.runner = new Runner($('#screen') as HTMLCanvasElement, {
      onError: (key, detail) => this.simMessage(t(key) + (detail ? `: ${detail}` : ''), 'error'),
      onSkippedCpp: () => this.simMessage(t('sim.skippedCpp'), 'info'),
      onState: () => this.renderSimControls(),
      onInput: (buttons) => {
        if (this.runner.running) this.guide.onInput(buttons);
        document.querySelectorAll<HTMLButtonElement>('.pad [data-btn]').forEach((button) => {
          const pressed = !!(buttons & (1 << BUTTON_IDS.indexOf(button.dataset.btn as (typeof BUTTON_IDS)[number])));
          button.classList.toggle('pressed', pressed);
          button.setAttribute('aria-pressed', String(pressed));
        });
      },
    });
    this.runner.pixelColor = 'white';
    this.settings.pixelColor = 'white';
    this.runner.muted = this.settings.muted;
    const host = { project: () => this.project, changed: (structural: boolean) => this.assetsChanged(structural) };
    this.images = new ImagesPane($('#pane-images'), host);
    this.tiles = new TilesPane($('#pane-tiles'), host);
    this.backgrounds = new BackgroundsPane($('#pane-backgrounds'), host);
    this.map = new MapPane($('#pane-map'), host);
    this.device = new DeviceTools(this);
    this.guide = new GuidePanel($('#guide-panel'), {
      project: () => this.project,
      theme: () => this.settings.theme as ThemeId,
      stars: () => this.settings.guideStars ?? {},
      saveStars: (id, stars) => {
        const all = { ...this.settings.guideStars };
        all[id] = Math.max(all[id] ?? 0, stars);
        this.settings.guideStars = all;
        saveSettings(this.settings);
      },
      changed: () => this.scheduleSave(),
      openLevel: (g) => void this.openGuide(g),
      home: () => void this.showGuides(),
    });

    this.injectWorkspace();
    this.bindUi();
    setSecretProfiles(!!this.settings.secretTiny);
    await loadServerProfiles();

    const profilePath = params.get('profile');
    if (profilePath) {
      const p = await profileFromUrl(profilePath);
      if (p) {
        await profileStore.save(p).catch(() => {});
        this.settings.profileId = p.id;
        saveSettings(this.settings);
        toast(t('profile.imported', { name: p.name }), 'ok');
      }
    }

    if (!this.settings.firstRunDone) await openFirstRun(this);

    const last = this.settings.lastProjectId ? await projectStore.get(this.settings.lastProjectId).catch(() => undefined) : undefined;
    if (last) this.loadProject(last);
    await this.showHome(false);
  }

  // Workspace -------------------------------------------------------------

  private injectWorkspace() {
    // Square palette buttons ("Create variable"), large enough for touch.
    Blockly.FlyoutButton.BORDER_RADIUS = 0;
    Blockly.FlyoutButton.TEXT_MARGIN_X = 16;
    Blockly.FlyoutButton.TEXT_MARGIN_Y = 14;
    this.ws = Blockly.inject($('#blockly'), {
      toolbox: buildToolbox() as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      theme: blocklyTheme(this.settings.theme as ThemeId),
      renderer: 'geras',
      rendererOverrides: BLOCK_RENDERER,
      grid: { spacing: 24, length: 2, colour: 'rgba(128,128,128,0.25)', snap: true },
      // With both wheel options enabled, Blockly pans on ordinary scrolling
      // and zooms on trackpad pinch (Ctrl+wheel).
      zoom: { controls: true, wheel: true, pinch: true, startScale: 1, maxScale: 2, minScale: 0.3 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      sounds: false,
      media: 'blockly-media/',
    });
    // Keep toolbox blocks at a fixed size instead of following workspace zoom
    // (browser zoom still scales the whole UI).
    const flyout = this.ws.getFlyout() as Blockly.Flyout | null;
    if (flyout) {
      flyout.getFlyoutScale = () => 0.8;
      // Every palette starts below its close button.
      const show = flyout.show.bind(flyout);
      flyout.show = (def) => {
        const contents = typeof def === 'string' ? this.ws.getToolboxCategoryCallback(def)!(this.ws) : def;
        show([{ kind: 'sep', gap: '44' }, ...Blockly.utils.toolbox.convertFlyoutDefToJsonArray(contents)]);
      };
    }
    // "set" comes with a value of the variable's type that can be pulled off.
    this.ws.registerToolboxCategoryCallback('VARIABLE', (ws) =>
      Blockly.Variables.flyoutCategory(ws).map((item) => {
        if (!('type' in item) || item.type !== 'variables_set') return item;
        const v = ws.getVariableMap().getVariable((item.fields as { VAR: { name: string } }).VAR.name);
        const ty = v && varType(ws, v.getId());
        const value = ty === 'bool' ? { type: 'logic_boolean', fields: { BOOL: 'TRUE' } }
          : ty === 'str' ? { type: 'text', fields: { TEXT: '' } }
          : { type: 'math_number', fields: { NUM: 0 } };
        return { ...item, inputs: { VALUE: { block: value } } };
      }));
    this.deleteOverlay?.dispose();
    this.deleteOverlay = new ToolboxDeleteOverlay(this.ws);
    this.comments?.dispose();
    this.comments = new CommentsPanel(this.ws);
    // Closed, the search is an icon over the top of the categories; open, it
    // becomes a full row above the editor and Blockly shrinks to fit.
    const box = $('.block-search') as HTMLElement;
    const search = box.querySelector('input')!;
    const setOpen = (open: boolean) => {
      box.classList.toggle('open', open);
      Blockly.svgResize(this.ws);
    };
    const close = (hidePalette: boolean) => {
      if (!box.classList.contains('open')) return;
      search.value = '';
      setOpen(false);
      if (hidePalette) flyout?.hide();
    };
    close(false);
    (box.querySelector('.block-search-toggle') as HTMLButtonElement).onclick = () => {
      if (box.classList.contains('open')) return close(true);
      setOpen(true);
      search.focus();
      search.oninput?.(new Event('input'));
    };
    // Results go straight into the flyout: re-rendering the toolbox would make
    // Blockly shift the workspace. An empty query lists every block.
    search.oninput = () => {
      this.ws.getToolbox()?.clearSelection();
      const contents = searchBlocks(search.value.trim(), this.ws);
      flyout?.show((contents.length ? contents : [{ kind: 'label', text: t('blocks.searchEmpty') }]) as unknown as Blockly.utils.toolbox.FlyoutDefinition);
    };
    search.onkeydown = (event) => { if (event.key === 'Escape') close(true); };
    this.ws.addChangeListener((e) => {
      if (e.type === Blockly.Events.TOOLBOX_ITEM_SELECT && (e as Blockly.Events.ToolboxItemSelect).newItem) close(false);
      if (e.type === Blockly.Events.CLICK && (e as Blockly.Events.Click).targetType === 'workspace') close(true);
    });
    this.ws.addChangeListener(Blockly.Events.disableOrphans);
    this.ws.addChangeListener((e) => {
      if (this.loading || this.project.source) return;
      if (e.type === Blockly.Events.SELECTED) {
        this.showSelected((e as Blockly.Events.Selected).newElementId ?? undefined);
        return;
      }
      if (e.isUiEvent) return;
      this.scheduleBuild();
    });
  }

  private reinjectWorkspace() {
    const state = Blockly.serialization.workspaces.save(this.ws);
    this.ws.dispose();
    this.injectWorkspace();
    this.loading = true;
    Blockly.serialization.workspaces.load(state, this.ws);
    this.loading = false;
  }

  loadProject(p: Project, opts: { fromTemplate?: boolean } = {}) {
    this.homeVisible = false;
    this.hasProject = true;
    this.homeRender++;
    document.body.classList.remove('show-home');
    $('#home').hidden = true;
    $('#editor-layout').hidden = false;
    this.project = p;
    this.runner.pixelColor = p.pixelColor ?? 'white';
    this.settings.pixelColor = this.runner.pixelColor;
    this.renderSimControls();
    setAssetProject(p);
    this.loading = true;
    this.ws.clear();
    try {
      Blockly.serialization.workspaces.load(p.blocks as object, this.ws);
      if (opts.fromTemplate) this.ws.cleanUp();
    } catch (err) {
      console.error(err);
      toast(t('project.loadError'), 'error');
    }
    this.scrollToStart();
    this.loading = false;
    ($('#project-name') as HTMLInputElement).value = p.name;
    this.settings.lastProjectId = p.id;
    saveSettings(this.settings);
    this.renderTips();
    this.renderProfile();
    this.renderActivePane();
    this.runBuild(true);
    this.selectTab(this.project.source?.language ?? 'blocks');
    Blockly.svgResize(this.ws);
    void projectStore.save(this.project).catch(() => {});
  }

  /** Shows the top left of the blocks. */
  private scrollToStart() {
    const box = this.ws.getBlocksBoundingBox();
    const scale = this.ws.scale;
    if (box.right > box.left) this.ws.scroll(24 - box.left * scale, 24 - box.top * scale);
    else this.ws.scrollCenter();
  }

  private scheduleBuild() {
    clearTimeout(this.buildTimer);
    this.buildTimer = window.setTimeout(() => this.runBuild(false), 250);
  }

  /** Regenerates code and stops the simulator when its program changes. */
  runBuild(forceStop: boolean) {
    this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
    this.build = buildWorkspace(this.ws, this.project);
    if (this.project.source) {
      const {language, code} = this.project.source;
      try {parseSource(code, language, this.project);this.textEditors[language]?.showError();}
      catch(error) {this.textEditors[language]?.showError(error instanceof Error ? error.message : String(error), error instanceof SourceError ? error.line : 1);}
    }
    this.codeView.setCode(this.build.cpp.code);
    this.renderProblems(this.build.diagnostics);
    this.device.estimate();
    this.guide.update();
    this.scheduleSave();
    if (forceStop || this.build.js.code !== this.lastJs) {
      this.lastJs = this.build.js.code;
      this.runner.stop();
      this.runner.releaseAll();
      this.simMessage(t('sim.ready'), 'info');
    }
  }

  private assetsChanged(structural: boolean) {
    setAssetProject(this.project);
    if (structural) {
      // Redraw dropdowns that show images, kinds and tiles.
      this.loading = true;
      const state = Blockly.serialization.workspaces.save(this.ws);
      this.ws.clear();
      Blockly.serialization.workspaces.load(state, this.ws);
      this.loading = false;
    }
    this.runBuild(false);
  }

  private scheduleSave() {
    if (!this.hasProject) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.project.modified = Date.now();
      void projectStore.save(this.project).catch(() => toast(t('project.saveError'), 'error'));
    }, 800);
  }

  private showSelected(id: string | undefined) {
    const range = id ? this.build?.cpp.ranges.get(id) : undefined;
    this.codeView.highlight(range, this.activeTab === 'code');
  }

  // Simulator -------------------------------------------------------------

  private renderSimView() {
    const sim = $('#sim');
    sim.classList.toggle('standalone', this.simStandalone);
    $('#sim-shell').classList.toggle('standalone', this.simStandalone);
    sim.dataset.size = ['small', 'medium', 'large'][this.simSize];
    const view = $('#btn-sim-view');
    view.dataset.i18nTitle = this.simStandalone ? 'sim.backToEditor' : 'sim.standalone';
    view.title = t(view.dataset.i18nTitle);
    view.setAttribute('aria-label', view.title);
    const corners = this.simStandalone
      ? 'M9 3v6H3m12-6v6h6M3 15h6v6m6 0v-6h6'
      : 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6';
    view.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${corners}"/></svg>`;
    view.setAttribute('aria-expanded', String(this.simStandalone));
    const size = $('#btn-sim-size');
    $('#sim-top').hidden = !this.simStandalone;
    size.dataset.i18nTitle = ['sim.sizeSmall', 'sim.sizeMedium', 'sim.sizeLarge'][this.simSize];
    size.title = t(size.dataset.i18nTitle);
    size.setAttribute('aria-label', size.title);
    const width = [8, 13, 18][this.simSize];
    size.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" stroke-dasharray="2 3" opacity="0.45"/><rect x="${12 - width / 2}" y="${12 - width / 4}" width="${width}" height="${width / 2}"/></svg>`;
  }

  private renderSimControls() {
    const icons: Record<string, string> = {
      play: '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
      stop: '<rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/>',
      restart: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
      sound: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
      color: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>',
      muted: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/>',
    };
    const paused = this.runner.paused;
    const playing = this.runner.running && !paused;
    const controls = [
      ['btn-run', playing ? 'pause' : 'play', playing ? 'sim.pause' : 'sim.play'],
      ['btn-stop', 'stop', 'sim.stop'],
      ['btn-restart', 'restart', 'sim.restart'],
      ['btn-mute', this.runner.muted ? 'muted' : 'sound', this.runner.muted ? 'sim.unmute' : 'sim.mute'],
      ['btn-sim-color', 'color', 'sim.color'],
    ];
    for (const [id, icon, key] of controls) {
      const button = $( '#' + id);
      button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg>`;
      button.dataset.i18nTitle = key;
      button.title = t(key).replace('▶ ', '');
      button.setAttribute('aria-label', button.title);
    }
    const colorButton = $('#btn-sim-color');
    colorButton.style.background = { white: '#ebf0f5', blue: '#5abeff', yellow: '#ffd646' }[this.runner.pixelColor];
    colorButton.style.color = '#111111';
    colorButton.title = `${t('sim.color')}: ${t(`pixel.${this.runner.pixelColor}Color`)}`;
    colorButton.setAttribute('aria-label', colorButton.title);
    $('#btn-mute').setAttribute('aria-pressed', String(!this.runner.muted));
    // Only left and right on an ATtiny85 console. Both together are A.
    document.querySelectorAll('.pad').forEach((pad) => pad.classList.toggle('tiny', this.isTiny()));
  }

  restartSim() {
    if (!this.build) return;
    this.simMessage('', 'info');
    const errors = this.build.diagnostics.filter((d) => d.level === 'error');
    if (errors.length) {
      this.runner.stop();
      this.runner.clearScreen();
      this.simMessage(t('sim.fixErrors'), 'error');
      return;
    }
    void this.runner.start(this.build.js, `ardublocks.eeprom.${this.project.id}`, this.maxSprites(), this.isTiny());
    this.guide.onPlay();
  }

  /** Same number of sprites as the device, which has fewer on small chips. */
  maxSprites(): number {
    try {
      const chip = getChip(this.project.profile.chip);
      return chip.tiny ? 5 : chip.ram < 2560 ? 12 : 16;
    } catch {
      return 16;
    }
  }

  /** The project is for an ATtiny85 console with two buttons. */
  isTiny(): boolean {
    try {
      return !!getChip(this.project.profile.chip).tiny;
    } catch {
      return false;
    }
  }

  private simMessage(text: string, kind: 'info' | 'error') {
    const el = $('#sim-message');
    el.textContent = text;
    el.className = `sim-message ${kind}`;
  }

  // Panels ----------------------------------------------------------------

  private renderProblems(list: Diagnostic[]) {
    const ul = $('#problems');
    clear(ul);
    const extra = this.device.warnings();
    const all = [...list, ...extra];
    $('#problems-panel').hidden = all.length === 0;
    for (const d of all) {
      const params: Record<string, string | number> = { ...(d.params ?? {}) };
      const li = h('li', { class: d.level }, t(d.key, params));
      if (d.id) {
        li.classList.add('clickable');
        li.tabIndex = 0;
        const go = () => {
          const b = this.ws.getBlockById(d.id!);
          if (b) {
            this.selectTab('blocks');
            this.ws.centerOnBlock(b.id);
            (b as Blockly.BlockSvg).select();
          }
        };
        li.addEventListener('click', go);
        li.addEventListener('keydown', (e) => e.key === 'Enter' && go());
      }
      ul.append(li);
    }
  }

  private renderTips() {
    this.guide.render();
    const tips = this.guide.active ? [] : this.project.template?.tips ?? [];
    $('#tips-panel').hidden = tips.length === 0;
    const ol = $('#tips');
    clear(ol);
    for (const tip of tips) ol.append(h('li', {}, localized(tip, currentLanguage())));
  }

  renderProfile() {
    const p = this.project.profile;
    let chip = p.chip;
    try {
      chip = getChip(p.chip).name;
    } catch {
      // Unknown chip, shown as is.
    }
    $('#profile-name').textContent = `${p.name} (${chip}, ${p.display.driver.toUpperCase()} ${p.display.bus.toUpperCase()})`;
  }

  private renderActivePane() {
    if (this.activeTab === 'images') this.images.render();
    if (this.activeTab === 'tiles') this.tiles.render();
    if (this.activeTab === 'backgrounds') this.backgrounds.render();
    if (this.activeTab === 'map') this.map.render();
  }

  async selectTab(tab: string) {
    const request = ++this.tabRequest;
    if (tab === 'javascript' || tab === 'python') {
      clearTimeout(this.buildTimer);
      this.runBuild(false);
      let code: string;
      if (this.project.source?.language === tab) code = this.project.source.code;
      else {
        if (this.build?.diagnostics.some(d => d.level === 'error')) {
          toast(t('code.fixErrors'), 'error'); return;
        }
        code = generateSource(this.build!.program, this.project, tab);
      }
      if (!this.textEditors[tab]) {
        const {TextEditor} = await import('./text-editor');
        if (request !== this.tabRequest) return;
        this.textEditors[tab] = new TextEditor($(`#${tab}-editor`), tab, code => {
          this.project.source = {language: tab, code};
          this.scheduleBuild();
        });
      }
      this.textEditors[tab]!.setCode(code);
      // Opening a text view does not take ownership until the first edit.
      if (this.project.source) {
        this.project.source = {language: tab, code};
        this.runBuild(false);
      }
    }
    this.activeTab = tab;
    document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    document.querySelectorAll<HTMLElement>('.pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${tab}`));
    if (tab === 'blocks') {
      $('#pane-blocks').inert = !!this.project.source;
      $('#blockly').classList.toggle('text-mode-blocks', !!this.project.source);
      Blockly.svgResize(this.ws);
      if (this.project.source) toast(t('code.blocksCopy'));
    }
    this.renderActivePane();
    if (tab === 'code') this.showSelected(Blockly.getSelected()?.id);
  }

  // Settings --------------------------------------------------------------

  async apply(next: Settings) {
    const langChanged = next.language !== this.settings.language;
    const themeChanged = next.theme !== this.settings.theme;
    const profileChanged = next.profileId !== this.settings.profileId;
    this.settings = { ...next };
    saveSettings(this.settings);
    setSecretProfiles(!!this.settings.secretTiny);
    applyPageTheme(this.settings.theme as ThemeId);
    this.runner.pixelColor = this.settings.pixelColor as PixelColor;
    if (this.hasProject && this.project.pixelColor !== this.runner.pixelColor) {
      this.project.pixelColor = this.runner.pixelColor;
      this.scheduleSave();
    }
    this.renderSimControls();
    this.runner.setMuted(this.settings.muted);
    if (langChanged) {
      this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
      await loadLanguage(this.settings.language);
      setAssetLabels(kindName, t('ui.none'), t('tiles.emptyTile'));
      translatePage();
      this.fillLanguageSelect();
      this.renderSimControls();
      this.renderSimView();
      this.reinjectWorkspace();
      this.renderTips();
      this.renderActivePane();
      this.runBuild(false);
    } else if (themeChanged) {
      this.ws.setTheme(blocklyTheme(this.settings.theme as ThemeId));
      this.guide.render();
    }
    if (this.homeVisible) await this.showHome(false);
    if (profileChanged && this.project) {
      const p = await this.defaultProfile();
      if (await confirmDialog(t('settings.profile'), t('settings.applyProfile', { name: p.name }), t('ui.yes'))) this.setProfile(p);
    }
  }

  async defaultProfile(): Promise<Profile> {
    const list = await allProfiles();
    return list.find((p) => p.id === this.settings.profileId) ?? BUILTIN_PROFILES[0];
  }

  setProfile(p: Profile) {
    this.project.profile = JSON.parse(JSON.stringify(p));
    this.renderProfile();
    this.runBuild(true);
  }

  private fillLanguageSelect() {
    const trigger = $('#lang');
    const menu = $('#language-menu');
    trigger.textContent = LANGUAGES.find((language) => language.code === this.settings.language)?.name ?? 'English';
    clear(menu);
    for (const language of LANGUAGES) {
      const selected = language.code === this.settings.language;
      const option = h('button', {
        type: 'button', role: 'menuitemradio', 'aria-checked': String(selected), tabindex: '-1',
        onclick: async () => {
          menu.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
          if (!selected) await this.apply({ ...this.settings, language: language.code });
        },
      }, h('span', { class: 'language-check', 'aria-hidden': 'true' }, selected ? '✓' : ''), language.name);
      menu.append(option);
    }
  }

  // Projects --------------------------------------------------------------

  async showHome(save = true) {
    if (save && !this.homeVisible && this.hasProject) {
      clearTimeout(this.buildTimer);
      clearTimeout(this.saveTimer);
      this.project.name = ($('#project-name') as HTMLInputElement).value.trim() || t('project.defaultName');
      this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
      this.project.modified = Date.now();
      await projectStore.save(this.project).catch(() => toast(t('project.saveError'), 'error'));
    }
    this.runner.stop();
    this.runner.clearScreen();
    this.homeVisible = true;
    document.body.classList.add('show-home');
    $('#editor-layout').hidden = true;
    const home = $('#home');
    home.hidden = false;
    const version = ++this.homeRender;
    clear(home);
    const heading = h('h1', { tabindex: '-1' }, t('home.title'));
    const templatesSection = h('section', { 'aria-label': t('home.templates') });
    const projectsSection = h('section', { 'aria-label': t('projects.title') });
    const guidesSection = h('section', { class: 'home-guides', 'aria-label': t('guide.homeTitle') });
    home.append(h('img', { class: 'home-header', src: `images/header_${headerImage}.jpg`, alt: '' }),
      h('div', { class: 'home-intro' }, heading, h('p', { class: 'muted' }, t('home.help')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: async () => this.loadProject(newProject(t('project.defaultName'), await this.defaultProfile())) }, t('home.create')),
        h('button', { onclick: () => this.importProject() }, t('menu.import')))),
      projectsSection, templatesSection, guidesSection);
    heading.focus();
    projectsSection.append(h('h2', {}, t('projects.title')), h('p', { class: 'muted' }, t('ui.loading')));
    templatesSection.append(h('h2', {}, t('home.templates')), h('p', { class: 'muted' }, t('ui.loading')));
    const [projects, templates] = await Promise.all([projectStore.list().catch(() => [] as Project[]), loadTemplates()]);
    if (!this.homeVisible || version !== this.homeRender) return;
    clear(projectsSection);
    clear(templatesSection);
    projectsSection.append(h('h2', {}, t('projects.title')));
    templatesSection.append(h('h2', {}, t('home.templates')));
    const fmt = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' });
    const projectGrid = h('div', { class: 'gallery home-projects' });
    for (const project of projects) {
      const remove = h('button', {
        class: 'home-project-action home-project-delete',
        title: `${t('ui.delete')} ${project.name}`,
        'aria-label': `${t('ui.delete')} ${project.name}`,
        onclick: async () => {
          if (!(await confirmDialog(t('projects.deleteTitle'), t('projects.deleteText', { name: project.name }), t('ui.delete')))) return;
          remove.disabled = true;
          try {
            if (project.id === this.project.id) {
              clearTimeout(this.saveTimer);
              clearTimeout(this.buildTimer);
            }
            await projectStore.remove(project.id);
            if (project.id === this.project.id) this.hasProject = false;
            if (this.settings.lastProjectId === project.id) {
              delete this.settings.lastProjectId;
              saveSettings(this.settings);
            }
            await this.showHome(false);
          } catch {
            remove.disabled = false;
            toast(t('project.saveError'), 'error');
          }
        },
      });
      remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
      const download = h('button', {
        class: 'home-project-action',
        title: `${t('menu.export')} ${project.name}`,
        'aria-label': `${t('menu.export')} ${project.name}`,
        onclick: () => void saveCartridge(project),
      });
      download.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
      const star = starButton(project, 'home-project-action', () => {
        if (project.id === this.project.id) this.project.starred = project.starred;
        void this.showHome(false);
      });
      const img = h('img', { alt: '', class: 'thumb' });
      void thumbnail(project).then((src) => { if (src) img.src = src; });
      projectGrid.append(h('div', { class: 'home-project-card' },
        h('button', { class: 'card', onclick: () => this.loadProject(project) }, img,
          h('strong', {}, project.name), h('span', { class: 'muted project-date' }, fmt.format(project.modified))), h('div', { class: 'home-project-actions' }, star, download, remove)));
    }
    projectsSection.append(projects.length ? projectGrid : h('p', { class: 'muted' }, t('projects.none')));
    const templateGrid = h('div', { class: 'gallery' });
    for (const template of templates) {
      if (template.id === 'template-empty') continue;
      const img = h('img', { alt: '', class: 'thumb' });
      void thumbnail(template).then((src) => { if (src) img.src = src; });
      templateGrid.append(h('button', { class: 'card', onclick: async () => {
        const project = instantiateTemplate(template, currentLanguage());
        project.profile = await this.defaultProfile();
        this.loadProject(project, { fromTemplate: true });
        this.selectTab('blocks');
      } }, img, h('strong', {}, localized(template.template?.title, currentLanguage()) || template.name),
      h('span', { class: 'muted small' }, localized(template.template?.description, currentLanguage()))));
    }
    templatesSection.append(templates.length ? templateGrid : h('p', { class: 'muted' }, t('gallery.none')));
    renderGuideCatalog(guidesSection, {
      stars: this.settings.guideStars ?? {},
      free: !!this.settings.guideFree,
      projects,
      setFree: (value) => { this.settings.guideFree = value; saveSettings(this.settings); },
      open: (g, step) => void this.openGuide(g, step),
    });
  }

  private async showGuides(save = true) {
    await this.showHome(save);
    document.querySelector('.home-guides')?.scrollIntoView();
  }

  /** Opens the user's project for a guide level, or starts the level. */
  private async openGuide(g: Guide, step?: number) {
    if (!this.homeVisible && this.hasProject) await this.showHome();
    const projects = await projectStore.list().catch(() => [] as Project[]);
    const existing = projects.find((p) => p.guide?.id === g.id);
    const project = existing ?? guideProject(g, currentLanguage(), await this.defaultProfile());
    if (step !== undefined && project.guide) {
      const reached = reachedStep(project);
      project.guide.reached = reached;
      project.guide.step = Math.min(Math.max(0, step), reached, g.steps.length - 1);
    }
    this.loadProject(project);
    this.selectTab('blocks');
  }

  async newFromGallery() {
    await openGallery(async (template) => {
      const p = instantiateTemplate(template, currentLanguage());
      p.profile = await this.defaultProfile();
      this.loadProject(p, { fromTemplate: true });
      this.selectTab('blocks');
    });
  }

  private async importProject() {
    const file = await pickProjectFile();
    if (!file) return;
    try {
      const p = file.name.toLowerCase().endsWith('.png') ? readCartridge(new Uint8Array(file.bytes)) : parseProject(new TextDecoder().decode(file.bytes));
      const known = await allProfiles();
      const profile = p.profile;
      if (!known.some((x) => x.id === profile.id)) {
        if (await confirmDialog(t('project.newProfileTitle'), t('project.newProfileText', { name: profile.name }), t('ui.yes'))) {
          await profileStore.save(profile);
        }
      }
      const existing = await projectStore.get(p.id).catch(() => undefined);
      if (existing && !(await confirmDialog(t('project.replaceTitle'), t('project.replaceText', { name: existing.name }), t('ui.yes')))) {
        p.id = newProject(p.name).id;
      }
      this.loadProject(p);
      toast(t('project.imported', { name: p.name }), 'ok');
    } catch (e) {
      toast(t((e as Error).message), 'error');
    }
  }

  private exportProject() {
    this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
    void saveCartridge(this.project, this.runner.pixelColor);
  }

  downloadSketch() {
    clearTimeout(this.buildTimer);
    this.runBuild(false);
    if (!this.build) return;
    if (this.build.diagnostics.some(d => d.level === 'error')) {toast(t('device.fixErrors'), 'error');return;}
    const zip = sketchZip(this.project, this.build.cpp.code);
    downloadFile(`${safeFileName(this.project.name)}.zip`, zip as BlobPart, 'application/zip');
  }

  // Events ----------------------------------------------------------------

  /** A click opens the settings. Holding the button for 5 seconds also shows the secret ones. */
  private bindSettingsButton() {
    const button = $('#btn-settings');
    let timer = 0;
    let held = false;
    const start = () => {
      held = false;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        held = true;
        void openSettings(this, true);
      }, 5000);
    };
    const end = () => clearTimeout(timer);
    button.addEventListener('pointerdown', start);
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, end);
    // Space clicks when it is let go, so holding it works like holding the pointer.
    button.addEventListener('keydown', (e) => { if (e.key === ' ' && !e.repeat) start(); });
    button.addEventListener('keyup', end);
    button.addEventListener('blur', end);
    // A long press on a touch screen must not open a menu.
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    button.addEventListener('click', () => {
      if (held) held = false;
      else void openSettings(this);
    });
  }

  private bindUi() {
    document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => this.selectTab(b.dataset.tab!)));
    $('#btn-home').addEventListener('click', () => this.showHome());
    $('#btn-guides').addEventListener('click', () => void this.showGuides());
    $('#btn-new').addEventListener('click', () => this.newFromGallery());
    $('#btn-open').addEventListener('click', () => openProjectsDialog(this.project, (p) => this.loadProject(p)));
    $('#btn-import').addEventListener('click', () => this.importProject());
    $('#btn-export').addEventListener('click', () => this.exportProject());
    this.bindSettingsButton();
    $('#btn-docs').addEventListener('click', () => openDocs(this.settings.theme as ThemeId, undefined, !!this.settings.secretTiny));
    setBlockInfoHandler((type) => openDocs(this.settings.theme as ThemeId, type, !!this.settings.secretTiny));
    const languageTrigger = $('#lang');
    const languageMenu = $('#language-menu');
    const closeLanguageMenu = (restoreFocus = false) => {
      languageMenu.hidden = true;
      languageTrigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) languageTrigger.focus();
    };
    const openLanguageMenu = () => {
      languageMenu.hidden = false;
      languageTrigger.setAttribute('aria-expanded', 'true');
      languageMenu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    };
    languageTrigger.addEventListener('click', () => languageMenu.hidden ? openLanguageMenu() : closeLanguageMenu());
    languageTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        openLanguageMenu();
      }
    });
    $('#language-picker').addEventListener('keydown', (event) => {
      if (languageMenu.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeLanguageMenu(true); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const options = Array.from(languageMenu.querySelectorAll<HTMLButtonElement>('button'));
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      } else if (event.key === 'Tab') closeLanguageMenu();
    });
    document.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Node && !$('#language-picker').contains(event.target)) closeLanguageMenu();
    });
    $('#language-picker').addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !$('#language-picker').contains(event.relatedTarget)) closeLanguageMenu();
    });
    const name = $('#project-name') as HTMLInputElement;
    name.addEventListener('change', () => {
      this.project.name = name.value.trim() || t('project.defaultName');
      name.value = this.project.name;
      this.runBuild(false);
    });
    $('#btn-profile').addEventListener('click', () => openProfileDialog(this.project.profile, (p) => this.setProfile(p)));
    $('#btn-copy-code').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.codeView.code);
        toast(t('code.copied'), 'ok');
      } catch {
        toast(t('code.copyFailed'), 'error');
      }
    });

    document.querySelectorAll<HTMLButtonElement>('[data-restore-blocks]').forEach(button => button.addEventListener('click', async () => {
      if (!this.project.source) {this.selectTab('blocks');return;}
      if (await confirmDialog(t('code.restoreBlocks'), t('code.restoreConfirm'))) {
        delete this.project.source;
        $('#pane-blocks').inert = false;
        $('#blockly').classList.remove('text-mode-blocks');
        this.runBuild(true);
        this.selectTab('blocks');
      }
    }));

    // Simulator controls
    this.renderSimView();
    $('#btn-sim-view').addEventListener('click', () => {
      this.simStandalone = !this.simStandalone;
      this.renderSimView();
      $('#sim').focus();
    });
    $('#btn-sim-close').addEventListener('click', () => {
      this.simStandalone = false;
      this.renderSimView();
      $('#btn-sim-view').focus();
    });
    $('#btn-sim-size').addEventListener('click', () => {
      this.simSize = (this.simSize + 1) % 3;
      this.renderSimView();
      $('#sim').focus();
    });
    this.renderSimControls();
    $('#btn-run').addEventListener('click', () => {
      if (this.runner.running) {
        this.runner.resumeAudio();
        this.runner.togglePause();
        return;
      }
      clearTimeout(this.buildTimer);
      this.runBuild(false);
      this.runner.resumeAudio();
      this.restartSim();
    });
    $('#btn-restart').addEventListener('click', () => {
      clearTimeout(this.buildTimer);
      this.runBuild(false);
      this.runner.resumeAudio();
      this.restartSim();
    });
    $('#btn-stop').addEventListener('click', () => {
      this.runner.stop();
      this.runner.clearScreen();
      this.simMessage(t('sim.ready'), 'info');
    });
    $('#btn-sim-color').addEventListener('click', () => {
      this.settings.pixelColor = this.runner.cyclePixelColor();
      this.project.pixelColor = this.runner.pixelColor;
      this.scheduleSave();
      saveSettings(this.settings);
      this.renderSimControls();
    });
    $('#btn-mute').addEventListener('click', () => {
      this.runner.setMuted(!this.runner.muted);
      this.settings.muted = this.runner.muted;
      saveSettings(this.settings);
    });
    document.querySelectorAll<HTMLButtonElement>('.pad [data-btn]').forEach((b) => {
      const id = b.dataset.btn as (typeof BUTTON_IDS)[number];
      const down = (e: PointerEvent) => {
        e.preventDefault();
        $('#sim').focus({ preventScroll: true });
        b.setPointerCapture(e.pointerId);
        this.runner.setTouch(id, true);
      };
      const up = () => this.runner.setTouch(id, false);
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('pointercancel', up);
    });
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('.blocklyWidgetDiv, dialog, .pixel-editor, .language-picker, .monaco-editor'));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.simStandalone) {
        this.simStandalone = false;
        this.renderSimView();
        $('#btn-sim-view').focus();
        return;
      }
      if (this.homeVisible || editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.runner.keyDown(e)) {
        e.preventDefault();
        this.runner.resumeAudio();
      }
    });
    window.addEventListener('keyup', (e) => this.runner.keyUp(e));
    window.addEventListener('blur', () => this.runner.releaseAll());
    window.addEventListener('resize', () => Blockly.svgResize(this.ws));
  }
}

