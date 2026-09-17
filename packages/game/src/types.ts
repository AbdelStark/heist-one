export type EntityId = string;
export type GuardProfile = "methodical" | "cautious" | "assertive";
export type GuardRole = "patrol" | "security_room" | "artifact_guard";
export type GuardIntent =
  | "continue_patrol"
  | "hold_and_observe"
  | "investigate"
  | "challenge"
  | "pursue"
  | "protect_artifact"
  | "report"
  | "raise_alarm"
  | "seek_help";
export type SuspicionBand =
  | "relaxed"
  | "attentive"
  | "suspicious"
  | "high_alert"
  | "certain_threat";
export type AlertLevel = "quiet" | "suspicious" | "alarm";
export type MissionStatus = "playing" | "won" | "captured" | "lockdown";
export type AccessClass = "public" | "staff" | "secured";
export type DecisionSource = "scripted" | "jev" | "fallback" | "replay";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect extends Vec2 {
  width: number;
  height: number;
}

export interface Zone extends Rect {
  id: string;
  label: string;
  access: AccessClass;
  lightId: string;
  color: number;
}

export interface Wall extends Rect {
  id: string;
}

export interface DoorState extends Rect {
  id: string;
  label: string;
  access: AccessClass;
  open: boolean;
  deniedAtTick: number | null;
  deniedAt: Vec2 | null;
}

export interface ExitState extends Rect {
  id: string;
  label: string;
}

export interface LightZoneState {
  id: string;
  label: string;
  on: boolean;
}

export interface PickupState {
  id: "disguise" | "badge" | "artifact";
  label: string;
  position: Vec2;
  available: boolean;
}

export interface BreakerState {
  id: string;
  position: Vec2;
  lightId: string;
}

export interface SoundStimulus {
  id: string;
  position: Vec2;
  createdAtTick: number;
  expiresAtTick: number;
  kind: "noise_emitter" | "sprint";
}

export interface PlayerState {
  id: "player";
  position: Vec2;
  facing: Vec2;
  radius: number;
  disguised: boolean;
  hasBadge: boolean;
  hasArtifact: boolean;
  noiseEmitters: number;
  stance: "walk" | "sprint" | "crouch";
  currentZoneId: string;
}

export interface DecisionDistribution {
  [option: string]: number;
}

export interface GuardDecisionView {
  epochId: string;
  source: DecisionSource;
  threatProbability: number;
  suspicionScore: number;
  suspicionBand: SuspicionBand;
  suspicionConfidence: number;
  suspicionProbabilities: DecisionDistribution;
  proposedIntent: GuardIntent;
  appliedIntent: GuardIntent;
  intentConfidence: number;
  intentProbabilities: DecisionDistribution;
  proposedTargetId: string | null;
  appliedTargetId: string | null;
  targetProbabilities: DecisionDistribution;
  policyReasons: string[];
  observations: Observation[];
  latencyMs: number;
  decidedAtTick: number;
}

export interface GuardState {
  id: EntityId;
  label: string;
  role: GuardRole;
  profile: GuardProfile;
  position: Vec2;
  facing: Vec2;
  radius: number;
  patrol: Vec2[];
  patrolIndex: number;
  intent: GuardIntent;
  targetId: string | null;
  targetPosition: Vec2 | null;
  path: Vec2[];
  pathIndex: number;
  speed: number;
  suspicionBand: SuspicionBand;
  contextRevision: number;
  decision: GuardDecisionView | null;
}

export interface WorldState {
  sessionId: string;
  tick: number;
  revision: number;
  seed: string;
  status: MissionStatus;
  outcomeReason: string | null;
  alert: AlertLevel;
  lockdownTicksRemaining: number | null;
  player: PlayerState;
  guards: GuardState[];
  doors: DoorState[];
  lights: LightZoneState[];
  pickups: PickupState[];
  breaker: BreakerState;
  sounds: SoundStimulus[];
  materialEvents: GameEvent[];
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
}

export type PlayerAction = "interact" | "throw_noise";

