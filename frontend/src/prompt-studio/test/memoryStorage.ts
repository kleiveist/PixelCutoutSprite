import type { KeyValueStorage } from "../services";

export class MemoryStorage implements KeyValueStorage {
  readonly mutations: Array<Readonly<{ operation: "set" | "remove"; key: string }>> = [];
  readonly values = new Map<string, string>();
  failGetFor: string | null = null;
  failSetFor: string | null = null;
  failSetOnAttempt: Readonly<{ key: string; attempt: number }> | null = null;
  private readonly setAttempts = new Map<string, number>();

  constructor(initialValues: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(initialValues)) this.values.set(key, value);
  }

  getItem(key: string): string | null {
    if (this.failGetFor === key || this.failGetFor === "*") {
      throw new Error(`getItem failed for ${key}`);
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const attempt = (this.setAttempts.get(key) ?? 0) + 1;
    this.setAttempts.set(key, attempt);
    if (
      this.failSetFor === key ||
      this.failSetFor === "*" ||
      (this.failSetOnAttempt?.key === key && this.failSetOnAttempt.attempt === attempt)
    ) {
      throw new Error(`setItem failed for ${key}`);
    }
    this.values.set(key, value);
    this.mutations.push({ operation: "set", key });
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.mutations.push({ operation: "remove", key });
  }
}
