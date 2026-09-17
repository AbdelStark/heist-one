import { distance, lineOfSight, pointInRect } from "./geometry";
import { MUSEUM_MAP } from "./map";
import type {
  AppliedDecisionSummary,
  AttentionOption,
  DecisionBatchInput,
  DecisionBatchResult,
  DecisionTelemetry,
  GameEvent,
  GuardDecisionContext,
  GuardIntent,
  GuardState,
  Observation,
  RawGuardDecision,
  SuspicionBand,
  Vec2,
  WorldState,
} from "./types";

export const ALL_GUARD_INTENTS: GuardIntent[] = [
  "continue_patrol",
  "hold_and_observe",
  "investigate",
  "challenge",
  "pursue",
  "protect_artifact",
  "report",
  "raise_alarm",
  "seek_help",
];

const zoneAt = (position: Vec2): string =>
  MUSEUM_MAP.zones.find((zone) => pointInRect(position, zone))?.id ?? "threshold";

const lightForZone = (world: WorldState, zoneId: string): boolean => {
  const zone = MUSEUM_MAP.zones.find((candidate) => candidate.id === zoneId);
  return world.lights.find((light) => light.id === zone?.lightId)?.on ?? true;
};

const playerAuthorizedForZone = (world: WorldState, zoneId: string): boolean => {
  const access = MUSEUM_MAP.zones.find((zone) => zone.id === zoneId)?.access ?? "public";
  if (access === "public") return true;
  if (access === "staff") return world.player.disguised || world.player.hasBadge;
  return world.player.hasBadge;
};

const playerObservation = (world: WorldState, guard: GuardState): Observation | null => {
  const playerZone = zoneAt(world.player.position);
  const lit = lightForZone(world, playerZone);
  const baseRange = lit ? 235 : 112;
  const stanceFactor =
    world.player.stance === "sprint" ? 1.25 : world.player.stance === "crouch" ? 0.72 : 1;
  const visibleRange = baseRange * stanceFactor;
  if (distance(guard.position, world.player.position) > visibleRange) return null;
  if (!lineOfSight(guard.position, world.player.position, world.doors)) return null;

  const authorized = playerAuthorizedForZone(world, playerZone);
  const details = [
    world.player.disguised ? "wearing a staff jacket" : "not disguised",
    world.player.hasBadge ? "carrying a security badge" : "no badge observed",
    `moving at ${world.player.stance} pace`,
    `in ${playerZone}`,
  ].join(", ");
  return {
    id: `player:${world.tick}`,
    kind: authorized ? "person" : "restricted_person",
    summary: authorized
      ? `A person is visible, ${details}. Their presence is currently authorized for this zone.`
      : `A person is visible in a zone they are not authorized to enter, ${details}.`,
    targetId: "player",
    position: { ...world.player.position },
    ageTicks: 0,
    reliability: 0.95,
  };
};

