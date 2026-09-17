import type {
  DecisionBatchInput,
  DecisionBatchResult,
  DecisionDistribution,
  DecisionEngine,
  GuardDecisionContext,
  GuardIntent,
  RawGuardDecision,
} from "@heist-one/game";
import {
  type ChoiceResponse,
  choice,
  type EntryType,
  type NoulResponse,
  noul,
  type Questions,
  type ScoreResponse,
  score,
  TypeSafeClient,
} from "@typesafe-ai/sdk";

const SUSPICION_CRITERIA = [
  "Relaxed: no anomaly; behavior and authorization fit the location.",
  "Attentive: weak anomaly worth noticing but not investigating alone.",
  "Suspicious: credible mismatch requiring observation or investigation.",
  "High alert: strong evidence requiring challenge, pursuit, or coordination.",
  "Certain threat: direct or corroborated evidence of intrusion or artifact theft.",
] as const;

const INTENT_DESCRIPTIONS: Record<GuardIntent, string> = {
  continue_patrol: "Continue the assigned route; no anomaly merits diversion.",
  hold_and_observe: "Stay in a valid observation position and gather evidence.",
  investigate: "Move to inspect the selected stimulus or location.",
  challenge: "Approach a visible person and request authorization.",
  pursue: "Follow a person supported as a current threat by available evidence.",
  protect_artifact: "Move to or hold the artifact room defensively.",
  report: "Share the local observation over the guard radio.",
  raise_alarm: "Request global alarm escalation.",
  seek_help: "Move toward or coordinate with another guard.",
};

const questionKey = (
  guardId: string,
  kind: "threat" | "suspicion" | "intent" | "attention",
): string => `${guardId}__${kind}`;

export const compileJevRequest = (
  input: DecisionBatchInput,
): { state: EntryType; questions: Questions } => {
  const state = {
    world: { tick: input.tick, alert: input.alert },
    guard_contexts: Object.fromEntries(input.guards.map((context) => [context.guard.id, context])),
  } as unknown as EntryType;
  const questions: Questions = {};
  for (const context of input.guards) {
    const path = `guard_contexts.${context.guard.id}`;
    questions[questionKey(context.guard.id, "threat")] = noul(
      `Using only \`${path}\` and \`world.alert\`, is there current evidence of an intruder or active security threat that this guard should respond to? Routine authorized activity is not a threat. Unexplained restricted access, credible tampering, pursuit-confirming evidence, or a missing protected artifact is a threat.`,
    );
    questions[questionKey(context.guard.id, "suspicion")] = score(
      `Using only \`${path}\` and \`world.alert\`, how suspicious should this guard be right now? Judge the immediate evidence, not a multi-step plan.`,
      SUSPICION_CRITERIA,
    );
    questions[questionKey(context.guard.id, "intent")] = choice(
      `Using only \`${path}\` and \`world.alert\`, which immediate tactical intent should this guard take? Select only one supplied legal intent.`,
      Object.fromEntries(
        context.legalIntents.map((intent) => [intent, INTENT_DESCRIPTIONS[intent]]),
      ),
    );
    questions[questionKey(context.guard.id, "attention")] = choice(
      `Using only \`${path}\` and \`world.alert\`, which supplied observation or entity should receive this guard's attention right now? Select none when no target merits attention.`,
      Object.fromEntries(context.attentionOptions.map((option) => [option.id, option.description])),
    );
  }
  return { state, questions };
};

const toDistribution = (value: Readonly<Record<string, number>>): DecisionDistribution => ({
  ...value,
});

const decodeGuardDecision = (
  context: GuardDecisionContext,
  answers: Readonly<Record<string, NoulResponse | ScoreResponse | ChoiceResponse>>,
): RawGuardDecision => {
  const threat = answers[questionKey(context.guard.id, "threat")];
  const suspicion = answers[questionKey(context.guard.id, "suspicion")];
  const intent = answers[questionKey(context.guard.id, "intent")];
  const attention = answers[questionKey(context.guard.id, "attention")];
  if (threat?.type !== "noul") throw new Error(`Missing Noul answer for ${context.guard.id}`);
  if (suspicion?.type !== "score") throw new Error(`Missing Score answer for ${context.guard.id}`);
  if (intent?.type !== "choice")
    throw new Error(`Missing intent Choice answer for ${context.guard.id}`);
  if (attention?.type !== "choice")
    throw new Error(`Missing attention Choice answer for ${context.guard.id}`);
  return {
    guardId: context.guard.id,
    contextRevision: context.revision,
    threatProbability: threat.noul,
    suspicion: {
      score: suspicion.score,
      confidence: suspicion.confidence,
      probabilities: toDistribution(suspicion.probabilities as Readonly<Record<string, number>>),
    },
    intent: {
      choice: intent.choice as GuardIntent,
      confidence: intent.confidence,
      probabilities: toDistribution(intent.probabilities as Readonly<Record<string, number>>),
    },
    attention: {
      choice: attention.choice,
      confidence: attention.confidence,
      probabilities: toDistribution(attention.probabilities as Readonly<Record<string, number>>),
    },
  };
};

export class JevDecisionEngine implements DecisionEngine {
  readonly #client: TypeSafeClient;
  readonly #timeoutMs: number;

  constructor(options: { apiKey: string; baseUrl?: string; timeoutMs: number }) {
    this.#timeoutMs = options.timeoutMs;
    this.#client = new TypeSafeClient({
      apiKey: options.apiKey,
      ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
      timeout: options.timeoutMs,
      retry: { maxRetries: 0 },
      logLevel: "warn",
    });
  }

  async decide(
    input: DecisionBatchInput,
    options: { signal: AbortSignal },
  ): Promise<DecisionBatchResult> {
    const startedAt = performance.now();
    try {
      const request = compileJevRequest(input);
      const response = await this.#client.systemOne(
        { state: request.state, questions: request.questions },
        { signal: options.signal, timeout: this.#timeoutMs, retry: { maxRetries: 0 } },
      );
      const answers = response.answers as Readonly<
        Record<string, NoulResponse | ScoreResponse | ChoiceResponse>
      >;
      return {
        ok: true,
        epochId: input.epochId,
        worldRevision: input.worldRevision,
        decisions: input.guards.map((context) => decodeGuardDecision(context, answers)),
        telemetry: {
          source: "jev",
          latencyMs: performance.now() - startedAt,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          exactCostUsd: null,
          error: null,
        },
      };
    } catch (error) {
      return {
        ok: false,
        epochId: input.epochId,
        worldRevision: input.worldRevision,
        telemetry: {
          source: "jev",
          latencyMs: performance.now() - startedAt,
          inputTokens: null,
          outputTokens: null,
          exactCostUsd: null,
          error: error instanceof Error ? error.message : "unknown_jev_error",
        },
      };
    }
  }
}
