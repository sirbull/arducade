// Adapted from Tabler Icons' piano (MIT, see licenses/tabler-icons.txt).
// Three white keys, two filled black keys, and square corners throughout.
const body = '<path d="M3 5h18v14H3z" fill="#fff" stroke="#202720" stroke-width="1.5" stroke-linejoin="miter"/><path d="M9 13v6M15 13v6" fill="none" stroke="#202720" stroke-width="1.5"/><path d="M7.5 5h3v8h-3zM13.5 5h3v8h-3z" fill="#202720"/>';
export const PIANO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
export function pianoIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('width','24'); svg.setAttribute('height','24');
  svg.setAttribute('class','piano-icon'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
  svg.innerHTML = body;
  return svg;
}
