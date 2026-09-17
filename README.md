# HEIST//ONE

An instrumented browser stealth game in which Jev supplies guards' fast,
probabilistic judgments while deterministic code owns the world.

The player enters a museum, manipulates incomplete evidence, steals an artifact,
and escapes. The game makes every guard's uncertainty visible: what they noticed,
what they suspect, what they intend to do, and how confident the model was.

This repository is private and currently contains the implementation contract,
not a playable build.

## Read first

- [`PRD.md`](PRD.md) defines the product, MVP, evidence standard, and release gates.
- [`SPEC.md`](SPEC.md) defines the runtime architecture, Jev decision contract,
  replay format, testing strategy, and acceptance criteria.
- [`AGENTS.md`](AGENTS.md) contains the operating rules for implementation work.

## Core rule

Jev decides **intent under ambiguity**. Code decides what is legal and executes
it. Navigation, visibility, collision, inventory, alarms, win/loss conditions,
and all side effects remain deterministic.

## Status

`v0.1 — specification complete; implementation not started`

HEIST//ONE is an independent experiment. It is not affiliated with or endorsed
by TypeSafe AI.
