# HEIST//ONE agent contract

This repository is private. It is an instrumented game experiment, not a public
TypeSafe announcement and not evidence of TypeSafe endorsement.

## Read before changing anything

1. `PRD.md` is the product contract.
2. `SPEC.md` is the technical contract.
3. If the two disagree, stop and resolve the conflict in the documents before
   changing implementation behavior.

## Non-negotiable architecture

- Jev makes narrow tactical judgments from structured state.
- Deterministic code owns world truth, legal actions, pathfinding, physics,
  inventory, alarms, and win/loss conditions.
- The simulation depends on the `DecisionEngine` interface, never directly on
  the TypeSafe SDK.
- Maintain both `JevDecisionEngine` and `ScriptedDecisionEngine`. Offline tests,
  local development, and recorded replays must not require an API key.
- Never send the TypeSafe API key to the browser, logs, replay files, fixtures,
  screenshots, or source control.
- Decision responses are proposals. Validate them against current world state
  before applying them.
- Preserve deterministic replay: with the same initial seed, player inputs, and
  recorded normalized decisions, the simulation must reproduce the same state
  hashes.

## Evidence rules

- Treat latency, cost, calibration, and quality statements as claims to measure.
- Record raw timings and provider usage metadata when available. If exact cost
  is unavailable, label it unknown; never silently convert it to zero.
- Do not claim that Jev is superior to scripted game AI, an LLM, or a planner
  unless the repository contains a predeclared comparison that supports it.
- Distinguish provider output, game policy, and deterministic simulation behavior
  in traces and reports.

## Scope discipline

- Build the PRD's vertical slice before adding levels, procedural generation,
  generative dialogue, multiplayer, or new model providers.
- Prefer deep modules with small interfaces. Add a new seam only when there are
  at least two real adapters or a concrete test need.
- Keep the live Jev integration test opt-in. The default test suite is hermetic.
- Use original, licensed, or CC0 assets and retain provenance.

## External actions

Wait for explicit owner approval before making the repository public, sharing an
evaluation, contacting TypeSafe about it, posting media, or deploying a public
build. TypeSafe receives evaluation material privately before any public release.
