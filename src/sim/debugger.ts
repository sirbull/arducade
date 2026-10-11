/** Cooperative checkpoints pause generated code before a statement executes. */
export class Debugger {
  enabled = false;
  paused = false;
  mode: 'run' | 'block' | 'frame' = 'run';
  sequence = 0;
  location = '';
  locals: Record<string, unknown> = {};
  readonly breakpoints = new Set<string>();
  private pending?: { resolve(): void; reject(error: unknown): void };
  private requested = false;

  constructor(private changed: () => void) {}

  checkpoint = (id: string, locals: Record<string, unknown>): Promise<void> | undefined => {
    this.location = id;
    this.locals = locals;
    if (this.enabled && (this.requested || this.mode === 'block' || (id && this.breakpoints.has(id)))) {
      this.requested = false;
      return this.hold();
    }
  };

  private hold(): Promise<void> {
    const wait = new Promise<void>((resolve, reject) => { this.pending = { resolve, reject }; });
    this.sequence++;
    this.paused = true;
    this.changed();
    return wait;
  }

  pause() { this.requested = true; }

  resume(mode: 'run' | 'block' | 'frame' = 'run') {
    this.mode = mode;
    this.requested = false;
    this.paused = false;
    const pending = this.pending;
    this.pending = undefined;
    this.changed();
    pending?.resolve();
  }

  frameEnd() {
    if (this.enabled && (this.mode === 'frame' || this.requested)) {
      this.requested = false;
      this.sequence++;
      this.location = '';
      this.locals = {};
      this.paused = true;
      this.changed();
    }
  }

  reset(error: unknown) {
    const pending = this.pending;
    this.pending = undefined;
    this.paused = false;
    this.requested = false;
    this.mode = 'run';
    this.location = '';
    this.locals = {};
    pending?.reject(error);
  }
}
