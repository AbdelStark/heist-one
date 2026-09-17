import {
  applyDecisionResult,
  type ClientMessage,
  type DecisionBatchResult,
  type DecisionEngine,
  GameSimulation,
  type InputState,
  type PlayerAction,
  projectDecisionBatch,
  ScriptedDecisionEngine,
  type ServerMessage,
  type SessionMetrics,
  TICK_MS,
} from "@heist-one/game";
import { config } from "./config";
import { JevDecisionEngine } from "./jev";
import { TraceWriter } from "./trace";

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
};

const percentile = (values: number[], fraction: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? null;
};

export class SessionRuntime {
  #simulation: GameSimulation;
  readonly #mode: "scripted" | "jev";
  readonly #send: (message: ServerMessage) => void;
  readonly #engine: DecisionEngine;
  #trace: TraceWriter;
  #input: InputState = EMPTY_INPUT;
  #actions: PlayerAction[] = [];
  #timer: NodeJS.Timeout | null = null;
  #decisionController: AbortController | null = null;
  #epoch = 0;
  #closed = false;
  #lastSequence = -1;
  #requestCount = 0;
  #questionCount = 0;
  #fallbackCount = 0;
  #staleCount = 0;
  #inputTokens = 0;
  #latencies: number[] = [];
  #tracedEventIds = new Set<string>();

  constructor(options: {
    sessionId: string;
    mode: "scripted" | "jev";
    send: (message: ServerMessage) => void;
  }) {
    this.#mode = options.mode;
    this.#send = options.send;
    this.#simulation = new GameSimulation(options.sessionId);
    this.#engine =
      options.mode === "jev" && config.apiKey
        ? new JevDecisionEngine({
            apiKey: config.apiKey,
            ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
            timeoutMs: config.decisionTimeoutMs,
          })
        : new ScriptedDecisionEngine();
    this.#trace = new TraceWriter(
      config.traceDir,
      options.sessionId,
      options.mode,
      this.#simulation.state.seed,
    );
  }

  start(): void {
    this.#send({ type: "ready", mode: this.#mode, tickRate: Math.round(1000 / TICK_MS) });
    this.#sendSnapshot();
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
  }

  handle(message: ClientMessage): void {
    if (message.sequence <= this.#lastSequence) return;
    this.#lastSequence = message.sequence;
    if (message.type === "input") this.#input = message.input;
    if (message.type === "action") this.#actions.push(message.action);
    if (message.type === "restart") this.#restart();
    if (message.type === "input" || message.type === "action") {
      void this.#trace.write(
        this.#simulation.state.tick,
        message.type === "input" ? "player.input" : "player.action",
        message,
      );
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#decisionController?.abort(new Error("session_closed"));
    await this.#trace.close(this.#simulation.state.tick, {
      status: this.#simulation.state.status,
      checkpointHash: this.#simulation.checkpointHash(),
      metrics: this.#metrics(),
    });
  }

  #tick(): void {
    if (this.#closed) return;
    const actions = this.#actions.splice(0);
    const previousStatus = this.#simulation.state.status;
    this.#simulation.step(this.#input, actions);
    for (const event of this.#simulation.state.materialEvents) {
      if (this.#tracedEventIds.has(event.id)) continue;
      this.#tracedEventIds.add(event.id);
      void this.#trace.write(this.#simulation.state.tick, "world.material_event", event);
    }
    if (this.#simulation.state.tick % 3 === 0 || this.#simulation.state.status !== previousStatus) {
      this.#sendSnapshot();
    }
    if (this.#simulation.state.status === "playing" && this.#simulation.state.tick % 18 === 0) {
      void this.#requestDecision();
    }
  }

  async #requestDecision(): Promise<void> {
    if (this.#decisionController) return;
    if (this.#mode === "jev" && this.#requestCount >= config.liveCallLimit) {
      this.#fallbackCount += this.#simulation.state.guards.length;
      return;
    }
    const input = projectDecisionBatch(this.#simulation.state, `epoch_${++this.#epoch}`);
    this.#requestCount += 1;
    this.#questionCount += input.guards.length * 4;
    this.#decisionController = new AbortController();
    const timeout = setTimeout(
      () => this.#decisionController?.abort(new Error("decision_deadline_exceeded")),
      config.decisionTimeoutMs,
    );
    await this.#trace.write(input.tick, "decision.request", input);
    let result: DecisionBatchResult;
    try {
      result = await this.#engine.decide(input, { signal: this.#decisionController.signal });
    } finally {
      clearTimeout(timeout);
      this.#decisionController = null;
    }
    await this.#trace.write(
      this.#simulation.state.tick,
      result.ok ? "decision.response" : "decision.error",
      result,
    );
    this.#latencies.push(result.telemetry.latencyMs);
    if (result.telemetry.inputTokens !== null) this.#inputTokens += result.telemetry.inputTokens;
    const summaries = applyDecisionResult(this.#simulation.state, input, result);
    this.#fallbackCount += summaries.filter((summary) => !summary.accepted).length;
    this.#staleCount += summaries.filter((summary) => summary.reason.includes("stale")).length;
    await this.#trace.write(this.#simulation.state.tick, "decision.applied", {
      summaries,
      checkpointHash: this.#simulation.checkpointHash(),
    });
    this.#sendSnapshot();
  }

  #metrics(): SessionMetrics {
    return {
      mode: this.#mode,
      requestCount: this.#requestCount,
      questionCount: this.#questionCount,
      fallbackCount: this.#fallbackCount,
      staleCount: this.#staleCount,
      lastLatencyMs: this.#latencies.at(-1) ?? null,
      medianLatencyMs: percentile(this.#latencies, 0.5),
      p95LatencyMs: percentile(this.#latencies, 0.95),
      inputTokens: this.#inputTokens === 0 ? null : this.#inputTokens,
      exactCostUsd: null,
      costStatus: "unknown",
      inFlight: this.#decisionController !== null,
    };
  }

  #sendSnapshot(): void {
    this.#send({ type: "snapshot", snapshot: this.#simulation.snapshot(this.#metrics()) });
  }

  #restart(): void {
    this.#decisionController?.abort(new Error("session_restarted"));
    const sessionId = this.#simulation.state.sessionId;
    void this.#trace.close(this.#simulation.state.tick, {
      status: this.#simulation.state.status,
      reason: "restart",
      checkpointHash: this.#simulation.checkpointHash(),
    });
    this.#simulation = new GameSimulation(sessionId, `${Date.now()}`);
    this.#trace = new TraceWriter(
      config.traceDir,
      sessionId,
      this.#mode,
      this.#simulation.state.seed,
    );
    this.#input = EMPTY_INPUT;
    this.#actions = [];
    this.#epoch = 0;
    this.#requestCount = 0;
    this.#questionCount = 0;
    this.#fallbackCount = 0;
    this.#staleCount = 0;
    this.#inputTokens = 0;
    this.#latencies = [];
    this.#tracedEventIds = new Set();
    this.#sendSnapshot();
  }
}
