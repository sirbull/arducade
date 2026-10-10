// 16 bit integer division with the same results as the device:
// rounds toward zero, and division by zero gives 0.

export function div16(a: number, b: number): number {
  if (b === 0) return 0;
  return (Math.trunc(a / b) << 16) >> 16;
}

export function mod16(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a % b) << 16) >> 16;
}

/** sin(0 to 90 degrees) * 127, the same table as the device. */
export const SIN_TABLE = Array.from({ length: 91 }, (_, d) => Math.round(Math.sin((d * Math.PI) / 180) * 127));

/** sin(deg) * 127 for any whole number of degrees. */
export function isin(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  const neg = d >= 180;
  if (neg) d -= 180;
  if (d > 90) d = 180 - d;
  return neg ? -SIN_TABLE[d] : SIN_TABLE[d];
}
