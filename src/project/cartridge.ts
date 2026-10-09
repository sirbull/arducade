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
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  rect(24, 16, 552, 664, '#252a35');
  rect(36, 28, 528, 634, '#424957');
  for (let y = 66; y < 530; y += 24) { rect(48, y, 28, 8, '#252a35'); rect(524, y, 28, 8, '#252a35'); }
  rect(88, 56, 424, 496, '#f3eddc');
  rect(88, 56, 424, 64, '#f2be46');
  ctx.fillStyle = '#252a35'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ArduCade', 300, 97);
  rect(104, 136, 392, 208, '#171b22');
  if (thumbnail) {
    const image = new Image(); image.src = thumbnail; await image.decode();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 108, 144, 384, 192);
  }
  ctx.fillStyle = '#252a35';
  let size = 32;
  do { ctx.font = `bold ${size--}px sans-serif`; } while (ctx.measureText(title).width > 372 && size > 13);
  ctx.fillText(title, 300, 406, 372);
  ctx.font = '14px sans-serif'; ctx.fillText('MAKE. PLAY. REPEAT.', 300, 504);
  rect(170, 574, 260, 88, '#252a35');
  for (let x = 188; x < 414; x += 20) rect(x, 602, 10, 60, '#d8b56a');
  return canvas;
}
export async function cartridgeBlob(canvas: HTMLCanvasElement, project: Project): Promise<Blob> {
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('project.saveError')), 'image/png'));
  return new Blob([embedProject(new Uint8Array(await png.arrayBuffer()), project) as BlobPart], { type: 'image/png' });
}
