# HEIST//ONE — Product Requirements Document

| Field | Value |
| --- | --- |
| Status | v0.1 implementation contract |
| Date | 17 September 2026 |
| Owner | Abdelhamid Bakhta |
| Visibility | Private |
| Product | Instrumented browser stealth game |

## 1. Product thesis

HEIST//ONE is an original top-down stealth game built around a capability that is
hard to show in a conventional chatbot: many fast, typed, probabilistic judgments
composed inside ordinary software.

The player infiltrates a museum, steals an artifact, and escapes. Guards receive
different local observations and imperfect memories. Jev judges their suspicion,
attention, perceived threat, and next tactical intent. The deterministic game
simulation validates and executes those decisions.

The product is successful when a player can see and manipulate uncertainty. A
decoy should not merely flip a scripted flag; it should change several guards'
beliefs in different, inspectable ways while the game remains responsive and
fully constrained by code.

## 2. Why this game

Existing community projects establish that Jev can control familiar games. A new
project should therefore do more than attach the model to another emulator. It
should make the System One interface itself legible:

- several independent questions evaluated against one structured snapshot;
- Choice, Score, and Noul used for their native decision shapes;
- uncertainty affecting policy rather than being discarded;
- dynamic legal options supplied by code;
- deterministic mechanics and side effects outside the model;
- an evidence trail that separates model output from game logic.

A stealth game is a particularly good fit because its interesting moments are
fast judgments under incomplete information: whether a sound matters, whether a
badge is credible, which anomaly deserves attention, and when uncertainty is high
enough to call for help.

## 3. Product principles

1. **Uncertainty is playable.** Probabilities must alter behavior and be visible
   to the player in an optional tactical overlay.
2. **Jev judges; code governs.** The model never mutates the world or invents an
   action, entity, or target.
3. **A real game first.** The vertical slice must be understandable and enjoyable
   without reading an architecture diagram.
4. **Evidence, not theater.** Replays, timings, fallbacks, and model answers are
   recorded. Claims stay within what those records establish.
5. **Failure remains playable.** Missing access, timeouts, malformed responses,
   and provider errors degrade to a deterministic guard policy rather than
   freezing the game.
6. **Private before public.** Any evaluation of Jev is shared with TypeSafe
   privately before a public build or report.

## 4. Users

### Primary

- TypeSafe team members evaluating whether the project uses Jev idiomatically.
- AI and game engineers interested in typed decision models in real-time systems.
- Early Jev builders looking for a reference architecture beyond classification
  demos.

### Secondary

- Players who enjoy short stealth sandboxes and learning how an AI opponent
  reached a decision.

The MVP is a desktop-browser experience. Mobile controls and accessibility beyond
keyboard remapping, color-independent signals, readable text, and reduced motion
are post-MVP unless required to make the core experience usable.

## 5. Core player experience

### 5.1 Mission

The player must:

1. enter a compact museum after hours;
2. learn patrol patterns and security zones;
3. create or exploit ambiguity;
4. acquire the protected artifact;
5. reach an exit before capture or lockdown.

A successful run should take 5–10 minutes. Restarting should take less than five
seconds.

### 5.2 The museum

The MVP contains one hand-authored map with:

- an exterior entry and two possible exits;
- a public gallery, staff corridor, security room, and artifact room;
- doors with public, staff, and secured access classes;
- light zones that affect guard perception;
- alarm panels and a global alert state;
- six guards with distinct patrols, roles, and concise behavioral profiles.

### 5.3 Player verbs

The MVP supports:

- walk, sprint, crouch, and interact;
- open permitted doors and attempt restricted doors;
- throw a noise emitter to create a located auditory stimulus;
- cut or restore power to one lighting zone;
- acquire and wear a staff disguise;
- present a stolen badge when challenged;
- pick up the artifact and escape.

There is no lethal combat. A guard who reaches the player during pursuit captures
them. This keeps the game about interpretation and manipulation rather than aim or
damage balancing.

### 5.4 Guard behavior visible to the player

The normal view communicates guard state through animation, iconography, and
sound: relaxed, attentive, suspicious, pursuing, or alarmed.

The optional **Decision Lens** shows, for a selected guard:

- the observations included in that guard's decision context;
- current tactical intent and attention target;
- suspicion distribution and score;
- threat probability;
- model confidence where the primitive provides it;
- request age, response latency, and whether a fallback was used.

The lens must distinguish raw provider answers from the final action selected by
game policy.

## 6. Jev's role

At a decision epoch, the game builds a compact structured context for each guard
who needs a new judgment. One batched request asks independent questions for all
due guards.

The MVP uses four judgments per guard:

| Judgment | Primitive | Product use |
| --- | --- | --- |
| Perceived threat | Noul | Probability that the guard's local evidence indicates an intruder or active security threat |
| Suspicion | Score | Position on a five-level relaxed-to-certain spectrum |
| Tactical intent | Choice | One of the legal high-level behaviors supplied by the game |
| Attention target | Choice | One of the currently observable actors, stimuli, or locations supplied by the game |

