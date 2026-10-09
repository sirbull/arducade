// The editor: connects the block workspace, the asset tabs, the code view,
// the simulator and the device panel.

import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { setAssetLabels, setAssetProject } from '../blocks/assets';
import { defineBlocks } from '../blocks/defs';
import { buildToolbox } from '../blocks/toolbox';
import { getChip } from '../hw/chips';
import { BUILTIN_PROFILES, DEFAULT_PROFILE_ID, type Profile } from '../hw/profile';
import { currentLanguage, kindName, LANGUAGES, loadLanguage, t, translatePage } from '../i18n/i18n';
import type { Diagnostic } from '../ir/ir';
import { instantiateTemplate, localized, newProject, parseProject, PROJECT_EXTENSION, serializeProject, type Project } from '../project/model';
import { sketchZip } from '../project/sketch';
import { downloadFile, loadSettings, pickTextFile, profiles as profileStore, projects as projectStore, safeFileName, saveSettings, type Settings } from '../project/store';
import { Runner, type PixelColor } from '../sim/runner';
import { BUTTON_IDS } from '../engine/enums';
import { ImagesPane, MapPane, TilesPane } from './assets-panes';
import { buildWorkspace, type BuildResult } from './build';
import { CodeView } from './code-view';
import { confirmDialog } from './dialogs';
import { $, clear, h, toast } from './dom';
import { openGallery, openProjectsDialog } from './gallery';
import { allProfiles, loadServerProfiles, openProfileDialog, profileFromUrl } from './profile-editor';
import { openFirstRun, openSettings } from './settings-dialog';
import { applyPageTheme, blocklyTheme, THEME_IDS, type ThemeId } from './themes';
import { DeviceTools } from './device';

const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'arduboy',
  pixelColor: 'white',
  profileId: DEFAULT_PROFILE_ID,
  muted: false,
  firstRunDone: false,
};

