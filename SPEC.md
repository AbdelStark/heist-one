# HEIST//ONE — Technical Specification

| Field | Value |
| --- | --- |
| Status | v0.1 implementation contract |
| Date | 17 September 2026 |
| Runtime | Browser client plus authoritative Node.js server |
| Language | TypeScript |
| Model integration | Official `@typesafe-ai/sdk`, server-side only |

## 1. Architectural drivers

The architecture exists to preserve four properties:

1. **Authority:** deterministic code is the only writer of world state.
2. **Responsiveness:** simulation and rendering never await a model request.
3. **Inspectability:** every transition from observation to provider answer to
   normalized decision to applied action is traceable.
4. **Replaceability:** live Jev, scripted behavior, and recorded decisions satisfy
   the same small interface.

The primary seam is `DecisionEngine`. It is intentionally narrow. Question
construction, SDK types, retries, normalization, and provider metadata stay inside
the Jev adapter; callers submit game-domain contexts and receive game-domain
decisions.

## 2. Runtime topology

```text
Browser
  input + renderer + Decision Lens
                 |
        session WebSocket
                 |
Authoritative Node server
  SessionRuntime
    |- deterministic Simulation
    |- PerceptionProjector
    |- DecisionScheduler
    |- DecisionPolicy
    |- TraceWriter
    `- DecisionEngine interface
         |- ScriptedDecisionEngine
         |- JevDecisionEngine -> TypeSafe API
         `- ReplayDecisionEngine
```

The browser sends input commands and renders snapshots. It does not simulate
authoritative state, construct provider questions, or possess provider credentials.
Client-side interpolation is visual only.

## 3. Repository layout

The intended pnpm workspace is:

```text
apps/
  web/                 Vite browser client, renderer, controls, Decision Lens
  server/              HTTP/WebSocket process and session lifecycle
packages/
  protocol/            versioned client/server messages and validation
  simulation/          deterministic world, systems, events, state hashes
  decision-domain/     DecisionEngine interface and game-domain contracts
  decision-jev/        TypeSafe SDK adapter and question compilation
  decision-scripted/   deterministic offline policy
  replay/              JSONL schema, writer, reader, replay adapter
  scenarios/           fixed maps, seeds, player scripts, expected invariants
tests/
  e2e/                 browser and server acceptance tests
docs/
  evidence/            generated private run reports; sanitized inputs only
```

This is a target, not permission to create shallow packages. A package is created
only when it owns a coherent module interface or must run in a different runtime.

## 4. Technology choices

- **Node.js:** version supported by the pinned official TypeSafe JavaScript SDK;
  minimum Node 20.
- **Package manager:** pnpm with a committed lockfile.
- **Client:** Vite, TypeScript, Phaser for the world canvas, and React for the
  surrounding HUD/Decision Lens.
- **Server:** Fastify with a WebSocket transport.
- **Validation:** Zod at network, environment, trace, and provider-normalization
  edges. Internal simulation code uses static TypeScript types and explicit
  assertions for invariants.
- **Tests:** Vitest for modules and integration; Playwright for end-to-end browser
  acceptance.
- **Formatting/linting:** Biome.

Versions are pinned during implementation after compatibility checks. The spec
does not freeze versions before the first clean install.

## 5. Authoritative simulation

### 5.1 Time and determinism

The server runs a fixed-step simulation. Wall-clock time is sampled only by the
session scheduler and telemetry; game systems consume integer ticks.

Deterministic inputs are:

- map and ruleset versions;
- initial seed;
- ordered player commands with target ticks;
- ordered normalized guard decisions with target revisions.

Provider timings and raw outputs are recorded but are not needed to reproduce an
offline replay once their normalized decisions have been recorded.

### 5.2 World identity

```ts
type EntityId = string;
type Tick = number;
type WorldRevision = number;
type GuardContextRevision = number;

interface WorldIdentity {
  sessionId: string;
  rulesetVersion: string;
  mapVersion: string;
  seed: string;
  tick: Tick;
  revision: WorldRevision;
}
```

