import type {
  ClientMessage,
  ClientSnapshot,
  DecisionDistribution,
  GuardState,
  InputState,
  ServerMessage,
} from "@heist-one/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "./GameCanvas";

interface RuntimeConfig {
  defaultMode: "scripted" | "jev";
  liveAvailable: boolean;
  decisionTimeoutMs: number;
  liveCallLimit: number;
}

type ClientMessageWithoutSequence = ClientMessage extends infer Message
  ? Message extends ClientMessage
    ? Omit<Message, "sequence">
    : never
  : never;

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
};

const KEY_TO_INPUT: Record<string, keyof InputState> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  KeyC: "crouch",
  ControlLeft: "crouch",
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function ProbabilityBars(props: {
  distribution: DecisionDistribution;
  selected: string | null;
}): React.JSX.Element {
  const rows = Object.entries(props.distribution)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5);
  if (rows.length === 0) return <p className="empty">No provider distribution available.</p>;
  return (
    <div className="probability-bars">
      {rows.map(([label, value]) => (
        <div
          className={label === props.selected ? "probability active" : "probability"}
          key={label}
        >
          <div className="probability-label">
            <span>{label.replaceAll("_", " ")}</span>
            <span>{percent(value)}</span>
          </div>
          <div className="probability-track">
            <span style={{ width: percent(value) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionLens(props: { guard: GuardState | null }): React.JSX.Element {
  const guard = props.guard;
  if (!guard) {
    return (
      <aside className="lens panel">
        <div className="panel-kicker">DECISION LENS</div>
        <p className="empty">Select a guard on the floor plan.</p>
      </aside>
    );
  }
  const decision = guard.decision;
  return (
    <aside className="lens panel" data-testid="decision-lens">
      <div className="lens-heading">
        <div>
          <div className="panel-kicker">DECISION LENS / {guard.id}</div>
          <h2>{guard.label}</h2>
        </div>
        <span className={`intent intent-${guard.suspicionBand}`}>
          {guard.intent.replaceAll("_", " ")}
        </span>
      </div>
      <div className="spec-grid">
        <span>ROLE</span>
        <strong>{guard.role.replaceAll("_", " ")}</strong>
        <span>PROFILE</span>
        <strong>{guard.profile}</strong>
        <span>STATE</span>
        <strong>{guard.suspicionBand.replaceAll("_", " ")}</strong>
        <span>SOURCE</span>
        <strong>{decision?.source ?? "pending"}</strong>
        <span>LATENCY</span>
        <strong>{decision ? `${decision.latencyMs.toFixed(1)} ms` : "pending"}</strong>
        <span>EPOCH</span>
        <strong>{decision?.epochId ?? "pending"}</strong>
      </div>
      {decision ? (
        <>
          <section className="lens-section">
            <div className="section-title">
              <span>01</span> THREAT / NOUL
            </div>
            <div className="threat-readout">
              <strong>{percent(decision.threatProbability)}</strong>
              <div>
                <span style={{ width: percent(decision.threatProbability) }} />
              </div>
            </div>
          </section>
          <section className="lens-section">
            <div className="section-title">
              <span>02</span> SUSPICION / SCORE {decision.suspicionScore.toFixed(2)}
            </div>
            <ProbabilityBars
              distribution={decision.suspicionProbabilities}
              selected={String(Math.round(decision.suspicionScore))}
            />
          </section>
          <section className="lens-section">
            <div className="section-title">
              <span>03</span> INTENT / CHOICE
            </div>
            <ProbabilityBars
              distribution={decision.intentProbabilities}
              selected={decision.proposedIntent}
            />
            {decision.proposedIntent !== decision.appliedIntent ? (
              <p className="policy-note">
                POLICY: {decision.proposedIntent} → {decision.appliedIntent}
              </p>
            ) : null}
          </section>
          <section className="lens-section observations">
            <div className="section-title">
              <span>04</span> LOCAL OBSERVATIONS
            </div>
            {decision.observations.length === 0 ? (
              <p className="empty">No current anomaly.</p>
            ) : (
              decision.observations.map((observation) => (
                <div className="observation" key={observation.id}>
                  <span>{observation.kind.replaceAll("_", " ")}</span>
                  <p>{observation.summary}</p>
                </div>
              ))
            )}
          </section>
        </>
      ) : (
        <p className="empty waiting">Waiting for the first decision epoch.</p>
      )}
    </aside>
  );
}

export function App(): React.JSX.Element {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [mode, setMode] = useState<"scripted" | "jev">("scripted");
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>("guard_01");
  const [connectionState, setConnectionState] = useState("CONNECTING");
  const [showBriefing, setShowBriefing] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const sequenceRef = useRef(0);
  const inputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const enteredRef = useRef(false);

  const send = useCallback((message: ClientMessageWithoutSequence) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ ...message, sequence: ++sequenceRef.current }));
  }, []);

  const connect = useCallback((nextMode: "scripted" | "jev") => {
    socketRef.current?.close();
    setSnapshot(null);
    setConnectionState("CONNECTING");
    setMode(nextMode);
    sequenceRef.current = 0;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?mode=${nextMode}`);
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      setConnectionState("ONLINE");
      if (enteredRef.current) {
        socket.send(JSON.stringify({ type: "start", sequence: ++sequenceRef.current }));
      }
    });
    socket.addEventListener("close", () => setConnectionState("OFFLINE"));
    socket.addEventListener("error", () => setConnectionState("ERROR"));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === "ready") setConnectionState(`ONLINE / ${message.mode.toUpperCase()}`);
      if (message.type === "snapshot") setSnapshot(message.snapshot);
      if (message.type === "error") setConnectionState(`ERROR / ${message.code}`);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/config")
      .then((response) => response.json() as Promise<RuntimeConfig>)
      .then((runtimeConfig) => {
        if (!active) return;
        setConfig(runtimeConfig);
        connect(
          runtimeConfig.defaultMode === "jev" && runtimeConfig.liveAvailable ? "jev" : "scripted",
        );
      })
      .catch(() => {
        if (active) connect("scripted");
      });
    return () => {
      active = false;
      socketRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    const updateInput = (event: KeyboardEvent, pressed: boolean): void => {
      const field = KEY_TO_INPUT[event.code];
      if (field) {
        event.preventDefault();
        if (inputRef.current[field] === pressed) return;
        inputRef.current = { ...inputRef.current, [field]: pressed };
        send({ type: "input", input: inputRef.current });
      }
      if (!pressed || event.repeat) return;
      if (event.code === "KeyE") send({ type: "action", action: "interact" });
      if (event.code === "KeyQ") send({ type: "action", action: "throw_noise" });
      if (event.code === "KeyR" && snapshot?.status !== "playing") send({ type: "restart" });
    };
    const keyDown = (event: KeyboardEvent): void => updateInput(event, true);
    const keyUp = (event: KeyboardEvent): void => updateInput(event, false);
    const release = (): void => {
      inputRef.current = { ...EMPTY_INPUT };
      send({ type: "input", input: inputRef.current });
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
    };
  }, [send, snapshot?.status]);

  const selectedGuard = useMemo(
    () => snapshot?.guards.find((guard) => guard.id === selectedGuardId) ?? null,
    [selectedGuardId, snapshot],
  );
  const inventory = snapshot?.player;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">{"H//1"}</div>
          <div>
            <h1>
              HEIST<span>{"//"}</span>ONE
            </h1>
            <p>UNCERTAINTY IS THE MAP</p>
          </div>
        </div>
        <div className="mission-strip">
          <span>MISSION</span>
          <strong>ACQUIRE THE JEWEL OF DOUBT</strong>
          <span>EXTRACT</span>
        </div>
        <div className="connection-block">
          <span className={`pulse ${snapshot?.metrics.inFlight ? "thinking" : ""}`} />
          <div>
            <small>LINK</small>
            <strong>{connectionState}</strong>
          </div>
        </div>
      </header>

      <section className="status-row">
        <div>
          <span>ALERT</span>
          <strong className={`alert-${snapshot?.alert ?? "quiet"}`}>
            {snapshot?.alert ?? "offline"}
          </strong>
        </div>
        <div>
          <span>DISGUISE</span>
          <strong>{inventory?.disguised ? "STAFF" : "NONE"}</strong>
        </div>
        <div>
          <span>BADGE</span>
          <strong>{inventory?.hasBadge ? "SECURITY" : "NONE"}</strong>
        </div>
        <div>
          <span>DECOYS</span>
          <strong>{inventory?.noiseEmitters ?? 0}</strong>
        </div>
        <div>
          <span>ARTIFACT</span>
          <strong>{inventory?.hasArtifact ? "ACQUIRED" : "IN VAULT"}</strong>
        </div>
        <div>
          <span>LOCKDOWN</span>
          <strong>
            {snapshot?.lockdownSeconds ? `${snapshot.lockdownSeconds.toFixed(1)}S` : "INACTIVE"}
          </strong>
        </div>
      </section>

      <div className="workspace">
        <section className="map-panel panel">
          <div className="panel-line">
            <span>MUSEUM / AUTHORITATIVE WORLD STATE</span>
            <span>
              TICK {snapshot?.tick ?? 0} · REV {snapshot?.revision ?? 0}
            </span>
          </div>
          <GameCanvas
            snapshot={snapshot}
            selectedGuardId={selectedGuardId}
            onSelectGuard={setSelectedGuardId}
          />
          <div className="map-legend">
            <span>
              <i className="dot player-dot" /> YOU
            </span>
            <span>
              <i className="dot guard-dot" /> GUARD
            </span>
            <span>
              <i className="dot artifact-dot" /> ARTIFACT
            </span>
            <span>
              <i className="door-swatch" /> RESTRICTED DOOR
            </span>
            <span>CLICK A GUARD TO INSPECT ITS DECISION</span>
          </div>
          {snapshot && snapshot.status !== "playing" ? (
            <div className={`outcome outcome-${snapshot.status}`} data-testid="mission-outcome">
              <div className="panel-kicker">MISSION TERMINATED</div>
              <h2>
                {snapshot.status === "won" ? "CLEAN EXTRACTION" : snapshot.status.toUpperCase()}
              </h2>
              <p>{snapshot.outcomeReason}</p>
              <button type="button" onClick={() => send({ type: "restart" })}>
                RESTART / R
              </button>
            </div>
          ) : null}
        </section>
        <DecisionLens guard={selectedGuard} />
      </div>

      <section className="lower-deck">
        <div className="panel telemetry">
          <div className="panel-kicker">SYSTEM ONE TELEMETRY</div>
          <div className="metric-grid">
            <div>
              <span>MODE</span>
              <strong>{snapshot?.metrics.mode ?? mode}</strong>
            </div>
            <div>
              <span>REQUESTS</span>
              <strong>{snapshot?.metrics.requestCount ?? 0}</strong>
            </div>
            <div>
              <span>QUESTIONS</span>
              <strong>{snapshot?.metrics.questionCount ?? 0}</strong>
            </div>
            <div>
              <span>LAST</span>
              <strong>
                {snapshot?.metrics.lastLatencyMs
                  ? `${snapshot.metrics.lastLatencyMs.toFixed(1)}ms`
                  : "-"}
              </strong>
            </div>
            <div>
              <span>P95</span>
              <strong>
                {snapshot?.metrics.p95LatencyMs
                  ? `${snapshot.metrics.p95LatencyMs.toFixed(1)}ms`
                  : "-"}
              </strong>
            </div>
            <div>
              <span>FALLBACKS</span>
              <strong>{snapshot?.metrics.fallbackCount ?? 0}</strong>
            </div>
            <div>
              <span>INPUT TOKENS</span>
              <strong>{snapshot?.metrics.inputTokens ?? "-"}</strong>
            </div>
            <div>
              <span>COST</span>
              <strong>{snapshot?.metrics.costStatus ?? "unknown"}</strong>
            </div>
          </div>
          <div className="mode-switch">
            <button
              className={mode === "scripted" ? "active" : ""}
              type="button"
              onClick={() => connect("scripted")}
            >
              SCRIPTED
            </button>
            <button
              className={mode === "jev" ? "active" : ""}
              type="button"
              disabled={!config?.liveAvailable}
              title={
                config?.liveAvailable
                  ? "Use the live Jev adapter"
                  : "Set TYPESAFE_API_KEY on the server to enable"
              }
              onClick={() => connect("jev")}
            >
              JEV LIVE
            </button>
          </div>
        </div>
        <div className="panel event-feed">
          <div className="panel-kicker">MATERIAL EVENT LOG</div>
          <ol>
            {[...(snapshot?.events ?? [])]
              .reverse()
              .slice(0, 6)
              .map((event) => (
                <li key={event.id}>
                  <span>{String(event.tick).padStart(5, "0")}</span>
                  <strong>{event.label}</strong>
                </li>
              ))}
          </ol>
        </div>
        <div className="panel controls">
          <div className="panel-kicker">FIELD CONTROLS</div>
          <div className="control-grid">
            <kbd>WASD</kbd>
            <span>MOVE</span>
            <kbd>SHIFT</kbd>
            <span>SPRINT / LOUD</span>
            <kbd>C</kbd>
            <span>CROUCH / QUIET</span>
            <kbd>E</kbd>
            <span>INTERACT</span>
            <kbd>Q</kbd>
            <span>THROW DECOY</span>
          </div>
        </div>
      </section>

      {showBriefing ? (
        <div className="briefing-backdrop">
          <section
            className="briefing"
            role="dialog"
            aria-modal="true"
            aria-labelledby="briefing-title"
          >
            <div className="briefing-code">OPS BRIEF / 001</div>
            <h2 id="briefing-title">
              STEAL THE <em>JEWEL OF DOUBT</em>.
            </h2>
            <p>
              The jacket opens staff access. The badge opens the vault. Cut the vault lights, throw
              decoys, and exploit what each guard believes. The guards' judgment is probabilistic;
              the museum rules are not.
            </p>
            <div className="briefing-route">
              <span>01 / JACKET</span>
              <b>→</b>
              <span>02 / BADGE</span>
              <b>→</b>
              <span>03 / ARTIFACT</span>
              <b>→</b>
              <span>04 / EXIT</span>
            </div>
            <button
              type="button"
              onClick={() => {
                enteredRef.current = true;
                send({ type: "start" });
                setShowBriefing(false);
              }}
            >
              ENTER MUSEUM
            </button>
            <small>
              Default mode uses the deterministic scripted adapter. Live Jev requires a server-side
              key.
            </small>
          </section>
        </div>
      ) : null}
    </main>
  );
}
