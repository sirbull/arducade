import { formatMelody, MelodyRecording, noteFreq, parseMelody, type MelodyToken } from '../engine/melody';
import { BeepAudition } from '../sim/beep';
import { t } from '../i18n/i18n';
import { openDialog } from './dialogs';
import { h, icon } from './dom';

const RECORD_ICON = 'M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Z';
const STOP_ICON = 'M5 5h14v14H5Z';
const PLAY_ICON = 'M7 4l14 8-14 8Z';
const CLEAR_ICON = 'M3 15l10-10 8 8-7 7H8Z M10 8l8 8 M14 20h8';
const actionIcon = (path: string, solid = false) => {
  const svg = icon(path); svg.classList.add('recorder-action-icon');
  const shape = svg.querySelector('path')!;
  shape.setAttribute('stroke-linecap', 'butt'); shape.setAttribute('stroke-linejoin', 'miter');
  if (solid) { shape.setAttribute('fill', 'currentColor'); shape.setAttribute('stroke', 'none'); }
  return svg;
};
export { pianoIcon as keyboardIcon } from './piano-icon';

export function openMelodyRecorder(notes: string, bpm: number, apply: (notes: string, tempo: number) => void) {
  const audition = new BeepAudition(), click = new BeepAudition();
  const listeners = new AbortController();
  const held = new Map<string, number>();
  let octave = 4, current = 0, recording: MelodyRecording | null = null;
  let countTimer: ReturnType<typeof setInterval> | undefined, beat = 0, counting = false;
  const dialog = openDialog(t('music.keyboard'), { wide: true, onClose: () => {
    stop(); audition.dispose(); click.dispose(); listeners.abort();
  } });
  dialog.el.classList.add('melody-recorder');
  const text = h('textarea', { rows: 3, 'aria-label': t('music.notes') }); text.value = notes;
  const errors = h('p', { class: 'melody-errors', role: 'status', 'aria-live': 'polite' });
  const tempo = h('input', { type: 'number', min: 20, max: 600, value: bpm, 'aria-label': t('music.tempo') });
  const metronome = h('input', { type: 'checkbox' });
  const status = h('p', { role: 'status', 'aria-live': 'polite' });
  const keyboard = h('div', { class: 'melody-keyboard', role: 'group', 'aria-label': t('music.keyboard') });
  const octaveLabel = h('output');
  const playing = h('output', { class: 'melody-playing' });
  const playbackNotes = h('div', { class: 'melody-playback-notes', 'aria-label': t('music.notes') });
  const keys = 'awsedftgyhujk';
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const readTempo = () => Math.max(20, Math.min(600, Math.round(Number(tempo.value)) || 120));
  let tokens: MelodyToken[] = [], noteButtons: HTMLButtonElement[] = [];
  const refreshNotes = () => {
    tokens = []; const parsed = parseMelody(text.value, token => tokens.push(token));
    noteButtons = tokens.map((token, index) => h('button', { type: 'button', onclick: () => {
      stop(); text.focus(); text.setSelectionRange(token.start, token.end);
      void audition.play([token.frequency, parsed.steps[index * 2 + 1]], readTempo(), (step, freq) => showStep(step === null ? null : index, freq));
    } }, token.text));
    playbackNotes.replaceChildren(...noteButtons);
  };
  const validate = () => {
    const parsed = parseMelody(text.value); errors.textContent = parsed.bad.length ? t('diag.badNote', { notes: parsed.bad.join(' ') }) : '';
    text.setAttribute('aria-invalid', String(parsed.bad.length > 0)); use.disabled = parsed.bad.length > 0;
    refreshNotes();
  };
  const highlightKeys = (freq: number) => {
    keyboard.querySelectorAll<HTMLElement>('button').forEach(b => { const active = Number(b.dataset.freq) === freq; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    if (freq) keyboard.querySelector('.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  const transition = (freq: number) => {
    if (current === freq) return;
    current = freq;
    recording?.change(freq, performance.now());
    audition.tone(freq);
    highlightKeys(freq);
    if (recording) { text.value = formatMelody(recording.steps); validate(); }
  };
  const press = (id: string, freq: number) => { if (counting || held.has(id)) return; audition.stop(); held.set(id,freq); transition(freq); audition.tone(current); };
  const release = (id: string) => { if (!held.delete(id)) return; transition([...held.values()].at(-1) ?? 0); };
  const releaseAll = () => { held.clear(); transition(0); audition.stop(); click.stop(); highlightKeys(0); };
  function stop() {
    releaseAll();
    if (recording) { text.value = formatMelody(recording.steps); recording = null; validate(); }
    clearInterval(countTimer); counting = false; status.textContent = ''; tempo.disabled = false;
    record.disabled = false; metronome.disabled = false; text.disabled = false;
  }
  const renderKeys = () => {
    keyboard.replaceChildren(); octaveLabel.textContent = t('music.octave', { n: octave });
    let white = 0;
    for (let i = 0; i <= 24; i++) {
      const name = names[i % 12], o = octave + Math.floor(i / 12), freq = noteFreq(name[0], o, name[1]);
      const black = name.includes('#');
      const key = h('button', { type: 'button', class: `piano-key ${black ? 'black' : 'white'}`, 'aria-label': `${name}${o}`, 'aria-pressed': 'false' }, h('span', {}, `${name}${o}`), h('small', {}, i < keys.length ? keys[i].toUpperCase() : ''));
      key.dataset.freq = String(freq);
      key.style.left = `${black ? white * 56 - 22 : white * 56}px`;
      if (!black) white++;
      key.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); key.focus(); key.setPointerCapture(e.pointerId); press(`pointer:${e.pointerId}`,freq); });
      for (const event of ['pointerup','pointercancel','lostpointercapture']) key.addEventListener(event, e => release(`pointer:${(e as PointerEvent).pointerId}`));
      key.addEventListener('keydown', e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); if (!e.repeat) press(`button:${i}`,freq); } });
      key.addEventListener('keyup', e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); release(`button:${i}`); } });
      key.addEventListener('blur', () => release(`button:${i}`));
      keyboard.append(key);
    }
  };
  const shift = (delta: number) => { stop(); octave = Math.max(0, Math.min(8, octave + delta)); renderKeys(); };
  const showStep = (index: number | null, freq: number) => {
    if (index === null) { highlightKeys(0); playing.textContent = ''; noteButtons.forEach(button => { button.classList.remove('active'); button.removeAttribute('aria-current'); }); return; }
    if (freq && ![...keyboard.querySelectorAll<HTMLElement>('button')].some(b => Number(b.dataset.freq) === freq)) {
      octave = Math.max(0, Math.min(8, Math.floor(Math.round(69 + 12 * Math.log2(freq / 440)) / 12) - 1));
      renderKeys();
    }
    highlightKeys(freq);
    noteButtons.forEach((button, i) => { button.classList.toggle('active', i === index); if (i === index) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); });
    noteButtons[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const token = tokens[index];
    text.setSelectionRange(token.start, token.end);
    const note = keyboard.querySelector('.active')?.getAttribute('aria-label') ?? token.text;
    playing.textContent = t('music.playing', { note });
  };
  const play = () => {
    stop(); validate();
    const parsed = parseMelody(text.value);
    if (parsed.bad.length || !tokens.length) return;
    void audition.play(parsed.steps, readTempo(), showStep);
  };
  const record = h('button', { class: 'primary', onclick: () => {
    stop(); text.value = ''; validate(); tempo.value = String(readTempo());
    tempo.disabled = true; record.disabled = true; metronome.disabled = true; text.disabled = true;
    const begin = () => { counting = false; recording = new MelodyRecording(readTempo(), performance.now()); status.textContent = t('music.recording'); };
    if (!metronome.checked) { begin(); return; }
    counting = true; beat = 0;
    const tick = () => {
      if (counting && beat === 4) begin();
      click.tone(beat % 4 === 0 ? 1200 : 800, 40);
      if (counting) status.textContent = t('music.countIn', { n: 4-beat });
      beat++;
    };
    tick(); countTimer = setInterval(tick, 60000 / readTempo());
  } }, actionIcon(RECORD_ICON, true), t('music.record'));
  const use = h('button', { class: 'primary', onclick: () => { stop(); if (parseMelody(text.value).bad.length) return; apply(text.value, readTempo()); dialog.close(); } }, t('music.use'));
  const action = (label: string, fn: () => void, glyph?: string, solid = false) => h('button', { onclick: fn }, glyph ? actionIcon(glyph, solid) : null, t(label));
  dialog.body.append(h('p', { class: 'muted' }, t('music.recordHelp')),
    h('div', { class: 'row' }, h('label', { class: 'inline' }, t('music.tempo'), tempo), h('label', { class: 'inline' }, metronome, t('music.metronome')),
      action('music.octaveDown', () => shift(-1)), octaveLabel, action('music.octaveUp', () => shift(1))),
    h('div', { class: 'piano-scroll' }, keyboard),
    h('div', { class: 'row melody-transport' }, record, action('sim.stop', stop, STOP_ICON, true), action('music.play', play, PLAY_ICON, true),
      action('music.clear', () => { stop(); text.value = ''; validate(); }, CLEAR_ICON)), status, playing, playbackNotes,
    h('label', {}, t('music.notes'), text), errors);
  dialog.footer.append(action('ui.cancel', () => dialog.close()), use);
  text.addEventListener('input', () => { stop(); validate(); });
  const inputTarget = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable="true"]');
  window.addEventListener('keydown', e => {
    if (!dialog.el.open || inputTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase(), i = keys.indexOf(k);
    if (i >= 0) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { const name = names[i%12]; press(`key:${k}`, noteFreq(name[0],octave+Math.floor(i/12),name[1])); } }
    else if (k === 'z' || k === 'x') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) shift(k === 'z' ? -1 : 1); }
  }, { signal: listeners.signal, capture: true });
  window.addEventListener('keyup', e => { if (keys.includes(e.key.toLowerCase())) { release(`key:${e.key.toLowerCase()}`); if (!inputTarget(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } } }, { signal: listeners.signal, capture: true });
  window.addEventListener('blur', stop, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal: listeners.signal });
  renderKeys(); validate();
}