IDs are opaque and stable for the session. Provider-facing labels may be more
descriptive, but normalization maps them back to known IDs.

### 5.3 Core state

The simulation owns:

- entity transforms and collision shapes;
- navigation mesh/grid and planned paths;
- door, light-zone, alarm, and artifact state;
- player stance, disguise, badge, inventory, and capture status;
- guard role, current executable intent, path, radio facts, and memory;
- visibility and hearing geometry;
- mission and lockdown timers;
- deterministic random source state.

No provider response is stored directly in authoritative world state. Only a
validated `ResolvedGuardDecision` may update a guard's executable intent.

### 5.4 Simulation interface

```ts
interface Simulation {
  readonly identity: WorldIdentity;
  step(commands: readonly PlayerCommand[]): SimulationStep;
  applyDecisions(batch: ResolvedDecisionBatch): ApplyDecisionResult;
  snapshotForClient(): ClientWorldSnapshot;
  checkpointHash(): string;
}
```

`step` and `applyDecisions` return events rather than performing network, file, or
provider I/O. The session runtime owns those side effects.

## 6. Perception and guard context

### 6.1 Principle

Jev receives a projection of simulation state, never the complete authoritative
world. `PerceptionProjector` computes what each guard can reasonably know.

### 6.2 Guard decision context

```ts
interface GuardDecisionContext {
  guard: {
    id: EntityId;
    role: "patrol" | "security_room" | "artifact_guard";
    profile: "methodical" | "cautious" | "assertive";
    currentIntent: GuardIntent;
    currentZoneId: string;
  };
  revision: GuardContextRevision;
  objective: {
    artifactExpected: boolean;
    artifactObserved: "present" | "missing" | "unknown";
    globalAlert: AlertLevel;
    locallyKnownLockdown: boolean;
  };
  observations: readonly Observation[];
  rememberedFacts: readonly RememberedFact[];
  radioFacts: readonly RadioFact[];
  legalIntents: readonly GuardIntent[];
  attentionOptions: readonly AttentionOption[];
}
```

Observations are concise structured records with type, subject/position, age in
ticks, reliability, and relevant properties. They include only facts derived from
guard-local vision, hearing, physical interaction, or received radio messages.

Memory is bounded by count and age. Eviction order is deterministic. Natural
language summaries, if used, are produced by code templates rather than a model.

### 6.3 Batched-state limitation

To demonstrate parallel questions, one request contains all due guard contexts
under distinct paths:

```json
{
  "world": {
    "tick": 1842,
    "alert": "quiet"
  },
  "guard_contexts": {
    "guard_01": { "revision": 12, "...": "..." },
    "guard_04": { "revision": 7, "...": "..." }
  }
}
```

Every question names exactly one path such as `guard_contexts.guard_01` and says
to use only that context plus the explicitly shared `world` fields. The model can
technically see the other contexts because questions in a batch share state.
Therefore v0.1 does **not** claim strict information isolation between guards.
Traces and reports disclose this limitation.

If testing shows material leakage, the supported remedy is separate per-guard
requests or grouping only guards allowed to share radio knowledge. That trade-off
is measured before changing the MVP contract.

## 7. Decision-domain contract

### 7.1 Interface

```ts
interface DecisionEngine {
  decide(
    input: DecisionBatchInput,
    options: { signal: AbortSignal },
  ): Promise<DecisionBatchResult>;
}

interface DecisionBatchInput {
  sessionId: string;
  epochId: string;
  worldRevision: WorldRevision;
  worldSummary: SharedDecisionState;
  guards: readonly GuardDecisionContext[];
}

type DecisionBatchResult =
  | { ok: true; batch: RawDecisionBatch; telemetry: DecisionTelemetry }
  | { ok: false; error: DecisionEngineError; telemetry: DecisionTelemetry };
```

