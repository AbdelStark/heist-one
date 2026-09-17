# Contributing to HEIST//ONE

Thanks for helping improve the experiment. HEIST//ONE is intentionally small:
one heist, one observable decision loop, and a strict boundary between model
judgment and deterministic authority.

## Start here

Before changing behavior, read:

1. [`PRD.md`](PRD.md) for product scope and evidence standards.
2. [`SPEC.md`](SPEC.md) for the runtime and decision contracts.
3. [`AGENTS.md`](AGENTS.md) for implementation invariants.

If those documents disagree, resolve the contract before changing code.

## Set up locally

You need Node.js 22.13 or newer and pnpm 11.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

The default test path is hermetic and uses `ScriptedDecisionEngine`. It does not
need network access or a TypeSafe key.

## Make a focused change

- Open an issue first for a new level, provider, protocol, or material change to
  the model/code authority boundary.
- Keep the deterministic simulation in `packages/game` independent of provider
  SDKs.
- Treat provider outputs as proposals. Validate legality and context freshness
  before applying them.
- Preserve `ScriptedDecisionEngine` whenever `JevDecisionEngine` changes.
- Add or update the narrowest test that proves the behavior.
- Do not introduce third-party media without recording its source and license in
  [`docs/ASSETS.md`](docs/ASSETS.md).

## Live-provider work

Live Jev calls are opt-in because they consume an external quota and can vary.
Never put a credential in a command, fixture, issue, pull request, trace, image,
or recording. Use a local ignored `.env` file.

When reporting live results, include the date, model/service environment, sample
count, success and fallback counts, latency definition, and material unknowns.
A single successful run is not a benchmark.

## Pull requests

In the pull request description:

- explain the player-visible or architectural change;
- identify the relevant PRD/SPEC requirement;
- list the commands you ran;
- separate live-provider evidence from scripted tests;
- call out new network, quota, credential, or asset implications.

By contributing, you agree that your contribution is licensed under this
repository's MIT License and that you will follow the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
