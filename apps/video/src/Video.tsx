import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { Audio, Video } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DURATION_IN_FRAMES } from "./Root";

const { fontFamily: manrope } = loadManrope("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
});
const { fontFamily: mono } = loadPlexMono("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const colors = {
  black: "#050707",
  panel: "#0a0d0c",
  acid: "#c8ff2e",
  cyan: "#47caff",
  ink: "#d8d3c5",
  muted: "#6c7875",
  line: "#2b3532",
};

const Grid = (): React.JSX.Element => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.black,
      backgroundImage:
        "linear-gradient(rgba(200,255,46,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,46,0.035) 1px, transparent 1px)",
      backgroundSize: "72px 72px",
    }}
  />
);

const Frame = (): React.JSX.Element => (
  <AbsoluteFill style={{ pointerEvents: "none", padding: 42 }}>
    <div style={{ flex: 1, border: `1px solid ${colors.line}`, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          width: 92,
          height: 2,
          top: -1,
          left: -1,
          background: colors.acid,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 92,
          height: 2,
          right: -1,
          bottom: -1,
          background: colors.acid,
        }}
      />
    </div>
  </AbsoluteFill>
);

const CornerMeta = (props: { right?: string }): React.JSX.Element => (
  <div
    style={{
      position: "absolute",
      top: 64,
      right: 72,
      color: colors.muted,
      fontFamily: mono,
      fontSize: 18,
      letterSpacing: 4,
      textAlign: "right",
    }}
  >
    LIVE SYSTEM / 001
    <br />
    <span style={{ color: colors.acid }}>{props.right ?? "JEV ONLINE"}</span>
  </div>
);

const Intro = (): React.JSX.Element => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, delay: 8, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [45, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: colors.black, color: colors.ink }}>
      <Grid />
      <Frame />
      <CornerMeta />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 110,
          width: 78,
          height: 78,
          border: `2px solid ${colors.acid}`,
          display: "grid",
          placeItems: "center",
          color: colors.acid,
          fontFamily: mono,
          fontSize: 21,
          fontWeight: 700,
          opacity,
        }}
      >
        {"H//1"}
      </div>
      <div style={{ position: "absolute", left: 110, right: 110, top: 328 }}>
        <div
          style={{
            color: colors.acid,
            fontFamily: mono,
            fontSize: 18,
            letterSpacing: 6,
            opacity,
          }}
        >
          A LIVE STEALTH EXPERIMENT
        </div>
        <div
          style={{
            marginTop: 24,
            maxWidth: 1500,
            color: colors.ink,
            fontFamily: manrope,
            fontSize: 108,
            lineHeight: 0.94,
            fontWeight: 800,
            letterSpacing: -5,
            transform: `translateY(${interpolate(entrance, [0, 1], [70, 0])}px)`,
            opacity: entrance,
          }}
        >
          GUARDS SHOULDN&apos;T
          <br />
          KNOW THE <span style={{ color: colors.acid }}>SCRIPT.</span>
        </div>
        <div
          style={{
            marginTop: 38,
            display: "flex",
            alignItems: "center",
            gap: 22,
            color: colors.muted,
            fontFamily: mono,
            fontSize: 22,
            letterSpacing: 2,
            opacity: subtitleOpacity,
          }}
        >
          <span style={{ width: 84, height: 2, background: colors.acid }} />
          {"HEIST//ONE · POWERED BY JEV"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const callouts = [
  {
    from: 35,
    to: 205,
    index: "01",
    label: "PERCEPTION",
    title: "EVIDENCE IN.",
    body: "Each guard sees only its local world.",
  },
  {
    from: 220,
    to: 390,
    index: "02",
    label: "NOUL + SCORE",
    title: "UNCERTAINTY OUT.",
    body: "Threat probability and calibrated suspicion.",
  },
  {
    from: 405,
    to: 565,
    index: "03",
    label: "CHOICE",
    title: "INTENT, NOT MOVEMENT.",
    body: "Jev chooses tactics. Deterministic code enforces the world.",
  },
  {
    from: 580,
    to: 735,
    index: "04",
    label: "EXTRACTION",
    title: "OUTPLAY THE BELIEF.",
    body: "Steal the artifact before certainty becomes alarm.",
  },
] as const;

const Gameplay = (): React.JSX.Element => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = interpolate(frame, [0, 750], [1.025, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const active = callouts.find((callout) => frame >= callout.from && frame < callout.to);
  const localFrame = active ? frame - active.from : 0;
  const reveal = spring({ frame: localFrame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: colors.black, overflow: "hidden" }}>
      <Video
        src={staticFile("gameplay-live.mp4")}
        muted
        trimBefore={30}
        playbackRate={1.24}
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(3,5,5,0.72) 0%, transparent 34%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 48,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          border: `1px solid ${colors.line}`,
          background: "rgba(5,7,7,0.84)",
          color: colors.ink,
          fontFamily: mono,
          fontSize: 16,
          letterSpacing: 2,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: colors.acid,
            boxShadow: `0 0 16px ${colors.acid}`,
          }}
        />
        LIVE JEV · 24 JUDGMENTS / EPOCH
      </div>
      {active ? (
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 72,
            width: 610,
            padding: "28px 32px 30px",
            borderLeft: `4px solid ${colors.acid}`,
            background: "rgba(5,7,7,0.9)",
            transform: `translateX(${interpolate(reveal, [0, 1], [-46, 0])}px)`,
            opacity: reveal,
          }}
        >
          <div style={{ color: colors.acid, fontFamily: mono, fontSize: 16, letterSpacing: 4 }}>
            {active.index} / {active.label}
          </div>
          <div
            style={{
              marginTop: 10,
              color: colors.ink,
              fontFamily: manrope,
              fontWeight: 800,
              fontSize: 48,
              letterSpacing: -1.5,
            }}
          >
            {active.title}
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.muted,
              fontFamily: mono,
              fontSize: 17,
              lineHeight: 1.5,
            }}
          >
            {active.body}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Metric = (props: { value: string; label: string; delay: number }): React.JSX.Element => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, delay: props.delay, config: { damping: 200 } });
  return (
    <div
      style={{
        borderTop: `2px solid ${colors.acid}`,
        paddingTop: 16,
        transform: `translateY(${interpolate(reveal, [0, 1], [30, 0])}px)`,
        opacity: reveal,
      }}
    >
      <div style={{ color: colors.acid, fontFamily: manrope, fontSize: 42, fontWeight: 800 }}>
        {props.value}
      </div>
      <div
        style={{
          marginTop: 6,
          color: colors.muted,
          fontFamily: mono,
          fontSize: 15,
          letterSpacing: 2,
        }}
      >
        {props.label}
      </div>
    </div>
  );
};

