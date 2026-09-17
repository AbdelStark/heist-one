# HEIST//ONE

An instrumented browser stealth game in which Jev supplies guards' fast,
probabilistic judgments while deterministic code owns the world.

The player enters a museum, manipulates incomplete evidence, steals an artifact,
and escapes. The game makes every guard's uncertainty visible: what they noticed,
what they suspect, what they intend to do, and how confident the model was.

This repository is private and contains the playable `v0.1` MVP.

## Play it locally

Requires Node.js 22.12 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173`, read the briefing, and enter the museum.

### Controls

| Input | Action |
| --- | --- |
| `WASD` or arrow keys | Move |
| `Shift` | Sprint |
| `C` | Crouch |
| `E` | Interact with doors, pickups, the breaker, and exits |
| `Q` | Throw a noise decoy |
| Click a guard | Pin that guard in the Decision Lens |

The clean extraction route is deliberately discoverable rather than prescribed:
collect useful credentials, manipulate light and noise, steal the artifact, then
reach an exit without allowing a guard to confirm the theft.

## What the MVP includes

- One deterministic museum level with six guards, three access-controlled doors,
  disguises, credentials, light control, decoys, an artifact, and two exits.
- An authoritative 30 Hz server simulation. The browser only renders snapshots
  and submits inputs.
- One batched decision call per guard cycle, covering observation, suspicion,
  intent, and target judgments for every guard.
- A deterministic scripted decision engine that makes the game playable without
  credentials, plus a server-side Jev adapter using the official TypeSafe SDK.
- A live Decision Lens exposing each guard's local evidence, probabilities,
  chosen intent, latency, and fallback state.
- Append-only JSONL evidence traces in `traces/` for inputs, decisions, material
  world events, outcomes, latency, token usage, and fallbacks.
- Unit, integration, and browser tests, including a complete successful heist.

## Jev mode

Scripted mode is the safe default. To exercise the live adapter, copy
`.env.example` to `.env`, provide `TYPESAFE_API_KEY`, and set
`HEIST_DECISION_MODE=jev`. Secrets remain server-side. If the key is absent or a
decision misses its deadline, the runtime stays playable through its scripted
fallback policy.

The Jev integration is covered by contract tests and has also completed a live
end-to-end extraction against the TypeSafe sandbox. The verified run used 12
batched requests for 288 typed judgments, with zero fallbacks, zero stale
decisions, and approximately 260 ms median provider latency. Exact provider cost
remains unknown because the response does not expose billable cost.

The simulation does not start—and therefore does not call Jev—until the player
leaves the briefing. During play, decisions are event-driven with a bounded
refresh interval rather than requested on every simulation tick.

## Launch video

The Remotion project lives in `apps/video`. It packages the recorded live-Jev
run, generated soundtrack, launch composition, and 16:9 thumbnail.

```bash
pnpm video:studio
pnpm video:render
```

Rendered deliverables:

- [`apps/video/out/heist-one-launch.mp4`](apps/video/out/heist-one-launch.mp4)
- [`apps/video/out/heist-one-thumbnail.png`](apps/video/out/heist-one-thumbnail.png)

With a local live credential configured and `pnpm dev` running,
`pnpm capture:live` repeats the full heist and captures a new source recording.
The capture script asserts that the run reaches `CLEAN EXTRACTION`; it never
writes the credential into the media or trace payloads.

## Verify it

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` runs formatting/lint checks, TypeScript checks, unit tests, and a
production build. The browser suite verifies both the Decision Lens interaction
and a full steal-and-extract route.

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

`v0.1 — playable MVP`

The MVP intentionally stops short of a polished content loop and a standalone
trace-replay viewer. Its evidence records are structured for that next step.

HEIST//ONE is an independent experiment. It is not affiliated with or endorsed
by TypeSafe AI.
