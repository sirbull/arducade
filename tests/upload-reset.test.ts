import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAndRequestPort, touch1200 } from '../src/upload/avr109';
import type { SerialPortLike } from '../src/upload/serial';

function port(): SerialPortLike {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x8036 }),
    readable: null,
    writable: null,
  };
}

afterEach(() => vi.useRealTimers());

describe('32U4 reset and port selection', () => {
  it('opens the chooser in the click before reset completes and returns the new port', async () => {
    vi.useFakeTimers();
    const runtime = port();
    const boot = port();
    let resolveOpen!: () => void;
    vi.mocked(runtime.open).mockImplementation(() => new Promise<void>(resolve => { resolveOpen = resolve; }));
    const chooser = vi.fn().mockResolvedValue(boot);
    const result = resetAndRequestPort(runtime, chooser);
    expect(chooser).toHaveBeenCalledOnce();
    expect(runtime.close).not.toHaveBeenCalled();
    resolveOpen();
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toBe(boot);
    expect(runtime.open).toHaveBeenCalledWith({ baudRate: 1200 });
    expect(runtime.setSignals).toHaveBeenCalledWith({ dataTerminalReady: false });
    expect(runtime.close).toHaveBeenCalledOnce();
  });

  it('closes the runtime port when reset signaling fails', async () => {
    const runtime = port();
    const error = new Error('Signal failure');
    vi.mocked(runtime.setSignals).mockRejectedValue(error);
    await expect(touch1200(runtime)).rejects.toBe(error);
    expect(runtime.close).toHaveBeenCalledOnce();
  });

  it('propagates chooser cancellation while letting reset close the port', async () => {
    vi.useFakeTimers();
    const runtime = port();
    const error = new DOMException('No port selected', 'NotFoundError');
    const result = resetAndRequestPort(runtime, () => Promise.reject(error));
    await expect(result).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(50);
    expect(runtime.close).toHaveBeenCalledOnce();
  });
});