The interface returns errors as data so the scheduler can account for every epoch.
It never throws for expected provider, timeout, validation, or cancellation
conditions. Programmer errors may still fail fast.

### 7.2 Adapters

- `JevDecisionEngine` compiles contexts into TypeSafe state/questions, calls the
  SDK, validates the response, and maps it into the domain result.
- `ScriptedDecisionEngine` makes deterministic rule-based judgments and produces
  synthetic but correctly shaped distributions marked `source: "scripted"`.
- `ReplayDecisionEngine` reads the next recorded normalized decision batch. It
  rejects a mismatched epoch or revision rather than guessing.

These are real adapters at one seam; no second provider-generalization layer is
introduced in v0.1.

## 8. Jev question contract

### 8.1 Question keys

Question IDs are program-facing only. The compiler uses stable keys:

```text
g:<guard-id>:threat
g:<guard-id>:suspicion
g:<guard-id>:intent
g:<guard-id>:attention
```

Instructions remain complete because IDs are not assumed to be visible to the
model.

### 8.2 Perceived threat — Noul

Instruction shape:

> Using only `<guard-path>` and the shared alert value in `world`, is there current
> evidence of an intruder or active security threat that this guard should respond
> to? Routine authorized activity is not a threat. Unexplained restricted access,
> credible tampering, pursuit-confirming evidence, or a missing protected artifact
> is a threat.

The returned Noul is preserved as `threatProbability` in `[0, 1]`.

### 8.3 Suspicion — Score

Ordered criteria:

1. **relaxed:** no anomaly; behavior and authorization fit the location.
2. **attentive:** weak anomaly worth noticing but not investigating alone.
3. **suspicious:** credible mismatch requiring observation or investigation.
4. **high_alert:** strong evidence requiring challenge, pursuit, or coordination.
5. **certain_threat:** direct or corroborated evidence of intrusion or artifact
   theft.

The raw score, legend, distribution, and confidence are preserved. Policy may map
the continuous score into display and escalation bands; it does not overwrite the
raw answer.

### 8.4 Tactical intent — Choice

The simulation supplies a subset of these legal options:

| Intent | Meaning |
| --- | --- |
| `continue_patrol` | Continue the assigned route; no anomaly merits diversion |
| `hold_and_observe` | Stay in a valid observation position and gather evidence |
| `investigate` | Move to inspect a selected stimulus or location |
| `challenge` | Approach a visible person and request authorization |
| `pursue` | Follow a person already supported as a threat by available evidence |
| `protect_artifact` | Move to or hold the artifact room defensively |
| `report` | Share the local observation over the guard radio |
| `raise_alarm` | Request global alarm escalation |
| `seek_help` | Move toward or coordinate with another guard |

Options that cannot legally execute from the current state are omitted. The
instruction asks for the best immediate tactical intent for the referenced guard,
not a multi-step plan.

### 8.5 Attention target — Choice

Criteria are created from `attentionOptions`, each of which has a stable option ID
and short code-owned description. Options may represent a visible actor, audible
stimulus, changed object, relevant location, or radio fact. `none` is present when
no target may be appropriate.

Attention is asked in parallel with intent. The policy may ignore it when the
resolved intent needs no target. If the selected target becomes invalid, the
decision is stale or resolves to a safe targetless action; it is never retargeted
silently.

### 8.6 Request bounds

Before a live call, `JevDecisionEngine` enforces configuration limits for:

- guards per batch;
- questions per batch;
- serialized state bytes;
- serialized question bytes;
- total wall-clock deadline;
- calls per session and per minute.

Exceeding a bound returns an accounted engine error and invokes fallback. The
adapter emits no partial untracked call.

## 9. Scheduling and concurrency

### 9.1 Epoch creation

`DecisionScheduler` receives material `WorldEvent`s. It marks affected guards due,
debounces events for a short configurable window, and snapshots all due contexts
into one immutable epoch.

