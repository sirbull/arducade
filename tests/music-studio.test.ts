// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MusicPane } from '../src/ui/music-studio';
import { newProject, serializeProject, parseProject } from '../src/project/model';
import { sequence } from '../src/engine/sequencer';
import { loadLanguage } from '../src/i18n/i18n';
import en from '../public/locales/en.json';
const stop=vi.fn(), play=vi.fn();
vi.mock('../src/sim/song-audition',()=>({SongAudition: class {play=play;stop=stop;}}));
beforeEach(async()=>{vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>en}));await loadLanguage('en');document.body.replaceChildren();play.mockClear();stop.mockClear();});
afterEach(()=>vi.unstubAllGlobals());
const click=(name: string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===name)!.click();
const setup=()=>{const root=document.createElement('div');document.body.append(root);const project=newProject('Studio');const changed=vi.fn();const pane=new MusicPane(root,{project:()=>project,changed});pane.render();return {pane,project,changed};};
const surface=()=>{
 const s=document.querySelector<HTMLElement>('.studio-note-surface')!;
 vi.spyOn(s,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:640,bottom:360,width:640,height:360,toJSON:()=>({})});return s;
};
function pointer(target: HTMLElement,type: string,step: number,row=9,id=1,pointerType='mouse') {
 const e=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:step*20+10,clientY:row*30+15});
 Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:pointerType}});target.dispatchEvent(e);
}
it('draws a duration by dragging and saves only the selected voice',()=>{
 const {project,changed}=setup();click('Add melody');click('Polyphonic');click('Add song');
 expect(document.querySelectorAll('.studio-track')).toHaveLength(4);
 document.querySelectorAll<HTMLButtonElement>('.studio-track-label > button:first-child')[1].click();
 const before=[...project.songs[0].voices], grid=surface();changed.mockClear();
 pointer(grid,'pointerdown',4);pointer(grid,'pointermove',11);
 expect(project.songs[0].voices).toEqual(before);pointer(grid,'pointerup',11);
 const note=sequence(project.songs[0].voices[1]).notes[0];expect(note).toEqual({at:4,length:8,frequency:294});
 expect(changed).toHaveBeenCalledExactlyOnceWith(false);expect(project.songs[0].voices[0]).toBe(before[0]);
 expect(parseProject(serializeProject(project)).songs).toEqual(project.songs);
 click('Beep');expect(project.melodies[0].notes).toBe('C D E C');
});
it('moves the middle, resizes both ends and deletes a selected note with undo',()=>{
 const {project}=setup();click('Add melody');const grid=surface();
 pointer(grid,'pointerdown',16);pointer(grid,'pointerup',23); // pointerup coordinates also finish the drawing
 let note=document.querySelector<HTMLElement>('.studio-note.selected')!;
 pointer(note,'pointerdown',19);pointer(grid,'pointerup',23);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toEqual({at:20,length:8,frequency:294});
 note=document.querySelector<HTMLElement>('.studio-note.selected')!;
 pointer(note.querySelector<HTMLElement>('[data-edge="left"]')!,'pointerdown',20);pointer(grid,'pointerup',18);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toMatchObject({at:18,length:10});
 note=document.querySelector<HTMLElement>('.studio-note.selected')!;
 pointer(note.querySelector<HTMLElement>('[data-edge="right"]')!,'pointerdown',27);pointer(grid,'pointerup',25);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toMatchObject({at:18,length:8});
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
 expect(sequence(project.melodies[0].notes).notes).toHaveLength(4);click('Undo');
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toMatchObject({at:18,length:8});
});
it('selects without deleting and supports right-click deletion and touch controls',()=>{
 const {project}=setup();click('Add melody');const grid=surface(), before=project.melodies[0].notes;
 let note=document.querySelector<HTMLElement>('.studio-note')!;
 pointer(note,'pointerdown',1,11,4,'touch');pointer(grid,'pointerup',1,11,4,'touch');expect(project.melodies[0].notes).toBe(before);
 document.querySelector<HTMLButtonElement>('[aria-label="Lengthen note"]')!.click();expect(sequence(project.melodies[0].notes).notes[0].length).toBe(5);
 click('Undo');note=document.querySelector<HTMLElement>('.studio-note')!;
 note.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:10,clientY:345}));
 document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();expect(sequence(project.melodies[0].notes).notes).toHaveLength(3);
});
it('rolls back on pointer cancellation, capture loss, blur and tab changes; ignores second touches',()=>{
 const {pane,project,changed}=setup();click('Add melody');const grid=surface(), before=project.melodies[0].notes;
 changed.mockClear();
 for(const reason of ['pointercancel','lostpointercapture','blur']) {
  pointer(grid,'pointerdown',16,9,1,'touch');pointer(grid,'pointermove',20,9,1,'touch');
  if(reason==='blur')window.dispatchEvent(new Event('blur'));else pointer(grid,reason,20);
  pointer(grid,'pointerup',20,9,1,'touch');expect(project.melodies[0].notes).toBe(before);
 }
 pointer(grid,'pointerdown',16);pointer(grid,'pointerdown',30,9,2,'touch');pointer(grid,'pointerup',31,9,2,'touch');pointer(grid,'pointercancel',31,9,2,'touch');
 expect(project.melodies[0].notes).toBe(before);pane.stop();pointer(grid,'pointerup',20);
 expect(project.melodies[0].notes).toBe(before);expect(changed).not.toHaveBeenCalled();
});
it('supports drawing and editing with keyboard without typing shortcuts into note text',()=>{
 const {project}=setup();click('Add melody');const grid=surface();grid.focus();
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 expect(sequence(project.melodies[0].notes).notes[0]).toEqual({at:1,length:4,frequency:277});
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
 expect(sequence(project.melodies[0].notes).notes[0].length).toBe(5);
 const text=document.querySelector<HTMLTextAreaElement>('textarea')!;const before=project.melodies[0].notes;
 text.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));expect(project.melodies[0].notes).toBe(before);
 grid.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));expect(sequence(project.melodies[0].notes).notes).toHaveLength(2);
});
it('plays all voices together and applies preview solo without changing saved tracks',()=>{
 const {pane,project}=setup();click('Polyphonic');click('Add song');const before=JSON.stringify(project.songs[0]);
 document.querySelector<HTMLButtonElement>('[aria-label="Solo preview Harmony"]')!.click();
 [...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('▶'))!.click();
 expect(play).toHaveBeenCalledOnce();expect(play.mock.calls[0][0].voices).toEqual(project.songs[0].voices);expect(play.mock.calls[0][3]).toBe(13);
 expect(JSON.stringify(project.songs[0])).toBe(before);pane.stop();expect(stop).toHaveBeenCalled();
});
it('duplicates all four voices independently and blocks invalid note text from playback',()=>{
 const {project}=setup();click('Polyphonic');click('Add song');click('Duplicate');
 expect(project.songs).toHaveLength(2);expect(project.songs[0].voices).not.toBe(project.songs[1].voices);
 const notes=document.querySelector<HTMLTextAreaElement>('textarea')!;notes.value='invalid';notes.dispatchEvent(new Event('input'));
 [...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('▶'))!.click();expect(play).not.toHaveBeenCalled();
});

