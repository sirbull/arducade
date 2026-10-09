import * as Blockly from 'blockly/core';

// A screen preview under X/Y number fields: click a point or drag the sliders
// to set both coordinates. The usual text editor stays open for typing.
// ponytail: the screen is a fixed 128x64 everywhere in the engine.
const W = 128;
const H = 64;
const AXIS = /^([XY])(\d?)$/;

type Fields = { X?: Blockly.FieldNumber; Y?: Blockly.FieldNumber };
type Editable = { setEditorValue_(v: unknown): void; htmlInput_: HTMLInputElement | null; isBeingEdited_: boolean };

/** The X and Y number fields that belong together, or null for other numbers. */
function coordFields(field: Blockly.Field): Fields | null {
  const block = field.getSourceBlock();
  const parent = block?.getParent();
  // Camera positions are in world pixels, so the screen is the wrong range.
  if (block?.type !== 'math_number' || !parent?.type.startsWith('ab_') || parent.type === 'ab_set_camera') return null;
  const match = parent.getInputWithBlock(block)?.name.match(AXIS);
  if (!match) return null;
  const get = (axis: 'X' | 'Y') => {
    const b = parent.getInputTargetBlock(axis + match[2]);
    return b?.type === 'math_number' ? (b.getField('NUM') as Blockly.FieldNumber) : undefined;
  };
  return { X: get('X'), Y: get('Y') };
}

function setNumber(field: Blockly.FieldNumber | undefined, v: number) {
  if (!field) return;
  const f = field as unknown as Editable;
  // The edited field must go through its text box, or typing would undo it.
  if (f.isBeingEdited_) f.setEditorValue_(v);
  else field.setValue(v);
}

function showPicker(owner: Blockly.FieldNumber, fields: Fields) {
  const content = Blockly.DropDownDiv.getContentDiv();
  content.replaceChildren();
  const root = document.createElement('div');
  root.className = 'point-picker';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const slider = (axis: 'X' | 'Y', max: number) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.disabled = !fields[axis];
    const value = document.createElement('output');
    label.append(axis.toLowerCase(), input, value);
    root.append(label);
    return { input, value };
  };
  root.append(canvas);
  const sx = slider('X', W - 1);
  const sy = slider('Y', H - 1);
  content.append(root);

  const read = (f?: Blockly.FieldNumber) => Number(f?.getValue() ?? 0);
  const draw = (x = read(fields.X), y = read(fields.Y)) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#555';
    if (fields.X) ctx.fillRect(x, 0, 1, H);
    if (fields.Y) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    sx.input.value = sx.value.textContent = String(x);
    sy.input.value = sy.value.textContent = String(y);
  };
  const set = (x: number, y: number) => {
    setNumber(fields.X, x);
    setNumber(fields.Y, y);
    draw();
  };
  const at = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(v)));
    return [clamp(((e.clientX - r.left) / r.width) * W, W - 1), clamp(((e.clientY - r.top) / r.height) * H, H - 1)];
  };
  // Keep focus in the text editor so it stays open.
  root.onpointerdown = (e) => { if (e.target === canvas) e.preventDefault(); };
  canvas.onpointermove = (e) => draw(...at(e));
  canvas.onpointerleave = () => draw();
  canvas.onclick = (e) => set(...at(e));
  sx.input.oninput = () => set(Number(sx.input.value), read(fields.Y));
  sy.input.oninput = () => set(read(fields.X), Number(sy.input.value));
  (owner as unknown as Editable).htmlInput_?.addEventListener('input', () => draw());
  draw();
  Blockly.DropDownDiv.showPositionedByField(owner, undefined, undefined, false);
}

export function registerPointPicker() {
  const proto = Blockly.FieldNumber.prototype as unknown as {
    showEditor_(e?: Event, quiet?: boolean, focus?: boolean): void;
    widgetDispose_(): void;
  };
  const show = proto.showEditor_;
  proto.showEditor_ = function (this: Blockly.FieldNumber, ...args) {
    show.apply(this, args);
    const fields = coordFields(this);
    if (fields) showPicker(this, fields);
  };
  const dispose = proto.widgetDispose_;
  proto.widgetDispose_ = function (this: Blockly.FieldNumber) {
    dispose.call(this);
    Blockly.DropDownDiv.hideIfOwner(this, true);
  };
}
