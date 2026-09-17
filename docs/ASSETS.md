# Asset provenance

Last audited: 2026-09-17

HEIST//ONE does not use third-party game sprites, textures, sound effects, or
music samples.

| Asset | Origin | Terms |
| --- | --- | --- |
| Game visuals | Shapes, typography, and UI rendered by the repository source | MIT with the project |
| `apps/video/public/gameplay-live.mp4` | Browser capture of the live Jev run made for this project | MIT with the project |
| `apps/video/public/extraction.jpg` | Still frame extracted from that gameplay capture | MIT with the project |
| `apps/video/public/soundtrack.mp3` | Original synthetic soundtrack generated locally for this project; no samples or third-party recordings | MIT with the project |
| `apps/video/out/heist-one-launch.mp4` | Remotion composition rendered from the three assets above and repository-authored graphics | MIT with the project |
| `apps/video/out/heist-one-thumbnail.png` | Remotion still rendered from repository-authored graphics and the gameplay still | MIT with the project |
| Manrope | Loaded at render time through `@remotion/google-fonts` from Google Fonts | SIL Open Font License 1.1 |
| IBM Plex Mono | Loaded at render time through `@remotion/google-fonts` from Google Fonts | SIL Open Font License 1.1 |

Third-party software packages are not redistributed as authored game assets.
Their copyright and license terms remain with their respective authors and are
represented in the lockfile dependency graph. In particular, Remotion 4 uses
the [Remotion License](https://github.com/remotion-dev/remotion/blob/v4.0.525/LICENSE.md),
which has different terms for individuals, small organizations, and larger
for-profit organizations.
