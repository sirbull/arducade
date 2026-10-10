import { parseProject, serializeProject, type Project } from './model';

const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const encoder = new TextEncoder();
function crc(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunks(bytes: Uint8Array): { type: string; start: number; end: number; data: Uint8Array }[] {
  if (!signature.every((b, i) => bytes[i] === b)) throw new Error('file.notCartridge');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let start = 8; start < bytes.length;) {
    if (start + 12 > bytes.length) throw new Error('file.notCartridge');
    const length = view.getUint32(start), end = start + length + 12;
    if (end > bytes.length || crc(bytes.subarray(start + 4, end - 4)) !== view.getUint32(end - 4)) throw new Error('file.notCartridge');
    const type = new TextDecoder().decode(bytes.subarray(start + 4, start + 8));
    out.push({ type, start, end, data: bytes.subarray(start + 8, end - 4) });
    if (type === 'IEND') return out;
    start = end;
  }
  throw new Error('file.notCartridge');
}
/** Private ancillary PNG chunk: image viewers ignore it, ArduCade restores it. */
export function embedProject(png: Uint8Array, project: Project): Uint8Array {
  const parts = chunks(png);
  const payload = encoder.encode(serializeProject(project));
  const chunk = new Uint8Array(payload.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set(encoder.encode('arDu'), 4);
  chunk.set(payload, 8);
  view.setUint32(chunk.length - 4, crc(chunk.subarray(4, chunk.length - 4)));
  const kept = parts.filter(p => p.type !== 'arDu');
  const result = new Uint8Array(8 + kept.reduce((n, p) => n + p.end - p.start, 0) + chunk.length);
  result.set(signature);
  let offset = 8;
  for (const part of kept) {
    if (part.type === 'IEND') { result.set(chunk, offset); offset += chunk.length; }
    result.set(png.subarray(part.start, part.end), offset);
    offset += part.end - part.start;
  }
  return result;
}
export function readCartridge(png: Uint8Array): Project {
  const project = chunks(png).find(p => p.type === 'arDu');
  if (!project) throw new Error('file.notCartridge');
  return parseProject(new TextDecoder().decode(project.data));
}

export async function drawCartridge(title: string, thumbnail: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 700;
  const ctx = canvas.getContext('2d')!;
  type Paint = string | CanvasGradient;
  const grad = (x0: number, y0: number, x1: number, y1: number, ...stops: string[]) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  };
  const rect = (x: number, y: number, w: number, h: number, color: Paint) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  // Rounded top and bottom-left, softened diagonal cut bottom-right.
  const shell = (x: number, y: number, w: number, h: number, r: number, ch: number, cv: number, color: Paint) => {
    const pts = [[x + w, y, r], [x + w, y + h - cv, 6], [x + w - ch, y + h, 6], [x, y + h, r], [x, y, r]];
    ctx.beginPath(); ctx.moveTo(x + w / 2, y);
    pts.forEach(([px, py, pr], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; ctx.arcTo(px, py, nx, ny, pr); });
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  // Fake 3D: drop shadow, light from the top-left, bevelled rim, recessed vents.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  shell(24, 16, 552, 664, 32, 80, 120, grad(24, 16, 576, 680, '#3a4150', '#252a35', '#181b22'));
  ctx.shadowColor = 'transparent';
  shell(36, 28, 528, 634, 20, 70, 106, grad(36, 28, 564, 662, '#6e7789', '#424957', '#2b303b'));
  shell(40, 32, 520, 626, 17, 67, 101, grad(40, 32, 40, 658, '#545c6c', '#454c5a', '#3a404c'));
  for (let y = 66; y < 530; y += 24) for (const x of [48, 524]) {
    rect(x, y, 28, 8, '#1c2029'); rect(x, y + 8, 28, 2, 'rgba(255, 255, 255, 0.12)');
  }
  rect(92, 60, 424, 496, 'rgba(0, 0, 0, 0.3)');
  rect(88, 56, 424, 496, grad(88, 56, 88, 552, '#f8f3e6', '#ece4cf'));
  rect(88, 56, 424, 104, '#f5f5ef');
  rect(88, 158, 424, 2, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = '#252a35'; ctx.textAlign = 'center';
  try {
    const logo = new Image(); logo.src = 'logo.svg'; await logo.decode();
    ctx.drawImage(logo, 300 - 160, 64, 320, 88); // viewBox 2199×607
  } catch {
    ctx.font = 'bold 24px sans-serif'; ctx.fillText('ArduCade', 300, 117);
  }
  rect(104, 176, 392, 208, '#171b22');
  if (thumbnail) {
    const image = new Image(); image.src = thumbnail; await image.decode();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 108, 184, 384, 192);
  }
  ctx.fillStyle = '#252a35';
  // Largest size where the title fits on one line, or on two lines split at a space.
  const words = title.trim().split(/\s+/);
  const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')]);
  const widest = (rows: string[]) => Math.max(...rows.map(row => ctx.measureText(row).width));
  let size = 44, rows = [title];
  for (; size > 14; size--) {
    ctx.font = `bold ${size}px sans-serif`;
    if (widest([title]) <= 372) break;
    const best = splits.filter(r => widest(r) <= 372).sort((a, b) => widest(a) - widest(b))[0];
    if (best) { rows = best; break; }
  }
  ctx.font = `bold ${size}px sans-serif`;
  const lineHeight = size * 1.15, top = 452 - (rows.length - 1) * lineHeight / 2 + size * 0.35;
  rows.forEach((row, i) => ctx.fillText(row, 300, top + i * lineHeight, 372));
  ctx.font = '18px sans-serif'; ctx.fillText('MAKE. PLAY. REPEAT.', 300, 530);
  rect(170, 574, 260, 88, grad(170, 574, 170, 662, '#14171d', '#262b36'));
  for (let x = 188; x < 414; x += 20) rect(x, 602, 10, 60, grad(x, 0, x + 10, 0, '#f0d58e', '#d8b56a', '#9c7e3e'));
  return canvas;
}
export async function cartridgeBlob(canvas: HTMLCanvasElement, project: Project): Promise<Blob> {
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('project.saveError')), 'image/png'));
  return new Blob([embedProject(new Uint8Array(await png.arrayBuffer()), project) as BlobPart], { type: 'image/png' });
}
