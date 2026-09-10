export type NativeErrorKind =
  "conflict" | "recovery_required" | "migration_required" | "read_only" | "other";

export interface ClassifiedNativeError {
  kind: NativeErrorKind;
  message: string;
  code: string | null;
}

/**
 * Tauri commands currently reject with strings. Reading optional code/message fields as well keeps
 * the editors compatible with a future structured command-error DTO without weakening today's
 * classification.
 */
export function classifyNativeError(reason: unknown): ClassifiedNativeError {
  const record = isRecord(reason) ? reason : null;
  const code = stringField(record, "code") ?? stringField(record, "kind");
  const message =
    reason instanceof Error
      ? reason.message
      : (stringField(record, "message") ??
        (typeof reason === "string" ? reason : safelyStringify(reason)));
  const searchable = `${code ?? ""} ${message}`.toLowerCase();

  if (
    /write[_ -]?conflict|revision[_ -]?conflict|\bconflict\b|expected .* (?:found|got)|changed since|changed outside/.test(
      searchable,
    )
  ) {
    return { kind: "conflict", message, code };
  }
  if (
    /recovery(?:[_ -]?is)?[_ -]?required|needs? (?:explicit )?recovery|needs_recovery|interrupted .*?(?:operation|transaction)/.test(
      searchable,
    )
  ) {
    return { kind: "recovery_required", message, code };
  }
  if (/migration[_ -]?required|unsupported schema|schema .*too old/.test(searchable)) {
    return { kind: "migration_required", message, code };
  }
  if (/read[_ -]?only|active writer session/.test(searchable)) {
    return { kind: "read_only", message, code };
  }
  return { kind: "other", message, code };
}

/** Observes rejected promise-returning client calls without changing their payloads or errors. */
export function observeRejectedClientCalls<T extends object>(
  client: T,
  onRejected: (reason: unknown) => void,
): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          const result: unknown = Reflect.apply(value, target, args);
          if (!isPromiseLike(result)) return result;
          return result.catch((reason: unknown) => {
            onRejected(reason);
            throw reason;
          });
        } catch (reason) {
          onRejected(reason);
          throw reason;
        }
      };
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  if (!isRecord(value)) return false;
  return typeof value.then === "function" && typeof value.catch === "function";
}

function stringField(value: Record<string, unknown> | null, field: string): string | null {
  const candidate = value?.[field];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function safelyStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