Only one provider batch may be in flight per session. Additional events are
coalesced; they never mutate the in-flight input.

### 9.2 Freshness

Every guard input carries both the batch `worldRevision` and a per-guard
`contextRevision`. On completion:

1. the epoch must still be the session's current in-flight epoch;
2. the target guard must exist;
3. the guard context revision must still match, or the decision must pass an
   explicit non-material-change check;
4. selected intents and targets must still be legal.

The v0.1 default is conservative: a context revision mismatch rejects that
guard's decision and schedules a new epoch. Other fresh guards in the same batch
may still apply.

### 9.3 Deadline and cancellation

The session runtime provides an `AbortSignal` with a configurable deadline. On
deadline, session end, or server shutdown, it aborts the adapter. Whether the
underlying SDK/transport can cancel all network work is verified during
implementation; cancellation semantics are covered by an integration test.

There is no automatic same-epoch retry on the real-time path in v0.1. A retry that
arrives after the world changes is usually less useful than a fresh decision.

## 10. Normalization and policy

### 10.1 Normalization

`normalizeDecisionBatch` is a pure function. It verifies:

- answer presence and primitive shape;
- finite probabilities in valid ranges;
- known Choice option IDs;
- valid Score legend and score bounds;
- epoch, world, guard, and context identifiers;
- one answer per expected question with no ambiguous duplicate.

Invalid answers are preserved in the trace with redaction rules applied, but do
not reach policy.

### 10.2 Resolved decision

```ts
interface ResolvedGuardDecision {
  guardId: EntityId;
  epochId: string;
  source: "jev" | "scripted" | "replay" | "fallback";
  worldRevision: WorldRevision;
  contextRevision: GuardContextRevision;
  threatProbability: number;
  suspicion: {
    score: number;
    band: SuspicionBand;
    confidence: number;
  };
  proposedIntent: GuardIntent;
  proposedTargetId: string | null;
  appliedIntent: GuardIntent;
  appliedTargetId: string | null;
  policyReasons: readonly PolicyReason[];
}
```

### 10.3 Policy invariants

`DecisionPolicy` is deterministic configuration plus code. It enforces:

- an intent must be in the current legal set;
- challenge and pursuit require a current actor target;
- investigate requires an active stimulus, object, or location target;
- raise-alarm is subject to configured evidence/confidence rules;
- low-confidence escalation is replaced with hold, investigate, report, or the
  scripted safe action;
- capture occurs only through simulation proximity and pursuit rules, never from
  a model label;
- no response may directly change alarm, door, artifact, or player state.

Initial threshold values live in a versioned policy fixture. Changes require the
instrumented scenarios to be rerun and are recorded in the evidence report.

### 10.4 Fallback

Fallback receives the same guard context and returns a deterministic safe action:

- continue a valid current intent when evidence has not materially changed;
- otherwise hold and observe;
- investigate a still-active local stimulus when required to avoid inert guards;
- retain code-owned emergency behavior during confirmed global lockdown.

Fallback is clearly marked in UI and trace. It must not imitate provider output or
fabricate provider probabilities.

## 11. Client/server protocol

All messages contain `protocolVersion`, `sessionId`, and a monotonically increasing
sequence number. Schemas are validated at both ends.

### Client to server

- `session.start` — requested mode (`scripted`, `jev`, or `replay`) and map ID.
- `input.command` — bounded movement or interaction command with client sequence.
- `lens.select` — guard whose inspectable details should be streamed.
- `session.restart` — explicit restart request.

The client cannot submit a provider question, decision, world revision, target
position, inventory grant, or outcome.

### Server to client

- `session.ready` — mode, ruleset, map version, and server tick rate.
- `world.snapshot` — visible world state for rendering.
- `world.event` — presentation event such as sound, challenge, alarm, or capture.
- `decision.summary` — guard display state safe for normal UI.
- `decision.detail` — selected guard trace data for Decision Lens.
- `session.metrics` — latency and accounting aggregates.
- `session.outcome` — win/loss and replay identifier.
- `session.error` — recoverable or terminal error with a stable code.

