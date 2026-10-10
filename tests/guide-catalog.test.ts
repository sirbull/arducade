// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderGuideCatalog, isGuideOpen, reachedStep, finishedGuideProject, type CatalogHost } from '../src/ui/guide-catalog';
import { openProjectSimulator } from '../src/ui/cartridge-simulator';
vi.mock('../src/ui/cartridge-simulator', () => ({ openProjectSimulator: vi.fn() }));
vi.mock('../src/ui/build',()=>({gameThumbnail:vi.fn().mockResolvedValue('')}));
HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
import { GUIDES } from '../src/guides/world1';
import { guideProject } from '../src/guides/guide';
function world(overrides: Partial<CatalogHost> = {}) {
  const root=document.createElement('div');document.body.append(root);
  const host:CatalogHost={stars:{},free:false,projects:[],setFree:vi.fn(),open:vi.fn(),...overrides};
  renderGuideCatalog(root,host);return {root,host};
}
afterEach(()=>{document.body.replaceChildren();vi.clearAllMocks();});
describe('guide catalog',()=>{
  it('previews every completed game, including locked projects, without starting a course', () => {
    const existing = guideProject(GUIDES[5], 'en');
    existing.guide!.step = 2;
    const snapshot = JSON.stringify(existing);
    const { root, host } = world({ projects: [existing] });
    for (const [index, guide] of GUIDES.entries()) {
      (root.querySelectorAll('.course-card')[index] as HTMLButtonElement).click();
      const button = document.querySelector<HTMLButtonElement>('.catalog-try')!;
      expect(button.disabled).toBe(false);
      button.click();
      const [project, title] = vi.mocked(openProjectSimulator).mock.calls.at(-1)!;
      expect(title).toBe(guide.title.en);
      expect(project.blocks).toBe(guide.steps.at(-1)!.solution);
      expect(project).not.toBe(existing);
      expect(document.querySelector('dialog')!.open).toBe(true);
      document.querySelector('dialog')!.close();
    }
    expect(host.open).not.toHaveBeenCalled();
    expect(JSON.stringify(existing)).toBe(snapshot);
  });
  it('builds complete preview projects with the guide assets', () => {
    for (const guide of GUIDES) {
      const project = finishedGuideProject(guide, 'en');
      expect(project.blocks).toBe(guide.steps.at(-1)!.solution);
      for (const image of guide.images) expect(project.images.some(asset => asset.id === image)).toBe(true);
    }
  });

  it('unlocks projects in order and supports free choice',()=>{
    expect(isGuideOpen(0,{},false)).toBe(true);
    expect(isGuideOpen(5,{},false)).toBe(false);
    expect(isGuideOpen(5,{[GUIDES[4].id]:1},false)).toBe(true);
    expect(isGuideOpen(9,{},true)).toBe(true);
    const {root,host}=world();
    expect(root.querySelectorAll('.course-card')).toHaveLength(11);
    expect(root.querySelectorAll('.course-card.open')).toHaveLength(1);
    const free=root.querySelector('input')!;free.checked=true;free.dispatchEvent(new Event('change'));
    expect(host.setFree).toHaveBeenCalledWith(true);
    expect(root.querySelectorAll('.course-card.open')).toHaveLength(11);
  });
  it('lets users inspect a locked project without launching it',()=>{
    const {root,host}=world();(root.querySelectorAll('.course-card')[5] as HTMLButtonElement).click();
    expect(document.querySelector('dialog h2')!.textContent).toBe(GUIDES[5].title.en);
    expect((document.querySelector('.catalog-start') as HTMLButtonElement).disabled).toBe(true);
    expect(host.open).not.toHaveBeenCalled();
  });
  it('preserves chapter access when users go back to earlier explanations',()=>{
    const guide=GUIDES[5];const project=guideProject(guide,'en');project.guide!.step=0;project.guide!.reached=4;
    expect(reachedStep(project)).toBe(4);
    const {root,host}=world({free:true,projects:[project]});
    (root.querySelectorAll('.course-card')[5] as HTMLButtonElement).click();
    const parts=document.querySelectorAll<HTMLButtonElement>('.catalog-part');
    expect(parts[0].classList.contains('done')).toBe(true);
    expect(parts[1].disabled).toBe(false);
    expect(parts[2].disabled).toBe(true);
    parts[1].click();expect(host.open).toHaveBeenCalledWith(guide,3);
    expect(project.guide!.step).toBe(0);
  });
  it('recommends the most recent unfinished project and resumes it directly',()=>{
    const earlier=guideProject(GUIDES[0],'en');earlier.modified=1;
    const recent=guideProject(GUIDES[5],'en');recent.modified=2;
    const {root,host}=world({free:true,projects:[earlier,recent]});
    expect(root.querySelector('.catalog-recommendation h3')!.textContent).toBe(GUIDES[5].title.en);
    (root.querySelector('.catalog-resume') as HTMLButtonElement).click();
    expect(host.open).toHaveBeenCalledWith(GUIDES[5]);
    expect([...root.querySelectorAll<HTMLButtonElement>('.course-card')].every(card=>card.tabIndex===0)).toBe(true);
  });
});