it('draws backwards, clamps at the grid boundaries and never makes a zero-length note',()=>{
 const {project}=setup();click('Add melody');const grid=surface();
 pointer(grid,'pointerdown',26);pointer(grid,'pointerup',20);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toEqual({at:20,length:7,frequency:294});
 const selected=document.querySelector<HTMLElement>('.studio-note.selected')!;
 pointer(selected.querySelector<HTMLElement>('[data-edge="right"]')!,'pointerdown',26);pointer(grid,'pointerup',-4);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toMatchObject({at:20,length:1});
 pointer(grid,'pointerdown',29);pointer(grid,'pointerup',40);
 expect(sequence(project.melodies[0].notes).notes.at(-1)).toMatchObject({at:29,length:3});
});

it('undo restores the original timing after extending a short melody',()=>{
 const {project}=setup();click('Add melody');const grid=surface();const before=sequence(project.melodies[0].notes);
 pointer(grid,'pointerdown',20);pointer(grid,'pointerup',27);
 expect(sequence(project.melodies[0].notes).length).toBe(28);
 click('Undo');expect(sequence(project.melodies[0].notes)).toEqual(before);
});

it('keeps the four-track overview in sync with edits and undo, and opens notes on later pages',()=>{
 const {project}=setup();click('Polyphonic');click('Add song');
 const initial=document.querySelectorAll('.studio-overview-note').length;
 document.querySelectorAll<HTMLButtonElement>('.studio-track-label > button:first-child')[1].click();
 const grid=surface();pointer(grid,'pointerdown',20);pointer(grid,'pointerup',23);
 expect(document.querySelectorAll('.studio-overview-note')).toHaveLength(initial+1);
 const added=document.querySelectorAll<HTMLElement>('.studio-overview-lane')[1].querySelector<HTMLElement>('[aria-label="Harmony · D4 · 2.2"]')!;
 expect(added).not.toBeNull();expect(added.style.left).toBe('31.25%');expect(added.style.width).toBe('6.25%');
 click('Undo');expect(document.querySelectorAll('.studio-overview-note')).toHaveLength(initial);
 const text=document.querySelector<HTMLTextAreaElement>('textarea')!;text.value='R:12 G5:2';text.dispatchEvent(new Event('input'));
 const later=document.querySelector<HTMLButtonElement>('[aria-label="Harmony · G5 · 4.1"]')!;
 expect(later).not.toBeNull();later.click();
 expect(document.querySelector<HTMLElement>('.studio-track.selected strong')!.textContent).toBe('Harmony');
 expect(document.querySelector<HTMLSelectElement>('.studio-roll-tools select')!.value).toBe('5');
 expect(document.querySelector('[aria-label="G5, 2 beats"]')).not.toBeNull();
 expect(sequence(project.songs[0].voices[1]).notes[0].at).toBe(48);
 click('Beep');expect(document.querySelector('.studio-arrangement')).toBeNull();
});