Production client messages never include the provider key or unredacted server
environment.

## 12. Replay and evidence

### 12.1 Format

Each replay is newline-delimited JSON. Every line has:

```ts
interface TraceEnvelope<T> {
  schemaVersion: 1;
  sessionId: string;
  sequence: number;
  tick: Tick;
  monotonicMs: number;
  type: TraceRecordType;
  payload: T;
}
```

Required record types:

- `session.header` — git SHA, dirty flag, ruleset/map versions, mode, seed,
  dependency lock digest, sanitized configuration;
- `player.command`;
- `world.material_event`;
- `decision.request` — exact projected state and compiled questions sent, excluding
  secrets;
- `decision.response` — raw typed answers, provider request ID and usage metadata
  when available;
- `decision.error`;
- `decision.normalized`;
- `decision.applied` or `decision.rejected` with reasons;
- `world.checkpoint` — revision and deterministic hash;
- `session.footer` — outcome and accounting totals.

Write order is preserved by a per-session append queue. A crash may leave a trace
without a footer; readers report it as incomplete rather than treating it as a
valid finished run.

### 12.2 Redaction and retention

Traces contain synthetic game state only, but redaction still removes headers,
credentials, absolute host paths, and unexpected environment values. Raw HTTP
headers are never written. Local retention and deletion controls are documented
before deployment.

### 12.3 Replay modes

- **Faithful replay:** same initial seed, player commands, and normalized decisions;
  all checkpoint hashes must match.
- **Comparison replay:** same initial seed and player commands, but a different
  decision adapter; divergence is expected and is visualized by tick/revision.
- **Presentation replay:** renders a faithful replay without contacting a provider.

## 13. Observability and accounting

Per request:

- queue/debounce time;
- serialization time;
- provider wall time;
- normalization and policy time;
- guards, questions, and serialized bytes;
- accepted, stale, invalid, and fallback guard counts;
- provider request ID and usage fields when available.

Per session:

- request and question totals;
- median/p95 provider latency calculated only when sample size is shown;
- fallback/error/stale rates;
- intent and suspicion-band distributions;
- exact cost, estimated cost, or `unknown`, with the basis attached;
- game duration and outcome.

Logs are structured and separate operational events from evidence traces. A failed
trace write is visible and marks the session evidence-incomplete; it does not crash
the active game unless running an evidence-required scenario.

## 14. Configuration and secrets

Configuration is parsed once at server start from environment and versioned files.
Expected variables include:

```text
TYPESAFE_API_KEY             required only for live mode
HEIST_DECISION_MODE          scripted | jev | replay
HEIST_POLICY_PATH            versioned policy fixture
HEIST_TRACE_DIR              explicit writable directory
HEIST_LIVE_CALL_LIMIT        hard per-session cap
HEIST_DECISION_TIMEOUT_MS    bounded deadline
```

`.env` is ignored. `.env.example` contains names and safe descriptions only. The
server refuses live mode when the key or hard call limit is absent. It never falls
back from `jev` to another paid provider.

## 15. Security model

HEIST//ONE is not a security sandbox, but it applies basic defensive controls:

- authoritative server validation for every client message;
- per-session input and request rate limits;
- bounded session count and trace size;
- no arbitrary file path, URL, provider instruction, or Choice option from the
  browser;
- no HTML rendering of model/provider fields without escaping;
- same-origin production deployment and explicit development origins;
- dependency lockfile and secret scanning in CI;
- browser-bundle scan proving provider credentials and server-only modules are
  absent.

The game state is synthetic and contains no user-authored free text in v0.1.

## 16. Testing strategy

### 16.1 Simulation tests