const Proof = (): React.JSX.Element => {
  const frame = useCurrentFrame();
  const headline = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: colors.black }}>
      <Img
        src={staticFile("extraction.jpg")}
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.27 }}
      />
      <AbsoluteFill
        style={{ background: "linear-gradient(90deg, #050707 0%, #050707dd 56%, #05070755)" }}
      />
      <Frame />
      <CornerMeta right="RUN VERIFIED" />
      <div style={{ position: "absolute", left: 110, top: 180, right: 110 }}>
        <div style={{ color: colors.acid, fontFamily: mono, fontSize: 17, letterSpacing: 5 }}>
          ONE LIVE RUN / ZERO FALLBACKS
        </div>
        <div
          style={{
            marginTop: 22,
            color: colors.ink,
            fontFamily: manrope,
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -4,
            opacity: headline,
            transform: `translateY(${interpolate(headline, [0, 1], [32, 0])}px)`,
          }}
        >
          THE HEIST WAS REAL.
          <br />
          SO WERE THE DECISIONS.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 30,
            marginTop: 78,
            maxWidth: 1250,
          }}
        >
          <Metric value="12" label="BATCHED REQUESTS" delay={32} />
          <Metric value="288" label="TYPED JUDGMENTS" delay={39} />
          <Metric value="260MS" label="MEDIAN LATENCY" delay={46} />
          <Metric value="0" label="FALLBACKS" delay={53} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro = (): React.JSX.Element => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, delay: 4, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{
        background: colors.acid,
        color: colors.black,
        display: "flex",
        alignItems: "center",
        padding: "0 110px",
      }}
    >
      <div
        style={{
          transform: `translateY(${interpolate(reveal, [0, 1], [44, 0])}px)`,
          opacity: reveal,
        }}
      >
        <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, letterSpacing: 5 }}>
          {"HEIST//ONE"}
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: manrope,
            fontWeight: 800,
            fontSize: 112,
            lineHeight: 0.92,
            letterSpacing: -6,
          }}
        >
          UNCERTAINTY
          <br />
          IS THE MAP.
        </div>
        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 22,
            alignItems: "center",
            fontFamily: mono,
            fontSize: 20,
            letterSpacing: 3,
          }}
        >
          <span style={{ width: 88, height: 3, background: colors.black }} />
          BUILT WITH JEV / TYPESAFE
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          bottom: 92,
          width: 116,
          height: 116,
          border: `3px solid ${colors.black}`,
          display: "grid",
          placeItems: "center",
          fontFamily: mono,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {"H//1"}
      </div>
    </AbsoluteFill>
  );
};

const soundtrackVolume = (frame: number): number =>
  interpolate(frame, [0, 30, DURATION_IN_FRAMES - 60, DURATION_IN_FRAMES], [0, 0.65, 0.65, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const HeistOneLaunch = (): React.JSX.Element => (
  <AbsoluteFill style={{ background: colors.black }}>
    <Audio src={staticFile("soundtrack.mp3")} volume={soundtrackVolume} />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={120}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={750}>
        <Gameplay />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={165}>
        <Proof />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={105}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export const HeistOneThumbnail = (): React.JSX.Element => (
  <AbsoluteFill style={{ background: colors.black }}>
    <Img
      src={staticFile("extraction.jpg")}
      style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.34 }}
    />
    <AbsoluteFill
      style={{ background: "linear-gradient(90deg, #050707 0%, #050707ee 56%, transparent)" }}
    />
    <Frame />
    <div style={{ position: "absolute", left: 110, top: 180, width: 1050 }}>
      <div style={{ color: colors.acid, fontFamily: mono, fontSize: 20, letterSpacing: 5 }}>
        A LIVE STEALTH EXPERIMENT / JEV
      </div>
      <div
        style={{
          marginTop: 25,
          color: colors.ink,
          fontFamily: manrope,
          fontWeight: 800,
          fontSize: 122,
          lineHeight: 0.93,
          letterSpacing: -6,
        }}
      >
        OUTPLAY
        <br />
        WHAT THEY
        <br />
        <span style={{ color: colors.acid }}>BELIEVE.</span>
      </div>
      <div
        style={{
          marginTop: 40,
          color: colors.muted,
          fontFamily: mono,
          fontSize: 20,
          letterSpacing: 3,
        }}
      >
        {"HEIST//ONE · POWERED BY JEV"}
      </div>
    </div>
  </AbsoluteFill>
);
