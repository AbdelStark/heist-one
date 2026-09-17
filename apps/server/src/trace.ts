import { execFileSync } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface TraceEnvelope {
  schemaVersion: 1;
  sessionId: string;
  sequence: number;
  tick: number;
  monotonicMs: number;
  type: string;
  payload: unknown;
}

const gitSha = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

export class TraceWriter {
  readonly #path: string;
  readonly #sessionId: string;
  #sequence = 0;
  #queue: Promise<void> = Promise.resolve();

  constructor(directory: string, sessionId: string, mode: string, seed: string) {
    this.#sessionId = sessionId;
    this.#path = join(directory, `${sessionId}.jsonl`);
    const header: TraceEnvelope = {
      schemaVersion: 1,
      sessionId: this.#sessionId,
      sequence: ++this.#sequence,
      tick: 0,
      monotonicMs: performance.now(),
      type: "session.header",
      payload: {
        gitSha: gitSha(),
        rulesetVersion: "0.1.0",
        mapVersion: "museum-v0.1",
        mode,
        seed,
      },
    };
    this.#queue = mkdir(directory, { recursive: true }).then(() =>
      appendFile(this.#path, `${JSON.stringify(header)}\n`, "utf8"),
    );
  }

  write(tick: number, type: string, payload: unknown): Promise<void> {
    const envelope: TraceEnvelope = {
      schemaVersion: 1,
      sessionId: this.#sessionId,
      sequence: ++this.#sequence,
      tick,
      monotonicMs: performance.now(),
      type,
      payload,
    };
    this.#queue = this.#queue.then(() =>
      appendFile(this.#path, `${JSON.stringify(envelope)}\n`, "utf8"),
    );
    return this.#queue;
  }

  async close(tick: number, payload: unknown): Promise<void> {
    await this.write(tick, "session.footer", payload);
    await this.#queue;
  }
}
