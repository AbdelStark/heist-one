import type {
  DecisionBatchInput,
  DecisionBatchResult,
  DecisionDistribution,
  DecisionEngine,
  GuardDecisionContext,
  GuardIntent,
  Observation,
  RawGuardDecision,
} from "./types";

const normalizeDistribution = (distribution: DecisionDistribution): DecisionDistribution => {
  const sum = Object.values(distribution).reduce((total, value) => total + value, 0);
  return Object.fromEntries(Object.entries(distribution).map(([key, value]) => [key, value / sum]));
};

const peakedScoreDistribution = (score: number): DecisionDistribution => {
  const raw: DecisionDistribution = {};
  for (let index = 0; index <= 4; index += 1) {
    raw[String(index)] = Math.exp(-Math.abs(index - score) * 1.45) + 0.01;
  }
  return normalizeDistribution(raw);
};

const confidence = (distribution: DecisionDistribution): number => {
  const values = Object.values(distribution).sort((a, b) => b - a);
  return Math.max(0, Math.min(1, (values[0] ?? 0) - (values[1] ?? 0)));
};

const primaryObservation = (observations: Observation[]): Observation | null =>
  [...observations].sort((left, right) => {
    const threatOrder: Record<Observation["kind"], number> = {
      artifact_missing: 7,
      restricted_person: 6,
      global_alarm: 5,
      door_denial: 4,
      person: 3,
      lights_out: 2,
      sound: 1,
    };
    return threatOrder[right.kind] - threatOrder[left.kind] || right.reliability - left.reliability;
  })[0] ?? null;

const decisionFor = (context: GuardDecisionContext): RawGuardDecision => {
  const primary = primaryObservation(context.observations);
  const restricted = context.observations.find(
    (observation) => observation.kind === "restricted_person",
  );
  const artifactMissing = context.observations.find(
    (observation) => observation.kind === "artifact_missing",
  );
  const alarm = context.observations.find((observation) => observation.kind === "global_alarm");
  const doorDenial = context.observations.find((observation) => observation.kind === "door_denial");
  const sound = context.observations.find((observation) => observation.kind === "sound");
  const lightsOut = context.observations.find((observation) => observation.kind === "lights_out");
  const person = context.observations.find((observation) => observation.kind === "person");

  let threat = 0.04;
  let suspicion = 0.2;
  let selectedIntent: GuardIntent = "continue_patrol";
  let targetId = "none";

  if (alarm) {
    threat = 0.96;
    suspicion = 4;
    selectedIntent = restricted
      ? "pursue"
      : context.guard.role === "artifact_guard"
        ? "protect_artifact"
        : "seek_help";
    targetId = restricted?.targetId ?? artifactMissing?.targetId ?? "none";
  } else if (artifactMissing) {
    threat = 0.94;
    suspicion = 3.9;
    selectedIntent = context.guard.profile === "assertive" ? "raise_alarm" : "protect_artifact";
    targetId = artifactMissing.targetId ?? "artifact";
  } else if (restricted) {
    threat = context.guard.profile === "assertive" ? 0.86 : 0.72;
    suspicion = context.guard.profile === "cautious" ? 2.8 : 3.35;
    selectedIntent = context.guard.profile === "assertive" ? "pursue" : "challenge";
    targetId = restricted.targetId ?? "player";
  } else if (doorDenial) {
    threat = 0.63;
    suspicion = 2.55;
    selectedIntent = context.guard.profile === "cautious" ? "report" : "investigate";
    targetId = doorDenial.targetId ?? "none";
  } else if (person) {
    const sprinting = person.summary.includes("sprint");
    threat = sprinting ? 0.45 : 0.12;
    suspicion = sprinting ? 1.9 : 0.65;
    selectedIntent = sprinting ? "challenge" : "hold_and_observe";
    targetId = "player";
  } else if (lightsOut) {
    threat = 0.46;
    suspicion = 2.05;
    selectedIntent = context.guard.profile === "cautious" ? "report" : "investigate";
    targetId = lightsOut.targetId ?? "none";
  } else if (sound) {
    threat = context.guard.profile === "cautious" ? 0.38 : 0.5;
    suspicion = 1.75;
    selectedIntent = context.guard.profile === "cautious" ? "hold_and_observe" : "investigate";
    targetId = sound.targetId ?? "none";
  }

  if (!context.legalIntents.includes(selectedIntent)) selectedIntent = "hold_and_observe";
  if (!context.attentionOptions.some((option) => option.id === targetId))
    targetId = primary?.targetId ?? "none";
  if (!context.attentionOptions.some((option) => option.id === targetId)) targetId = "none";

  const intentRaw: DecisionDistribution = Object.fromEntries(
    context.legalIntents.map((intent) => [intent, 0.012]),
  );
  intentRaw[selectedIntent] = 0.78;
  if (selectedIntent === "pursue") intentRaw.challenge = 0.12;
  if (selectedIntent === "investigate") intentRaw.hold_and_observe = 0.1;
  if (selectedIntent === "raise_alarm") intentRaw.report = 0.11;
  const intentProbabilities = normalizeDistribution(intentRaw);

  const attentionRaw: DecisionDistribution = Object.fromEntries(
    context.attentionOptions.map((option) => [option.id, option.id === targetId ? 0.82 : 0.04]),
  );
  const attentionProbabilities = normalizeDistribution(attentionRaw);
  const suspicionProbabilities = peakedScoreDistribution(suspicion);

  return {
    guardId: context.guard.id,
    contextRevision: context.revision,
    threatProbability: threat,
    suspicion: {
      score: suspicion,
      confidence: confidence(suspicionProbabilities),
      probabilities: suspicionProbabilities,
    },
    intent: {
      choice: selectedIntent,
      confidence: confidence(intentProbabilities),
      probabilities: intentProbabilities,
    },
    attention: {
      choice: targetId,
      confidence: confidence(attentionProbabilities),
      probabilities: attentionProbabilities,
    },
  };
};

export class ScriptedDecisionEngine implements DecisionEngine {
  constructor(private readonly delayMs = 45) {}

  async decide(
    input: DecisionBatchInput,
    options: { signal: AbortSignal },
  ): Promise<DecisionBatchResult> {
    const startedAt = performance.now();
    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, this.delayMs);
        const abort = (): void => {
          clearTimeout(timeout);
          reject(options.signal.reason ?? new Error("aborted"));
        };
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort, { once: true });
      }).catch(() => undefined);
    }
    if (options.signal.aborted) {
      return {
        ok: false,
        epochId: input.epochId,
        worldRevision: input.worldRevision,
        telemetry: {
          source: "scripted",
          latencyMs: performance.now() - startedAt,
          inputTokens: null,
          outputTokens: null,
          exactCostUsd: null,
          error: "aborted",
        },
      };
    }
    return {
      ok: true,
      epochId: input.epochId,
      worldRevision: input.worldRevision,
      decisions: input.guards.map(decisionFor),
      telemetry: {
        source: "scripted",
        latencyMs: performance.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        exactCostUsd: null,
        error: null,
      },
    };
  }
}