export interface GameEvent {
  id: string;
  tick: number;
  kind:
    | "door_opened"
    | "door_denied"
    | "pickup"
    | "lights_changed"
    | "sound_created"
    | "artifact_removed"
    | "alarm_changed"
    | "guard_decision"
    | "mission_outcome";
  label: string;
  position?: Vec2;
}

export interface Observation {
  id: string;
  kind:
    | "person"
    | "restricted_person"
    | "sound"
    | "door_denial"
    | "lights_out"
    | "artifact_missing"
    | "global_alarm";
  summary: string;
  targetId: string | null;
  position: Vec2 | null;
  ageTicks: number;
  reliability: number;
}

export interface AttentionOption {
  id: string;
  description: string;
  position: Vec2 | null;
}

export interface GuardDecisionContext {
  guard: {
    id: EntityId;
    label: string;
    role: GuardRole;
    profile: GuardProfile;
    currentIntent: GuardIntent;
    currentZoneId: string;
  };
  revision: number;
  objective: {
    artifactExpected: boolean;
    artifactObserved: "present" | "missing" | "unknown";
    globalAlert: AlertLevel;
    locallyKnownLockdown: boolean;
  };
  observations: Observation[];
  legalIntents: GuardIntent[];
  attentionOptions: AttentionOption[];
}

export interface DecisionBatchInput {
  sessionId: string;
  epochId: string;
  worldRevision: number;
  tick: number;
  alert: AlertLevel;
  guards: GuardDecisionContext[];
}

export interface RawGuardDecision {
  guardId: EntityId;
  contextRevision: number;
  threatProbability: number;
  suspicion: {
    score: number;
    confidence: number;
    probabilities: DecisionDistribution;
  };
  intent: {
    choice: GuardIntent;
    confidence: number;
    probabilities: DecisionDistribution;
  };
  attention: {
    choice: string;
    confidence: number;
    probabilities: DecisionDistribution;
  };
}

export interface DecisionTelemetry {
  source: DecisionSource;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  exactCostUsd: number | null;
  error: string | null;
}

export type DecisionBatchResult =
  | {
      ok: true;
      epochId: string;
      worldRevision: number;
      decisions: RawGuardDecision[];
      telemetry: DecisionTelemetry;
    }
  | {
      ok: false;
      epochId: string;
      worldRevision: number;
      telemetry: DecisionTelemetry;
    };

export interface DecisionEngine {
  decide(input: DecisionBatchInput, options: { signal: AbortSignal }): Promise<DecisionBatchResult>;
}

export interface AppliedDecisionSummary {
  guardId: string;
  accepted: boolean;
  reason: string;
}

export interface ClientSnapshot {
  sessionId: string;
  tick: number;
  revision: number;
  status: MissionStatus;
  outcomeReason: string | null;
  alert: AlertLevel;
  lockdownSeconds: number | null;
  player: PlayerState;
  guards: GuardState[];
  doors: DoorState[];
  lights: LightZoneState[];
  pickups: PickupState[];
  breaker: BreakerState;
  sounds: SoundStimulus[];
  events: GameEvent[];
  map: MuseumMap;
  metrics: SessionMetrics;
}

export interface SessionMetrics {
  mode: "scripted" | "jev";
  requestCount: number;
  questionCount: number;
  fallbackCount: number;
  staleCount: number;
  lastLatencyMs: number | null;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  inputTokens: number | null;
  exactCostUsd: number | null;
  costStatus: "exact" | "unknown";
  inFlight: boolean;
}

export interface MuseumMap {
  width: number;
  height: number;
  zones: Zone[];
  walls: Wall[];
  exits: ExitState[];
}

export type ClientMessage =
  | { type: "input"; sequence: number; input: InputState }
  | { type: "action"; sequence: number; action: PlayerAction }
  | { type: "restart"; sequence: number }
  | { type: "select_guard"; sequence: number; guardId: string | null };

export type ServerMessage =
  | { type: "ready"; mode: "scripted" | "jev"; tickRate: number }
  | { type: "snapshot"; snapshot: ClientSnapshot }
  | { type: "error"; code: string; message: string };
