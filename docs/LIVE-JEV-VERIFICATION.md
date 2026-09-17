# Live Jev verification

Date: 2026-09-17<br>
Environment: TypeSafe sandbox<br>
Credential handling: local ignored `.env`; credential excluded from traces, media, and Git

## Result

A browser-controlled run completed the entire jacket → badge → vault → artifact →
service-exit route using the live `JevDecisionEngine`.

| Measure | Observed |
| --- | ---: |
| Session | `9cd11608-0c9b-4696-b346-fbeb049c28b9` |
| Outcome | `won` |
| Checkpoint hash | `b0251af2` |
| Batched requests | 12 |
| Typed judgments | 288 |
| Successful responses | 12 |
| Decision errors | 0 |
| Fallbacks | 0 |
| Stale decisions | 0 |
| Median latency | 259.9 ms |
| p95 latency | 344.1 ms |
| Input tokens | 63,349 |
| Output tokens | 12,181 |
| Exact provider cost | Unknown; not exposed by the response |

The corresponding ignored JSONL trace remains local under `traces/`. The launch
film uses the recorded run rather than a scripted-mode substitute.

## Deliverable integrity

| File | SHA-256 |
| --- | --- |
| `apps/video/public/gameplay-live.mp4` | `7fd601cfe7316e47bc9c992b2aa3ec6049ea1c1a70b94aa65cf8236dd8e549bd` |
| `apps/video/out/heist-one-launch.mp4` | `352626402641e2908b27c00bdeb17dd83288f2b8bfa2b9333b7d7185ba0ce902` |
| `apps/video/out/heist-one-thumbnail.png` | `af28634bc7dc0a3962addbd85b72ae8f146c7bf16262268e3f90d8a0f184facc` |

The final launch film is 36.84 seconds, 1920×1080 at 30 fps, with H.264 video
and 48 kHz stereo AAC audio.