export class App {
  settings: Settings = loadSettings(DEFAULT_SETTINGS);
  project: Project = newProject('Game');
  ws!: Blockly.WorkspaceSvg;
  runner!: Runner;
  build: BuildResult | null = null;
  private codeView!: CodeView;
  private images!: ImagesPane;
  private tiles!: TilesPane;
  private map!: MapPane;
  private device!: DeviceTools;
  private buildTimer = 0;
  private saveTimer = 0;
  private loading = false;
  private activeTab = 'blocks';
  private lastJs = '';

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
    });
    this.runner.pixelColor = this.settings.pixelColor as PixelColor;
    this.runner.muted = this.settings.muted;
    const host = { project: () => this.project, changed: (structural: boolean) => this.assetsChanged(structural) };
    this.images = new ImagesPane($('#pane-images'), host);
    this.tiles = new TilesPane($('#pane-tiles'), host);
    this.map = new MapPane($('#pane-map'), host);
    this.device = new DeviceTools(this);

    this.injectWorkspace();
    this.bindUi();
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
    else {
      this.loadProject(newProject(t('project.defaultName'), await this.defaultProfile()));
      void this.newFromGallery();
    }
  }

  // Workspace -------------------------------------------------------------

  private injectWorkspace() {
    this.ws = Blockly.inject($('#blockly'), {
      toolbox: buildToolbox() as unknown as Blockly.utils.toolbox.ToolboxDefinition,
      theme: blocklyTheme(this.settings.theme as ThemeId),
      renderer: 'zelos',
      grid: { spacing: 24, length: 2, colour: 'rgba(128,128,128,0.25)', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.3 },
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: false },
      sounds: false,
      media: 'blockly-media/',
    });
    this.ws.addChangeListener(Blockly.Events.disableOrphans);
    this.ws.addChangeListener((e) => {
      if (this.loading) return;
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
    this.project = p;
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

  /** Regenerates code from the blocks and restarts the simulator. */
  runBuild(forceRestart: boolean) {
    this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
    this.build = buildWorkspace(this.ws, this.project);
    this.codeView.setCode(this.build.cpp.code);
    this.renderProblems(this.build.diagnostics);
    this.device.estimate();
    this.scheduleSave();
    if (forceRestart || this.build.js.code !== this.lastJs) {
      this.lastJs = this.build.js.code;
      this.restartSim();
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
    this.runBuild(true);
  }

  private scheduleSave() {
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
    void this.runner.start(this.build.js, `ardublocks.eeprom.${this.project.id}`, this.maxSprites());
  }

  /** Same number of sprites as the device, which has fewer on small chips. */
  maxSprites(): number {
    try {
      return getChip(this.project.profile.chip).ram < 2560 ? 12 : 16;
    } catch {
      return 16;
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
    const tips = this.project.template?.tips ?? [];
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
    if (this.activeTab === 'map') this.map.render();
  }

  selectTab(tab: string) {
    this.activeTab = tab;
    document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    document.querySelectorAll<HTMLElement>('.pane').forEach((p) => p.classList.toggle('active', p.id === `pane-${tab}`));
    if (tab === 'blocks') Blockly.svgResize(this.ws);
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
    applyPageTheme(this.settings.theme as ThemeId);
    this.runner.pixelColor = this.settings.pixelColor as PixelColor;
    if (langChanged) {
      this.project.blocks = Blockly.serialization.workspaces.save(this.ws);
      await loadLanguage(this.settings.language);
      setAssetLabels(kindName, t('ui.none'), t('tiles.emptyTile'));
      translatePage();
      this.fillLanguageSelect();
      this.reinjectWorkspace();
      this.renderTips();
      this.renderActivePane();
      this.runBuild(false);
    } else if (themeChanged) {
      this.ws.setTheme(blocklyTheme(this.settings.theme as ThemeId));
    }
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
    const sel = $('#lang') as HTMLSelectElement;
    clear(sel);
    for (const l of LANGUAGES) sel.append(h('option', { value: l.code, selected: l.code === this.settings.language }, l.name));
    sel.value = this.settings.language;
  }

  // Projects --------------------------------------------------------------

  async newFromGallery() {
    await openGallery(async (template) => {
      const p = instantiateTemplate(template, currentLanguage());
      p.profile = await this.defaultProfile();
      this.loadProject(p, { fromTemplate: true });
      this.selectTab('blocks');
    });
  }

  private async importProject() {
    const file = await pickTextFile(`${PROJECT_EXTENSION},.json`);
    if (!file) return;
    try {
      const p = parseProject(file.text);
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
    downloadFile(safeFileName(this.project.name) + PROJECT_EXTENSION, serializeProject(this.project));
  }

  downloadSketch() {
    if (!this.build) return;
    const zip = sketchZip(this.project, this.build.cpp.code);
    downloadFile(`${safeFileName(this.project.name)}.zip`, zip as BlobPart, 'application/zip');
  }

  // Events ----------------------------------------------------------------

  private bindUi() {
    document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => this.selectTab(b.dataset.tab!)));
    $('#btn-new').addEventListener('click', () => this.newFromGallery());
    $('#btn-open').addEventListener('click', () => openProjectsDialog(this.project.id, (p) => this.loadProject(p)));
    $('#btn-import').addEventListener('click', () => this.importProject());
    $('#btn-export').addEventListener('click', () => this.exportProject());
    $('#btn-settings').addEventListener('click', () => openSettings(this));
    $('#lang').addEventListener('change', (e) => this.apply({ ...this.settings, language: (e.target as HTMLSelectElement).value }));
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

    // Simulator controls
    $('#btn-run').addEventListener('click', () => (this.runner.resumeAudio(), this.restartSim()));
    $('#btn-stop').addEventListener('click', () => this.runner.stop());
    const mute = $('#btn-mute');
    const showMute = () => (mute.textContent = this.runner.muted ? t('sim.unmute') : t('sim.mute'));
    showMute();
    mute.addEventListener('click', () => {
      this.runner.muted = !this.runner.muted;
      this.settings.muted = this.runner.muted;
      saveSettings(this.settings);
      showMute();
    });
    document.querySelectorAll<HTMLButtonElement>('.pad [data-btn]').forEach((b) => {
      const id = b.dataset.btn as (typeof BUTTON_IDS)[number];
      const down = (e: Event) => (e.preventDefault(), b.classList.add('down'), this.runner.setTouch(id, true));
      const up = () => (b.classList.remove('down'), this.runner.setTouch(id, false));
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    });
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('.blocklyWidgetDiv, dialog'));
    window.addEventListener('keydown', (e) => {
      if (editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
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

