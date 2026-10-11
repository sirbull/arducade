import { t } from '../i18n/i18n';
import { h } from './dom';
import { MUSIC_EXAMPLES } from './docs-music-examples';
import beepImage from '../../docs/images/music-beep.png';
import editImage from '../../docs/images/music-edit.png';
import polyImage from '../../docs/images/music-polyphonic.png';
import recorderImage from '../../docs/images/music-recorder.png';

type Json = Record<string, any>;
const number = (n: number) => ({shadow: {type: 'math_number', fields: {NUM: n}}});
const event = (type: string, block: Json, fields?: Json) => ({type, fields, inputs: {DO: {block}}});
const code = (text: string) => h('pre', {}, h('code', {}, text));

/** A practical tutorial; the block reference remains in the Music category. */
export function musicGuide(picture: (blocks: Json[]) => HTMLElement): HTMLElement {
  const root = h('div', {class: 'docs-illustrated docs-music'});
  const images: Record<string, string> = {beep: beepImage, edit: editImage, poly: polyImage, recorder: recorderImage};
  const sections = ['choose','beep','edit','poly','recorder','notation','blocks','tones','effects','pitch','arrange','hardware','fix'];
  for (const id of sections) {
    const section = h('article', {class: 'docs-step'}, h('h3', {}, t(`docs.music.${id}.title`)),
      ...t(`docs.music.${id}.body`).split('\n\n').map(p => h('p', {}, p)));
    if (images[id]) section.append(h('figure', {class: 'docs-figure'},
      h('a', {href: images[id],target: '_blank',rel: 'noopener','aria-label': t('docs.visual.enlarge')},
        h('img', {src: images[id],alt: t(`docs.music.${id}.title`),loading: 'lazy',decoding: 'async'})),
      h('figcaption', {}, t(`docs.music.${id}.title`))));
    if (id === 'beep') section.append(h('h4', {}, t('docs.music.try')), code(MUSIC_EXAMPLES.melody));
    if (id === 'poly') MUSIC_EXAMPLES.voices.forEach((text, i) => section.append(h('h4', {}, t(`music.track.${i}`)), code(text)));
    if (id === 'notation') section.append(code(MUSIC_EXAMPLES.inheritance));
    if (id === 'blocks') section.append(picture([
      event('ab_on_start', {type:'ab_play_song',fields:{SONG:'title',MODE:'loop'}}),
      event('ab_on_button', {type:'ab_play_effect',fields:{SFX:'coin'}}, {BUTTON:'a',EVENT:'pressed'}),
    ]));
    if (id === 'tones') section.append(picture([event('ab_on_button', {type:'ab_play_tone',inputs:{FREQ:{shadow:{type:'ab_note',fields:{NOTE:'440'}}},MS:number(200)}},{BUTTON:'a',EVENT:'pressed'})]));
    if (id === 'pitch') section.append(picture([event('ab_on_button', {
      type:'ab_pitch',inputs:{FROM:number(90),TO:number(110),DO:{block:{type:'ab_play_poly_effect',fields:{SFX:'shield'}}}},
    },{BUTTON:'b',EVENT:'pressed'})]));
    root.append(section);
  }
  root.append(h('article', {class:'docs-step'},h('h3',{},t('docs.music.code.title')),
    h('p',{},t('docs.music.code.body')),h('h4',{},'JavaScript'),code(MUSIC_EXAMPLES.javascript),h('h4',{},'Python'),code(MUSIC_EXAMPLES.python)),
    h('article',{class:'docs-step'},h('h3',{},t('docs.music.download')),h('p',{},t('docs.music.downloadBody')),
      h('a',{href:`${import.meta.env.BASE_URL}examples/music-guide.abproject`,download:'music-guide.abproject'},t('docs.music.download'))));
  return root;
}
