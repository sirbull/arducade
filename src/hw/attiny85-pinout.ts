// Physical DIP-8 pins, viewed from above with the pin-1 mark at the top left.
// Port names are also Arduino pin names in ArduCade's minimal ATtiny core.
export const ATTINY85_DIP: Record<string, number> = {
  PB5: 1, PB3: 2, PB4: 3, GND: 4, PB0: 5, PB1: 6, PB2: 7, VCC: 8,
};
export function tinyDipPin(port: string): number {
  const pin = ATTINY85_DIP[port];
  if (!pin) throw new Error(`Unknown ATtiny85 DIP pin: ${port}`);
  return pin;
}