const observationsFor = (world: WorldState, guard: GuardState): Observation[] => {
  const observations: Observation[] = [];
  const player = playerObservation(world, guard);
  if (player) observations.push(player);

  for (const sound of world.sounds) {
    if (distance(guard.position, sound.position) > 310) continue;
    observations.push({
      id: sound.id,
      kind: "sound",
      summary: `An unexplained ${sound.kind === "noise_emitter" ? "electronic chirp" : "running sound"} came from a nearby location.`,
      targetId: sound.id,
      position: { ...sound.position },
      ageTicks: world.tick - sound.createdAtTick,
      reliability: sound.kind === "noise_emitter" ? 0.82 : 0.65,
    });
  }

  for (const door of world.doors) {
    if (door.deniedAtTick === null || door.deniedAt === null) continue;
    const age = world.tick - door.deniedAtTick;
    if (age > 180 || distance(guard.position, door.deniedAt) > 330) continue;
    observations.push({
      id: `denial:${door.id}:${door.deniedAtTick}`,
      kind: "door_denial",
      summary: `${door.label} rejected an authorization attempt ${age} ticks ago.`,
      targetId: door.id,
      position: { ...door.deniedAt },
      ageTicks: age,
      reliability: 0.9,
    });
  }

  const guardZone = zoneAt(guard.position);
  if (!lightForZone(world, guardZone)) {
    observations.push({
      id: `lights:${guardZone}`,
      kind: "lights_out",
      summary: `The lights are unexpectedly off in ${guardZone}.`,
      targetId: world.breaker.id,
      position: { ...world.breaker.position },
      ageTicks: 0,
      reliability: 1,
    });
  }

  const artifact = world.pickups.find((pickup) => pickup.id === "artifact");
  if (
    artifact &&
    !artifact.available &&
    (guard.role === "artifact_guard" || guardZone === "artifact")
  ) {
    observations.push({
      id: "artifact:missing",
      kind: "artifact_missing",
      summary: "The protected artifact is missing from its plinth.",
      targetId: "artifact",
      position: { ...artifact.position },
      ageTicks: 0,
      reliability: 1,
    });
  }

  if (world.alert === "alarm") {
    observations.push({
      id: "alert:alarm",
      kind: "global_alarm",
      summary: "The global security alarm is active.",
      targetId: "artifact",
      position: artifact ? { ...artifact.position } : null,
      ageTicks: 0,
      reliability: 1,
    });
  }

  return observations;
};

const attentionOptionsFor = (observations: Observation[]): AttentionOption[] => {
  const options = new Map<string, AttentionOption>();
  options.set("none", {
    id: "none",
    description: "No current observation needs focused attention.",
    position: null,
  });
  for (const observation of observations) {
    if (!observation.targetId) continue;
    options.set(observation.targetId, {
      id: observation.targetId,
      description: observation.summary,
      position: observation.position ? { ...observation.position } : null,
    });
  }
  return [...options.values()];
};

export const projectDecisionBatch = (world: WorldState, epochId: string): DecisionBatchInput => {
  const guards: GuardDecisionContext[] = world.guards.map((guard) => {
    guard.contextRevision += 1;
    const observations = observationsFor(world, guard);
    const artifact = world.pickups.find((pickup) => pickup.id === "artifact");
    const canObserveArtifact =
      guard.role === "artifact_guard" || zoneAt(guard.position) === "artifact";
    return {
      guard: {
        id: guard.id,
        label: guard.label,
        role: guard.role,
        profile: guard.profile,
        currentIntent: guard.intent,
        currentZoneId: zoneAt(guard.position),
      },
      revision: guard.contextRevision,
      objective: {
        artifactExpected: true,
        artifactObserved: canObserveArtifact
          ? artifact?.available
            ? "present"
            : "missing"
          : "unknown",
        globalAlert: world.alert,
        locallyKnownLockdown: world.alert === "alarm",
      },
      observations,
      legalIntents: [...ALL_GUARD_INTENTS],
      attentionOptions: attentionOptionsFor(observations),
    };
  });

  return {
    sessionId: world.sessionId,
    epochId,
    worldRevision: world.revision,
    tick: world.tick,
    alert: world.alert,
    guards,
  };
};

export const suspicionBandFor = (score: number): SuspicionBand => {
  if (score < 0.8) return "relaxed";
  if (score < 1.8) return "attentive";
  if (score < 2.8) return "suspicious";
  if (score < 3.6) return "high_alert";
  return "certain_threat";
};

const finiteProbability = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const validDistribution = (distribution: Record<string, number>): boolean => {
  const values = Object.values(distribution);
  if (values.length === 0 || values.some((value) => !finiteProbability(value))) return false;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum > 0.98 && sum < 1.02;
};