Jev does not choose movement vectors, paths, animations, exact interaction timing,
or arbitrary text. It receives no image frames in v0.1.

### 6.1 Decision epochs

Decisions are event-driven, not requested once per render or simulation tick. A
guard becomes due when one or more of the following occurs:

- a new person, object change, or sound enters local perception;
- a tracked person materially changes behavior or authorization evidence;
- lights, doors, the artifact, or global alert state changes;
- the guard reaches the end of an intent or loses its target;
- a bounded refresh interval expires while the guard remains uncertain.

Events that occur while a request is in flight are coalesced into the next epoch.
Stale decisions are rejected using a world revision and guard-context revision.

### 6.2 Confidence policy

Probability and confidence are inputs to deterministic policy, not decorative UI.
Initial thresholds are explicit configuration and must be tuned against recorded
scenarios rather than hidden in prompts.

- A high-confidence legal intent can execute immediately.
- A medium-confidence threat or intent biases toward investigation, observation,
  or coordination.
- A low-confidence response cannot trigger irreversible escalation by itself; the
  guard holds, gathers more evidence, or uses the scripted safe action.
- Raising the global alarm requires corroboration from policy-defined evidence or
  a high-confidence, high-threat decision.

The exact thresholds are implementation parameters, not claims about calibration.

## 7. MVP requirements

Requirements use stable IDs so the technical specification and tests can refer to
them.

### 7.1 Gameplay

- **G-01:** A player can start, win, lose, and immediately restart the single
  museum mission.
- **G-02:** The map contains six active guards, three access classes, lighting
  zones, one artifact, alarms, and at least two exits.
- **G-03:** Noise, darkness, disguise, badge evidence, trespass, and artifact
  removal can independently affect a guard's perceived state.
- **G-04:** Guard navigation and action execution remain deterministic and cannot
  cross walls, use an inaccessible door, or target an absent entity.
- **G-05:** Capture and lockdown have clear, code-owned conditions.

### 7.2 Decision system

- **D-01:** The simulation calls one `DecisionEngine` interface and has no direct
  dependency on the TypeSafe SDK.
- **D-02:** The repository provides Jev and scripted adapters for that interface.
- **D-03:** A single provider request can contain all four judgments for every
  guard due in the same epoch.
- **D-04:** Every question explicitly references one guard context and has a
  complete instruction; question IDs are never relied upon as model context.
- **D-05:** Dynamic Choice criteria contain only legal, currently addressable
  targets and include a safe `none` option where coverage may be incomplete.
- **D-06:** Provider answers are normalized and checked against current world
  state before policy can apply them.
- **D-07:** Timeouts, provider errors, invalid answers, and stale answers invoke a
  deterministic fallback without pausing the simulation.
- **D-08:** At most one decision batch is in flight per game session in v0.1.

### 7.3 Legibility and evidence

- **E-01:** Decision Lens presents observation, raw answer distribution, model
  confidence, resolved action, latency, and fallback state without opening dev
  tools.
- **E-02:** Every run produces a versioned JSONL trace containing the initial seed,
  player inputs, material world events, decision contexts, raw answers, normalized
  decisions, policy outcomes, timings, errors, and provider usage metadata when
  available.
- **E-03:** A recorded run can replay offline without an API key and reproduce
  checkpoint state hashes.
- **E-04:** The UI reports exact provider cost only when supported by provider
  usage data. Estimates are labeled as estimates; unavailable cost is `unknown`.
- **E-05:** A comparison mode can replay the same player input stream with the Jev
  recording and the scripted adapter. It does not label either one as superior.

### 7.4 Security and operations

- **S-01:** The TypeSafe key is loaded by the server from the environment and is
  absent from browser assets, client messages, traces, fixtures, and logs.
- **S-02:** The default local and CI workflows use the scripted adapter and require
  no network or paid model call.
- **S-03:** Live integration tests are opt-in, visibly identify that they incur
  external calls, and use a hard request cap.
- **S-04:** A session has request-rate, question-count, state-size, and wall-time
  budgets enforced before calling the provider.
- **S-05:** All third-party assets have recorded provenance and compatible terms.

## 8. Instrumented scenarios

The MVP ships deterministic scenario fixtures before free-form tuning:

1. **Dropped object:** one guard hears a noise outside line of sight.
2. **Conflicting stimuli:** two guards receive different evidence about a decoy
   and a moving person.
3. **Bad badge:** a disguised player presents a badge whose zone does not match the
   current room.
4. **Lights out:** a zone loses power while the player is near a restricted door.
5. **Missing artifact:** guards discover removal at different times through their
   local routes and radio state.
6. **Stale answer:** the target leaves or becomes invalid while a provider request
   is in flight.
7. **Provider loss:** five consecutive requests time out while the mission remains
   playable under fallback behavior.

These fixtures are regression scenarios, not a calibration benchmark. They test
the integration, game policy, and traceability of decisions.

## 9. Success measures

### 9.1 Product success for v0.1

- Five internal playtesters can explain the distinction between Jev judgment and
  deterministic execution after one run.
