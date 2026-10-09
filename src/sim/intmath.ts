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