- fixed-step determinism and stable checkpoint hashes;
- collision, navigation, access, perception, hearing, capture, alarm, and outcome
  invariants;
- property tests that no entity crosses impassable geometry and no illegal action
  mutates state;
- golden scenario runs under the scripted adapter.

### 16.2 Decision-domain tests

- contract tests shared by all `DecisionEngine` adapters;
- question compiler snapshots for all four primitive shapes;
- normalizer tests for missing, extra, malformed, out-of-range, and unknown-option
  answers;
- policy threshold and monotonicity tests where monotonic behavior is intended;
- stale epoch/context and invalid-target rejection;
- deadline, cancellation, backpressure, and five-error fallback sequences.

### 16.3 Replay tests

- write/read round trip;
- truncated and corrupt trace handling;
- credential/redaction fixture checks;
- faithful replay hash parity at every checkpoint;
- comparison replay divergence reporting.

### 16.4 Integration and end-to-end

- server plus scripted adapter is the default integration path;
- Playwright completes a scripted win, scripted capture, restart, Decision Lens,
  and replay flow;
- an opt-in live Jev test uses a tiny fixed scenario, a hard call cap, and records
  a sanitized receipt;
- a built-browser inspection asserts no provider key or server SDK code is present.

No test silently skips because live credentials are missing. Live-only tests are
in a separately invoked suite.

## 17. Performance budgets

Budgets under project control:

| Path | v0.1 budget |
| --- | --- |
| Server simulation step | p95 under 4 ms on the reference development machine |
| Client render | 60 fps target at 1080p on the reference development machine |
| Decision projection + compilation | p95 under 10 ms for six guards |
| Normalization + policy | p95 under 2 ms for six guards |
| Snapshot payload | p95 under 64 KiB |
| Decision request state + questions | hard bound configured and reported; initial target under 32 KiB serialized |
| Restart to playable state | under 5 seconds |

Provider latency is measured and displayed but is not represented as a local
performance guarantee. The game must remain responsive throughout the request.

## 18. Requirement verification matrix

| PRD requirement | Primary verification |
| --- | --- |
| G-01–G-05 | simulation integration tests and Playwright mission flows |
| D-01–D-02 | dependency/static architecture test and shared adapter contract suite |
| D-03–D-05 | question compiler snapshots and instrumented live receipt |
| D-06–D-08 | normalizer, stale-response, scheduler, and fallback tests |
| E-01 | Playwright Decision Lens flow |
| E-02 | trace schema and required-record audit |
| E-03 | faithful replay checkpoint-hash test |
| E-04 | accounting tests with exact, estimated, and unknown fixtures |
| E-05 | comparison replay end-to-end test |
| S-01 | environment separation and built-bundle secret scan |
| S-02–S-03 | clean CI plus separately invoked capped live suite |
| S-04 | request-bound tests |
| S-05 | asset manifest audit |

## 19. Delivery order

1. Workspace, protocol, deterministic seed, and one-room simulation.
2. Full MVP map and scripted guards; complete offline mission loop.
3. Perception projection and versioned guard context.
4. `DecisionEngine`, scripted contract tests, scheduler, normalization, and policy.
5. Jev adapter and opt-in fixed-scenario integration receipt.
6. Decision Lens, JSONL trace, faithful replay, and state hashes.
7. Instrumented scenarios, provider-loss behavior, and comparison replay.
8. Browser security checks, original/CC0 presentation, playtest, and private
   evidence package.

Each step leaves the default test suite green. Live access is not on the critical
path until step 5.

## 20. Deferred decisions

- Exact Phaser/React integration pattern after a render-loop spike.
- Initial confidence and Noul thresholds after recorded fixed-scenario runs.
- Whether radio-sharing guards should be batched separately to improve knowledge
  isolation.
- Whether Decision Lens is available during play, after a run, or both in a public
  candidate.
- Deployment platform and public live-access policy.

These do not block the deterministic vertical slice.
