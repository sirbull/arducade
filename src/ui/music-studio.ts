import * as Blockly from 'blockly/core';
import { h, clear, select, toast } from './dom';
import { confirmDialog } from './dialogs';
import { t } from '../i18n/i18n';
import { newId, type MelodyAsset, type SongAsset } from '../project/model';
import type { AssetHost } from './assets-panes';
import { noteFreq, parseMelody } from '../engine/melody';
import { sequence, sequenceText } from '../engine/sequencer';
import { SONGS, SONG_NAMES, type SongName } from '../engine/songs';
import { BeepAudition } from '../sim/beep';
import { SongAudition } from '../sim/song-audition';
import { openMelodyRecorder, keyboardIcon } from './melody-recorder';

import { PianoRoll } from './piano-roll';

const pitches = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const unique = (base: string, names: string[]) => { let name=base,n=2; while(names.includes(name)) name=`${base}${n++}`; return name; };
const validName = (name: string) => /^[\p{L}_][\p{L}\p{N}_ ]*$/u.test(name);

export class MusicPane {
  private mode: 'beep' | 'poly' = 'beep';
  private selected = { beep: '', poly: '' };
  private track = 0;
  private octave = 4;
  private page = 0;
  private looping = false;
  private muted = new Set<number>();
  private solo: number | null = null;
  private beep = new BeepAudition();
  private song = new SongAudition();
  private feedback: (quarter: number | null) => void = () => {};
  private isPlaying = false;
  private roll: PianoRoll | null = null;
  constructor(private root: HTMLElement, private host: AssetHost) {
    this.root.classList.add('music-pane');
    window.addEventListener('blur', () => this.stop());
    document.addEventListener('visibilitychange', () => { if(document.hidden) this.stop(); });
  }
  stop() { this.isPlaying=false; this.beep.stop(); this.song.stop(); this.feedback(null); this.roll?.cancel(); }
  render() {
    this.stop(); this.roll?.dispose(); this.roll=null; clear(this.root);
    const project = this.host.project(), poly = this.mode==='poly';
    const assets: (MelodyAsset | SongAsset)[] = poly ? project.songs : project.melodies;
    if(!assets.some(m=>m.id===this.selected[this.mode])) this.selected[this.mode]=assets[0]?.id??'';
    const asset=assets.find(m=>m.id===this.selected[this.mode]);
    const switchMode=(mode: 'beep'|'poly')=>{ this.mode=mode; this.octave=4; this.track=0; this.page=0; this.muted.clear(); this.solo=null; this.render(); };
    const add=()=>{
      const name=unique(poly?'song':'melody',assets.map(a=>a.name));
      const item = poly
        ? { id:newId('song'),name,tempo:120,voices:['C4:1 E G C4 R:12','C4:4 R:12','C3:4 R:12','C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:12.75'] as SongAsset['voices'] }
        : { id:newId('melody'),name,tempo:120,notes:'C D E C' };
      if(item.voices) project.songs.push(item); else project.melodies.push(item);
      this.selected[this.mode]=item.id; this.octave=4; this.track=0; this.page=0; this.host.changed(true); this.render();
    };
    const list=h('aside',{class:'asset-list music-library'},
      h('h3',{},t('music.title')),
      h('div',{class:'studio-modes',role:'tablist','aria-label':t('music.mode')},
        ...(['beep','poly'] as const).map(mode=>h('button',{role:'tab','aria-selected':String(this.mode===mode),class:this.mode===mode?'active':'',onclick:()=>switchMode(mode)},t(`music.mode.${mode}`)))),
      h('button',{class:'primary',onclick:add},t(poly?'music.addSong':'music.add')),
      ...assets.map(a=>h('button',{class:`asset-item ${a===asset?'active':''}`,onclick:()=>{this.selected[this.mode]=a.id;this.octave=4;this.track=0;this.page=0;this.muted.clear();this.solo=null;this.render();}},h('strong',{},a.name),h('small',{},`${a.tempo} BPM · ${poly?'4':'1'} ${t(poly?'music.tracks':'music.track')}`))));
    const editor=h('section',{class:'asset-editor music-editor music-studio','data-asset':`${this.mode}:${asset?.id??''}`}); this.root.append(list,editor);
    if(!asset) {
      editor.append(h('div',{class:'studio-empty'},h('div',{class:'studio-empty-icon','aria-hidden':'true'},'♫'),h('h2',{},t(poly?'music.mode.poly':'music.mode.beep')),h('p',{class:'muted'},t(poly?'music.polyHelp':'music.help')),h('button',{class:'primary',onclick:add},t(poly?'music.addSong':'music.add')))); return;
    }
    const voices = () => 'voices' in asset ? asset.voices : [asset.notes];
    const saveVoice=(value: string)=>{ if('voices' in asset)asset.voices[this.track]=value;else asset.notes=value;this.host.changed(false); };
    const trackName=(i: number)=>t(poly?`music.track.${i}`:'music.mode.beep');
    const name=h('input',{value:asset.name,'aria-label':t('images.name'),onchange:()=>{
      const next=name.value.trim();
      if(!validName(next)||assets.some(a=>a!==asset&&a.name===next)){toast(t('images.badName'),'error');name.value=asset.name;return;}
      asset.name=next;this.host.changed(true);this.render();
    }});
    const tempo=h('input',{type:'number',min:20,max:600,step:poly?10:1,value:asset.tempo,'aria-label':t('music.tempo'),onchange:()=>{
      this.stop();asset.tempo=Math.max(20,Math.min(600,Math.round((Number(tempo.value)||120)/(poly?10:1))*(poly?10:1)));tempo.value=String(asset.tempo);this.host.changed(false);
    }});
    const position=h('output',{class:'studio-position'},'1 : 1');
    const loop=h('input',{type:'checkbox',checked:this.looping,onchange:()=>{this.stop();this.looping=loop.checked;}});
    const transport=h('div',{class:'studio-transport'},
      h('button',{class:'primary',onclick:()=>play()},'▶ ',t('music.play')),
      h('button',{onclick:()=>this.stop()},'■ ',t('sim.stop')),
      h('label',{class:'inline'},loop,t('music.loop')),
      h('label',{class:'inline'},t('music.tempo'),tempo),position);
    editor.append(h('header',{class:'studio-header'},h('div',{class:'asset-props'},h('label',{class:'inline'},t('images.name'),name),
      h('button',{onclick:()=>{
        const copy={...asset,id:newId(poly?'song':'melody'),name:unique(asset.name,assets.map(a=>a.name))};
        if('voices' in copy)project.songs.push({...copy,voices:[...copy.voices]});else project.melodies.push(copy);
        this.selected[this.mode]=copy.id;this.host.changed(true);this.render();
      }},t('ui.duplicate')),
      h('button',{class:'danger',onclick:async()=>{
        if(await confirmDialog(t('ui.delete'),t('music.deleteText',{name:asset.name}),t('ui.delete'))){
          if(poly)project.songs=project.songs.filter(a=>a!==asset);else project.melodies=project.melodies.filter(a=>a!==asset);
          this.host.changed(true);this.render();
        }
      }},t('ui.delete'))),transport));
    const arrangement=h('div',{class:'studio-arrangement','aria-label':t('music.arrangement')});
    const lanes: HTMLElement[]=[];
    let overviewLength=32;
    const refreshOverview=()=>{
      if(!poly)return;
      const tracks=voices().map(sequence);
      overviewLength=Math.ceil(Math.max(32,(this.page+1)*32,...tracks.map(v=>v.length))/16)*16;
      const bars=overviewLength/16, stride=Math.max(1,Math.ceil(bars/8));
      const ruler=arrangement.querySelector<HTMLElement>('.studio-overview-ruler')!;
      clear(ruler);ruler.setAttribute('aria-label',t('music.bars',{from:1,to:bars}));
      for(let bar=0;bar<bars;bar+=stride){
        const label=h('span',{},String(bar+1));label.style.left=`${bar/bars*100}%`;ruler.append(label);
      }
      tracks.forEach((voice,i)=>{
        const lane=lanes[i];clear(lane);lane.style.setProperty('--bar-width',`${100/bars}%`);
        const viewport=h('i',{class:'studio-overview-window','aria-hidden':true});
        viewport.style.left=`${this.page*32/overviewLength*100}%`;viewport.style.width=`${32/overviewLength*100}%`;lane.append(viewport);
        voice.notes.forEach(note=>{
          const midi=Math.round(69+12*Math.log2(note.frequency/440));
          const label=i===3?'◆':`${pitches[midi%12]}${Math.floor(midi/12)-1}`;
          const clip=h('button',{class:'studio-overview-note',title:`${trackName(i)} · ${label} · ${note.length/4} ${t('music.beats')}`,
            'aria-label':`${trackName(i)} · ${label} · ${Math.floor(note.at/16)+1}.${Math.floor(note.at/4)%4+1}`,
            onclick:event=>{event.stopPropagation();this.track=i;this.page=Math.floor(note.at/32);this.octave=i===3?4:Math.max(2,Math.min(9,Math.floor(midi/12)-1));this.render();}},h('span',{},label));
          clip.style.left=`${note.at/overviewLength*100}%`;clip.style.width=`${note.length/overviewLength*100}%`;lane.append(clip);
        });
        lane.append(h('i',{class:'studio-overview-playhead',hidden:true,'aria-hidden':true}));
      });
    };
    if(poly){
      arrangement.append(h('div',{class:'studio-overview-heading'},h('span',{},t('music.arrangement')),h('div',{class:'studio-overview-ruler','aria-label':t('music.bars',{from:1,to:Math.ceil(Math.max(32,...voices().map(v=>sequence(v).length))/16)})})));
      voices().forEach((_,i)=>{
        const selectTrack=()=>{this.track=i;this.octave=i===2?3:4;this.render();};
        const previewToggle=(solo: boolean)=>{this.stop();if(solo)this.solo=this.solo===i?null:i;else if(this.muted.has(i))this.muted.delete(i);else this.muted.add(i);this.render();};
        const lane=h('div',{class:'studio-overview-lane',onclick:event=>{
          const rect=lane.getBoundingClientRect();this.track=i;this.page=Math.floor(Math.max(0,Math.min(overviewLength-1,((event as MouseEvent).clientX-rect.left)/rect.width*overviewLength))/32);this.octave=i===2?3:4;this.render();
        }});lanes.push(lane);
        arrangement.append(h('div',{class:`studio-track ${this.track===i?'selected':''}`,style:`--track:var(--track-${i})`},
          h('div',{class:'studio-track-label'},h('button',{onclick:selectTrack,'aria-pressed':String(this.track===i)},h('strong',{},trackName(i))),
            h('button',{'aria-label':`${t('music.mute')} ${trackName(i)}`,'aria-pressed':String(this.muted.has(i)),class:this.muted.has(i)?'active':'',onclick:()=>previewToggle(false)},'M'),
            h('button',{'aria-label':`${t('music.solo')} ${trackName(i)}`,'aria-pressed':String(this.solo===i),class:this.solo===i?'active':'',onclick:()=>previewToggle(true)},'S')),lane));
      });
      editor.append(arrangement);editor.classList.add('with-overview');refreshOverview();
    }
    const start=this.page*32, selected=sequence(voices()[this.track]);
    const base=(this.octave+1)*12;
    const nearby=selected.notes.map(n=>Math.round(69+12*Math.log2(n.frequency/440))).filter(m=>m>=base-12&&m<=base+24);
    const low=Math.min(base,...nearby), high=Math.min(low+24,Math.max(base+11,...nearby));
    const rows=this.track===3&&poly?[{label:'◆',frequency:noteFreq('C',4)}]:Array.from({length:high-low+1},(_,i)=>{
      const midi=high-i, pitch=pitches[midi%12], octave=Math.floor(midi/12)-1;
      return {label:`${pitch}${octave}`,frequency:noteFreq(pitch[0],octave,pitch.includes('#')?'#':''),disabled:poly&&(midi<47||midi>109)};
    });
    const refresh=()=>this.render();
    editor.append(h('div',{class:'studio-roll-tools'},
      ...(poly&&this.track===3?[]:[h('label',{class:'inline'},t('music.octave',{n:''}),select([2,3,4,5,6,7,8,9].map(v=>({value:String(v),label:String(v)})),String(this.octave),v=>{this.octave=Number(v);refresh();},{'aria-label':t('music.octave',{n:''})}))]),
      h('button',{disabled:this.page===0,onclick:()=>{this.page--;refresh();},'aria-label':t('music.previousBars')},'←'),
      h('span',{},t('music.bars',{from:this.page*2+1,to:this.page*2+2})),
      h('button',{onclick:()=>{this.page++;refresh();},'aria-label':t('music.nextBars')},'→'),
      h('button',{onclick:()=>{this.stop();openMelodyRecorder(voices()[this.track],asset.tempo,(text,bpm)=>{saveVoice(text);asset.tempo=poly?Math.round(bpm/10)*10:bpm;this.render();});}},keyboardIcon(),t('music.keyboard'))));
    editor.append(h('p',{class:'muted small studio-help'},t('music.gridHelp')));
    const roll=new PianoRoll({notes:selected.notes,start,rows,disabled:selected.bad.length>0,beforeEdit:()=>this.stop(),change:updated=>{
      saveVoice(sequenceText(updated,Math.max(selected.length,...updated.map(n=>n.at+n.length))));
      notes.value=voices()[this.track];refreshOverview();
    }});this.roll=roll;
    roll.element.style.setProperty('--track',`var(--track-${this.track})`);
    editor.append(roll.element,roll.tools);
    const notes=h('textarea',{rows:2,'aria-label':t('music.notes')});notes.value=voices()[this.track];
    const error=h('p',{class:'melody-errors',role:'status'});
    const validate=()=>{const bad=voices().flatMap(v=>parseMelody(v).bad);error.textContent=bad.length?t('diag.badNote',{notes:bad.join(' ')}):'';notes.setAttribute('aria-invalid',String(selected.bad.length>0));};validate();
    notes.addEventListener('input',()=>{this.stop();saveVoice(notes.value);refreshOverview();const bad=parseMelody(notes.value).bad;error.textContent=bad.length?t('diag.badNote',{notes:bad.join(' ')}):'';notes.setAttribute('aria-invalid',String(bad.length>0));});
    notes.addEventListener('change',()=>this.render());
    const details=h('details',{class:'studio-note-text'},h('summary',{},t('music.noteText')),notes,h('p',{class:'muted small'},t('music.syntax')));editor.append(error,details);
    if(poly)details.append(select([{value:'',label:t('music.loadPreset')},...SONG_NAMES.map(n=>({value:n,label:String(Blockly.Msg[`AB_SONG_${n.toUpperCase()}`]??n)}))],'',async v=>{
      if(!v)return;if(!await confirmDialog(t('music.loadPreset'),t('music.replaceTracks'),t('music.use')))return;
      const preset=SONGS[v as SongName];(asset as SongAsset).voices=[...preset.voices];asset.tempo=preset.tempo;this.host.changed(false);this.page=0;this.render();
    },{'aria-label':t('music.loadPreset')}));
    this.feedback=quarter=>{
      position.textContent=quarter===null?'1 : 1':`${Math.floor(quarter/16)+1} : ${Math.floor(quarter/4)%4+1}`;
      roll.playback(quarter);
      lanes.forEach(lane=>{const head=lane.querySelector<HTMLElement>('.studio-overview-playhead')!;head.hidden=quarter===null;head.style.left=`${(quarter??0)/overviewLength*100}%`;});
    };this.feedback(null);
    const play=()=>{
      this.stop(); if(voices().some(v=>parseMelody(v).bad.length)){validate();return;}
      this.isPlaying=true;
      if(poly){const mutedVoices=voices().reduce((mask,_,i)=>this.muted.has(i)||(this.solo!==null&&this.solo!==i)?mask|(1<<i):mask,0);this.song.play({voices:voices() as SongAsset['voices'],tempo:asset.tempo},this.looping,this.feedback,mutedVoices);}
      else{
        const steps=parseMelody((asset as MelodyAsset).notes).steps;let at=0;
        const positions=[] as number[];for(let i=0;i<steps.length;i+=2){positions.push(at);at+=steps[i+1];}
        const begin=()=>{void this.beep.play(steps,asset.tempo,(index)=>{if(index===null){this.feedback(null);if(this.looping&&this.isPlaying)begin();else this.isPlaying=false;}else this.feedback(positions[index]);});};
        if(steps.length)begin();else this.isPlaying=false;
      }
    };
  }
}