export const validateRawDecision = (
  decision: RawGuardDecision,
  context: GuardDecisionContext,
): string | null => {
  if (decision.guardId !== context.guard.id) return "guard_id_mismatch";
  if (decision.contextRevision !== context.revision) return "context_revision_mismatch";
  if (!finiteProbability(decision.threatProbability)) return "invalid_threat_probability";
  if (
    !Number.isFinite(decision.suspicion.score) ||
    decision.suspicion.score < 0 ||
    decision.suspicion.score > 4
  ) {
    return "invalid_suspicion_score";
  }
  if (
    !finiteProbability(decision.suspicion.confidence) ||
    !validDistribution(decision.suspicion.probabilities)
  ) {
    return "invalid_suspicion_distribution";
  }
  if (!context.legalIntents.includes(decision.intent.choice)) return "illegal_intent";
  if (
    !finiteProbability(decision.intent.confidence) ||
    !validDistribution(decision.intent.probabilities)
  ) {
    return "invalid_intent_distribution";
  }
  if (!context.attentionOptions.some((option) => option.id === decision.attention.choice))
    return "illegal_attention_target";
  if (
    !finiteProbability(decision.attention.confidence) ||
    !validDistribution(decision.attention.probabilities)
  ) {
    return "invalid_attention_distribution";
  }
  return null;
};

const fallbackDecision = (
  guard: GuardState,
  context: GuardDecisionContext,
  telemetry: DecisionTelemetry,
  epochId: string,
  reason: string,
): void => {
  guard.intent = guard.intent === "pursue" ? "hold_and_observe" : guard.intent;
  guard.targetId = null;
  guard.targetPosition = null;
  guard.decision = {
    epochId,
    source: "fallback",
    threatProbability: 0.5,
    suspicionScore: guard.suspicionBand === "relaxed" ? 0 : 1,
    suspicionBand: guard.suspicionBand,
    suspicionConfidence: 0,
    suspicionProbabilities: {},
    proposedIntent: guard.intent,
    appliedIntent: guard.intent,
    intentConfidence: 0,
    intentProbabilities: {},
    proposedTargetId: null,
    appliedTargetId: null,
    targetProbabilities: {},
    policyReasons: [reason],
    observations: context.observations,
    latencyMs: telemetry.latencyMs,
    decidedAtTick: 0,
  };
};

const choosePolicyIntent = (
  raw: RawGuardDecision,
  context: GuardDecisionContext,
): { intent: GuardIntent; targetId: string | null; reasons: string[] } => {
  let intent = raw.intent.choice;
  let targetId = raw.attention.choice === "none" ? null : raw.attention.choice;
  const reasons: string[] = [];
  const hasArtifactEvidence = context.observations.some(
    (observation) => observation.kind === "artifact_missing",
  );
  const playerObserved = context.observations.some(
    (observation) => observation.targetId === "player" && observation.kind !== "person",
  );

  if (raw.intent.confidence < 0.25 && ["pursue", "raise_alarm", "challenge"].includes(intent)) {
    intent = "hold_and_observe";
    targetId = null;
    reasons.push("low_confidence_escalation_blocked");
  }
  if (
    intent === "raise_alarm" &&
    !(hasArtifactEvidence || (raw.threatProbability >= 0.8 && raw.intent.confidence >= 0.55))
  ) {
    intent = "report";
    reasons.push("alarm_requires_corroboration");
  }
  if (
    intent === "pursue" &&
    (targetId !== "player" || !playerObserved || raw.threatProbability < 0.55)
  ) {
    intent = targetId === "player" ? "challenge" : "hold_and_observe";
    reasons.push("pursuit_requires_current_threat_evidence");
  }
  if (["challenge", "pursue"].includes(intent) && targetId !== "player") {
    intent = "hold_and_observe";
    targetId = null;
    reasons.push("actor_target_required");
  }
  if (intent === "investigate" && targetId === null) {
    intent = "hold_and_observe";
    reasons.push("investigation_target_required");
  }
  if (reasons.length === 0) reasons.push("provider_intent_accepted");
  return { intent, targetId, reasons };
};

