export type StorageErrorCode =
  "read_only" | "write_conflict" | "stale_session" | "flush_failed" | "io_error" | "invalid_data";

export class RepositoryError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export interface SessionIdentity {
  readonly sessionId: string;
  readonly generation: number;
}

export interface SaveTaskContext {
  readonly session: SessionIdentity;
  assertCurrent(): void;
}

interface QueueEntry<Result> {
  readonly session: SessionIdentity;
  readonly operation: (context: SaveTaskContext) => Promise<Result>;
  readonly resolve: (value: Result) => void;
  readonly reject: (reason: unknown) => void;
}

function sameSession(left: SessionIdentity | null, right: SessionIdentity): boolean {
  return left?.sessionId === right.sessionId && left.generation === right.generation;
}

/** Serializes durable writes and rejects results belonging to a replaced vault session. */
export class SaveQueue {
  private readonly entries: QueueEntry<unknown>[] = [];
  private readonly beforeFlush = new Set<() => Promise<void>>();
  private running: Promise<void> | null = null;
  private lastFailure: unknown = null;

  constructor(private readonly currentSession: () => SessionIdentity | null) {}

  enqueue<Result>(
    session: SessionIdentity,
    operation: (context: SaveTaskContext) => Promise<Result>,
  ): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      this.entries.push({
        session,
        operation,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.start().catch(() => undefined);
    });
  }

  async flush(session?: SessionIdentity): Promise<void> {
    for (const prepare of [...this.beforeFlush]) await prepare();
    while (
      this.running !== null ||
      this.entries.some((entry) => !session || sameSession(entry.session, session))
    ) {
      await (this.running ?? this.start());
    }
    if (this.lastFailure !== null) {
      const failure = this.lastFailure;
      this.lastFailure = null;
      throw new RepositoryError("flush_failed", "At least one durable write failed.", failure);
    }
  }

  get pending(): number {
    return this.entries.length + (this.running ? 1 : 0);
  }

  /**
   * Registers debounce owners that must publish their pending work before the
   * queue can truthfully report a durable flush.
   */
  registerBeforeFlush(prepare: () => Promise<void>): () => void {
    this.beforeFlush.add(prepare);
    return () => this.beforeFlush.delete(prepare);
  }

  private start(): Promise<void> {
    if (this.running !== null) return this.running;
    const worker = this.drain();
    this.running = worker;
    void worker.finally(() => {
      if (this.running === worker) {
        this.running = null;
        if (this.entries.length > 0) void this.start().catch(() => undefined);
      }
    });
    return worker;
  }

  private async drain(): Promise<void> {
    while (this.entries.length > 0) {
      const entry = this.entries.shift()!;
      const assertCurrent = (): void => {
        if (!sameSession(this.currentSession(), entry.session)) {
          throw new RepositoryError(
            "stale_session",
            "The save belongs to a vault session that is no longer active.",
          );
        }
      };
      try {
        assertCurrent();
        const result = await entry.operation({ session: entry.session, assertCurrent });
        assertCurrent();
        entry.resolve(result);
      } catch (reason) {
        this.lastFailure = reason;
        entry.reject(reason);
      }
    }
  }
}