- At least four of five playtesters finish or fail a mission without instruction
  from the developer.
- Decision Lens correctly accounts for every observed guard transition in the
  instrumented scenarios.
- Scripted mode, live mode, and offline replay all complete the same mission loop.

### 9.2 Engineering measures

- The simulation maintains its target frame/tick budget independently of provider
  latency.
- All provider calls and fallbacks are accounted for in the trace.
- No decision can apply to the wrong world or guard revision.
- Replays reproduce all declared checkpoint hashes.
- The default test suite is hermetic and repeatable.

### 9.3 Measures reported, not pre-guaranteed

For live sessions the project reports median and p95 decision latency, request and
question counts, state size, fallback rate, provider-reported usage, estimated or
exact cost status, mission outcome, and distribution of guard intents. External
latency and model quality are observations, not release gates.

## 10. Non-goals for v0.1

- Multiplayer, leaderboards, accounts, persistence, or monetization.
- Procedural maps, campaign progression, combat, or more than one mission.
- Natural-language dialogue or a general-purpose LLM in the runtime.
- Image or audio model inputs; perception is derived from simulation state.
- Letting Jev perform pathfinding, choose arbitrary coordinates, invoke tools, or
  mutate state directly.
- Training or fine-tuning a model.
- Claiming scientific calibration results from gameplay traces.
- Supporting more providers than Jev and the deterministic scripted adapter.
- Public deployment or promotion before the private review gate.

## 11. Scope sequence

### Milestone 0 — deterministic vertical slice

- museum geometry, movement, perception, guard pathfinding, win/loss;
- scripted decision adapter;
- noise, lighting, disguise, badge, artifact, alarm;
- versioned world state and deterministic seed.

Exit: the mission is playable offline and all game rules are code-owned.

### Milestone 1 — instrumented Jev slice

- server-side TypeSafe integration through `DecisionEngine`;
- batched guard questions, policy resolution, stale-response protection;
- Decision Lens, metrics, JSONL trace, offline replay;
- instrumented scenario suite and provider-loss behavior.

Exit: all MVP requirements G-01 through S-05 pass.

### Milestone 2 — private release candidate

- original/CC0 visual and audio treatment;
- onboarding, keyboard remapping, color-independent alert signals;
- comparison replay, internal playtest, evidence report;
- security review of browser bundle and traces.

Exit: owner approves a private TypeSafe review package. Public deployment remains
a separate explicit decision.

## 12. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Jev is asked to solve deterministic planning and looks worse than ordinary code | Restrict it to tactical intent and ambiguous judgments; keep navigation and legality in code |
| One batched state leaks knowledge between guard contexts | Build explicit per-guard contexts, name exact paths in every instruction, record this limitation, and avoid claims of strict information isolation |
| Provider latency makes guards feel frozen | Event-driven scheduling, non-blocking simulation, intent persistence, deadlines, coalescing, and scripted fallback |
| Model variation makes replay irreproducible | Record raw and normalized decisions; offline replay consumes the recording rather than calling the provider |
| Probability UI overwhelms the game | Keep the normal view simple; put detailed distributions behind Decision Lens |
| Demo becomes a cherry-picked video | Ship scenario fixtures, full traces, and failure behavior with the private review package |
| API access or semantics change | Keep the SDK behind one adapter and pin the tested dependency in the lockfile |
| Public viewers infer endorsement or benchmark validity | Use an independent-project disclaimer and evidence-bounded language |

## 13. Release gate

The repository and build remain private until all of the following are true:

1. MVP acceptance criteria pass on a clean checkout.
2. No secret or private account data appears in browser assets or traces.
3. Asset provenance is complete.
4. Claims are backed by attached traces or explicitly labeled as hypotheses.
5. TypeSafe has received the evaluation privately and had a reasonable opportunity
   to correct factual or integration errors.
6. The owner explicitly approves publication and outreach in the active session.

## 14. Open product questions

These are deliberately deferred until the vertical slice produces evidence:

- Whether showing full probabilities during a normal run makes stealth easier or
  should remain a post-run/replay feature.
- Whether guard personalities improve legibility or introduce noise into scenario
  comparison.
- Whether a 2D blueprint aesthetic or a more representational museum better serves
  the Decision Lens.
- Which confidence policy feels fair without overstating what confidence means.
- Whether the public candidate should expose live Jev play or use curated recorded
  sessions to avoid distributing API access.

## 15. Design basis

The v0.1 contract was scoped against the following first-party material on 17
September 2026:

- [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
  for the product thesis, latency/cost claims, and the explicit limitations of the
  Doom demonstration.
- [Primitives](https://docs.typesafe.ai/primitives) for Choice, Score, Noul,
  independent questions, shared state, and parallel batching semantics.
- [How to build with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
  for the division between narrow model judgments and code-owned policy.
- [Official JavaScript SDK](https://github.com/typesafe-ai/typesafe-sdk-js) for the
  server-side integration surface and supported Node.js baseline.

Provider behavior remains a dependency to verify with an opt-in live receipt;
documentation is not substituted for observed runtime evidence.