export const applyDecisionResult = (
  world: WorldState,
  input: DecisionBatchInput,
  result: DecisionBatchResult,
): AppliedDecisionSummary[] => {
  const summaries: AppliedDecisionSummary[] = [];
  const contexts = new Map(input.guards.map((context) => [context.guard.id, context]));
  const telemetry = result.telemetry;

  if (!result.ok || result.worldRevision !== world.revision) {
    const reason = !result.ok
      ? (result.telemetry.error ?? "decision_engine_error")
      : "stale_world_revision";
    for (const guard of world.guards) {
      const context = contexts.get(guard.id);
      if (!context) continue;
      fallbackDecision(guard, context, telemetry, input.epochId, reason);
      summaries.push({ guardId: guard.id, accepted: false, reason });
    }
    return summaries;
  }

  const decisions = new Map(result.decisions.map((decision) => [decision.guardId, decision]));
  const events: GameEvent[] = [];
  let raisedAlarm = false;

  for (const guard of world.guards) {
    const context = contexts.get(guard.id);
    const raw = decisions.get(guard.id);
    if (!context || !raw) {
      if (context)
        fallbackDecision(guard, context, telemetry, input.epochId, "missing_guard_decision");
      summaries.push({ guardId: guard.id, accepted: false, reason: "missing_guard_decision" });
      continue;
    }
    const validationError = validateRawDecision(raw, context);
    if (validationError || guard.contextRevision !== context.revision) {
      const reason = validationError ?? "stale_guard_context";
      fallbackDecision(guard, context, telemetry, input.epochId, reason);
      summaries.push({ guardId: guard.id, accepted: false, reason });
      continue;
    }

    const resolved = choosePolicyIntent(raw, context);
    const previousIntent = guard.intent;
    const hadDecision = guard.decision !== null;
    const target = context.attentionOptions.find((option) => option.id === resolved.targetId);
    guard.intent = resolved.intent;
    guard.targetId = resolved.targetId;
    guard.targetPosition = target?.position ? { ...target.position } : null;
    guard.path = [];
    guard.pathIndex = 0;
    guard.suspicionBand = suspicionBandFor(raw.suspicion.score);
    guard.decision = {
      epochId: input.epochId,
      source: result.telemetry.source,
      threatProbability: raw.threatProbability,
      suspicionScore: raw.suspicion.score,
      suspicionBand: guard.suspicionBand,
      suspicionConfidence: raw.suspicion.confidence,
      suspicionProbabilities: raw.suspicion.probabilities,
      proposedIntent: raw.intent.choice,
      appliedIntent: resolved.intent,
      intentConfidence: raw.intent.confidence,
      intentProbabilities: raw.intent.probabilities,
      proposedTargetId: raw.attention.choice === "none" ? null : raw.attention.choice,
      appliedTargetId: resolved.targetId,
      targetProbabilities: raw.attention.probabilities,
      policyReasons: resolved.reasons,
      observations: context.observations,
      latencyMs: telemetry.latencyMs,
      decidedAtTick: world.tick,
    };
    if (resolved.intent === "raise_alarm") raisedAlarm = true;
    if (!hadDecision || previousIntent !== resolved.intent) {
      events.push({
        id: `decision:${input.epochId}:${guard.id}`,
        tick: world.tick,
        kind: "guard_decision",
        label: `${guard.label}: ${resolved.intent.replaceAll("_", " ")}`,
        position: { ...guard.position },
      });
    }
    summaries.push({ guardId: guard.id, accepted: true, reason: resolved.reasons.join(",") });
  }

  world.materialEvents.push(...events);
  world.materialEvents = world.materialEvents.slice(-40);
  world.revision += 1;
  if (raisedAlarm && world.alert !== "alarm") {
    world.alert = "alarm";
    world.lockdownTicksRemaining = 30 * 25;
    world.materialEvents.push({
      id: `alarm:${world.tick}`,
      tick: world.tick,
      kind: "alarm_changed",
      label: "GLOBAL LOCKDOWN INITIATED",
    });
  }
  return summaries;
};
