import {
  circleIntersectsRect,
  distance,
  moveWithCollision,
  nearestPoint,
  normalize,
  pointInRect,
  rectCenter,
} from "./geometry";
import {
  initialBreaker,
  initialDoors,
  initialGuards,
  initialLights,
  initialPickups,
  MUSEUM_MAP,
  PLAYER_RADIUS,
  TICK_MS,
} from "./map";
import type {
  ClientSnapshot,
  GameEvent,
  GuardState,
  InputState,
  PlayerAction,
  SessionMetrics,
  Vec2,
  WorldState,
} from "./types";

const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
};

const zoneAt = (position: Vec2): string =>
  MUSEUM_MAP.zones.find((zone) => pointInRect(position, zone))?.id ?? "threshold";

const clone = <T>(value: T): T => structuredClone(value);

export class GameSimulation {
  readonly state: WorldState;
  #eventCounter = 0;

  constructor(sessionId: string, seed = "heist-one-v0") {
    this.state = {
      sessionId,
      tick: 0,
      revision: 0,
      seed,
      status: "playing",
      outcomeReason: null,
      alert: "quiet",
      lockdownTicksRemaining: null,
      player: {
        id: "player",
        position: { x: 62, y: 360 },
        facing: { x: 1, y: 0 },
        radius: PLAYER_RADIUS,
        disguised: false,
        hasBadge: false,
        hasArtifact: false,
        noiseEmitters: 3,
        stance: "walk",
        currentZoneId: "gallery",
      },
      guards: initialGuards(),
      doors: initialDoors(),
      lights: initialLights(),
      pickups: initialPickups(),
      breaker: initialBreaker(),
      sounds: [],
      materialEvents: [],
    };
  }

  step(input: InputState = EMPTY_INPUT, actions: readonly PlayerAction[] = []): void {
    if (this.state.status !== "playing") return;
    this.state.tick += 1;
    this.#movePlayer(input);
    for (const action of actions) this.#applyAction(action);
    this.#expireSounds();
    this.#moveGuards();
    this.#checkCapture();
    this.#checkExits();
    this.#tickLockdown();
  }

  snapshot(metrics: SessionMetrics): ClientSnapshot {
    return {
      sessionId: this.state.sessionId,
      tick: this.state.tick,
      revision: this.state.revision,
      status: this.state.status,
      outcomeReason: this.state.outcomeReason,
      alert: this.state.alert,
      lockdownSeconds:
        this.state.lockdownTicksRemaining === null
          ? null
          : Math.max(0, this.state.lockdownTicksRemaining / 30),
      player: clone(this.state.player),
      guards: clone(this.state.guards),
      doors: clone(this.state.doors),
      lights: clone(this.state.lights),
      pickups: clone(this.state.pickups),
      breaker: clone(this.state.breaker),
      sounds: clone(this.state.sounds),
      events: clone(this.state.materialEvents.slice(-12)),
      map: MUSEUM_MAP,
      metrics: clone(metrics),
    };
  }

  checkpointHash(): string {
    const source = JSON.stringify({
      tick: this.state.tick,
      revision: this.state.revision,
      status: this.state.status,
      alert: this.state.alert,
      player: this.state.player,
      guards: this.state.guards.map((guard) => ({
        id: guard.id,
        position: guard.position,
        facing: guard.facing,
        intent: guard.intent,
        patrolIndex: guard.patrolIndex,
      })),
      doors: this.state.doors.map((door) => ({ id: door.id, open: door.open })),
      pickups: this.state.pickups.map((pickup) => ({ id: pickup.id, available: pickup.available })),
      lights: this.state.lights,
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  #record(kind: GameEvent["kind"], label: string, position?: Vec2): void {
    this.state.revision += 1;
    for (const guard of this.state.guards) guard.contextRevision += 1;
    const event: GameEvent = {
      id: `e${++this.#eventCounter}`,
      tick: this.state.tick,
      kind,
      label,
      ...(position ? { position: { ...position } } : {}),
    };
    this.state.materialEvents.push(event);
    this.state.materialEvents = this.state.materialEvents.slice(-40);
  }

  #movePlayer(input: InputState): void {
    const raw = {
      x: Number(input.right) - Number(input.left),
      y: Number(input.down) - Number(input.up),
    };
    const direction = normalize(raw);
    if (direction.x !== 0 || direction.y !== 0) this.state.player.facing = direction;
    this.state.player.stance = input.crouch ? "crouch" : input.sprint ? "sprint" : "walk";
    const speed = input.crouch ? 80 : input.sprint ? 190 : 128;
    const delta = {
      x: direction.x * speed * (TICK_MS / 1000),
      y: direction.y * speed * (TICK_MS / 1000),
    };
    this.state.player.position = moveWithCollision(
      this.state.player.position,
      delta,
      this.state.player.radius,
      this.state.doors,
      true,
    );
    this.state.player.currentZoneId = zoneAt(this.state.player.position);

    if (
      this.state.player.stance === "sprint" &&
      (direction.x !== 0 || direction.y !== 0) &&
      this.state.tick % 36 === 0
    ) {
      this.#createSound(this.state.player.position, "sprint", 75);
    }
  }

  #applyAction(action: PlayerAction): void {
    if (action === "throw_noise") {
      if (this.state.player.noiseEmitters <= 0) return;
      this.state.player.noiseEmitters -= 1;
      const target = {
        x: this.state.player.position.x + this.state.player.facing.x * 135,
        y: this.state.player.position.y + this.state.player.facing.y * 135,
      };
      const placed = moveWithCollision(
        this.state.player.position,
        { x: target.x - this.state.player.position.x, y: target.y - this.state.player.position.y },
        5,
        this.state.doors,
        true,
      );
      this.#createSound(placed, "noise_emitter", 165);
      return;
    }
    this.#interact();
  }

  #interact(): void {
    const player = this.state.player;
    const pickups = this.state.pickups
      .filter((pickup) => pickup.available)
      .map((pickup) => ({ ...pickup, position: pickup.position }));
    const pickup = nearestPoint(player.position, pickups, 42);
    if (pickup) {
      const stored = this.state.pickups.find((candidate) => candidate.id === pickup.id);
      if (!stored) return;
      stored.available = false;
      if (stored.id === "disguise") player.disguised = true;
      if (stored.id === "badge") player.hasBadge = true;
      if (stored.id === "artifact") {
        player.hasArtifact = true;
        if (this.state.alert === "quiet") this.state.alert = "suspicious";
        this.#record("artifact_removed", "THE JEWEL OF DOUBT HAS LEFT THE PLINTH", stored.position);
      } else {
        this.#record("pickup", `${stored.label} ACQUIRED`, stored.position);
      }
      return;
    }

    if (distance(player.position, this.state.breaker.position) < 44) {
      const light = this.state.lights.find(
        (candidate) => candidate.id === this.state.breaker.lightId,
      );
      if (!light) return;
      light.on = !light.on;
      this.#record(
        "lights_changed",
        `${light.label.toUpperCase()} LIGHTS ${light.on ? "RESTORED" : "CUT"}`,
        this.state.breaker.position,
      );
      return;
    }

    const door = nearestPoint(
      player.position,
      this.state.doors.map((candidate) => ({ ...candidate, position: rectCenter(candidate) })),
      50,
    );
    if (!door) return;
    const storedDoor = this.state.doors.find((candidate) => candidate.id === door.id);
    if (!storedDoor) return;
    if (storedDoor.open) return;

    const authorized =
      storedDoor.access === "public" ||
      (storedDoor.access === "staff" && (player.disguised || player.hasBadge)) ||
      (storedDoor.access === "secured" && player.hasBadge);
    if (authorized) {
      storedDoor.open = true;
      this.#record("door_opened", `${storedDoor.label} OPEN`, rectCenter(storedDoor));
    } else {
      storedDoor.deniedAtTick = this.state.tick;
      storedDoor.deniedAt = { ...player.position };
      this.#record("door_denied", `${storedDoor.label} DENIED`, player.position);
    }
  }

  #createSound(position: Vec2, kind: "noise_emitter" | "sprint", lifetimeTicks: number): void {
    const sound = {
      id: `sound:${this.state.tick}:${this.state.sounds.length}`,
      position: { ...position },
      createdAtTick: this.state.tick,
      expiresAtTick: this.state.tick + lifetimeTicks,
      kind,
    } as const;
    this.state.sounds.push(sound);
    this.#record(
      "sound_created",
      kind === "noise_emitter" ? "DECOY CHIRP" : "RUNNING HEARD",
      position,
    );
  }

  #expireSounds(): void {
    this.state.sounds = this.state.sounds.filter((sound) => sound.expiresAtTick > this.state.tick);
  }

  #moveGuards(): void {
    for (const guard of this.state.guards) {
      const target = this.#guardTarget(guard);
      if (!target) continue;
      const offset = { x: target.x - guard.position.x, y: target.y - guard.position.y };
      const targetDistance = Math.hypot(offset.x, offset.y);
      if (targetDistance < 8) {
        if (guard.intent === "continue_patrol") {
          guard.patrolIndex = (guard.patrolIndex + 1) % guard.patrol.length;
        } else if (guard.intent === "investigate") {
          guard.intent = "hold_and_observe";
        }
        continue;
      }
      const direction = normalize(offset);
      guard.facing = direction;
      const intentMultiplier =
        guard.intent === "pursue" ? 1.45 : guard.intent === "challenge" ? 1.12 : 1;
      guard.position = moveWithCollision(
        guard.position,
        {
          x: direction.x * guard.speed * intentMultiplier * (TICK_MS / 1000),
          y: direction.y * guard.speed * intentMultiplier * (TICK_MS / 1000),
        },
        guard.radius,
        this.state.doors,
        false,
      );
      for (const door of this.state.doors) {
        if (!door.open && distance(guard.position, rectCenter(door)) < 30) door.open = true;
      }
    }
  }

  #guardTarget(guard: GuardState): Vec2 | null {
    let destination: Vec2 | null = null;
    if (guard.intent === "continue_patrol") destination = guard.patrol[guard.patrolIndex] ?? null;
    else if (["pursue", "challenge"].includes(guard.intent) && guard.targetId === "player") {
      destination = this.state.player.position;
    } else if (guard.intent === "protect_artifact") {
      destination = this.state.pickups.find((pickup) => pickup.id === "artifact")?.position ?? null;
    } else if (guard.intent === "seek_help") {
      const peer = this.state.guards
        .filter((candidate) => candidate.id !== guard.id)
        .sort(
          (left, right) =>
            distance(guard.position, left.position) - distance(guard.position, right.position),
        )[0];
      destination = peer?.position ?? null;
    } else if (guard.intent === "investigate") destination = guard.targetPosition;

    if (!destination) return null;
    const fromZone = zoneAt(guard.position);
    const toZone = zoneAt(destination);
    if (fromZone === toZone || fromZone === "threshold" || toZone === "threshold")
      return destination;

    const gateway = {
      gallery: { x: 400, y: 315 },
      staff: { x: 635, y: 360 },
      security: { x: 635, y: 360 },
      artifact: { x: 820, y: 335 },
    } satisfies Record<string, Vec2>;
    if (fromZone === "gallery" || toZone === "gallery") return gateway.gallery;
    if (fromZone === "security" || toZone === "security") return gateway.security;
    if (fromZone === "artifact" || toZone === "artifact") return gateway.artifact;
    return destination;
  }

  #checkCapture(): void {
    for (const guard of this.state.guards) {
      if (guard.intent !== "pursue") continue;
      if (
        distance(guard.position, this.state.player.position) >
        guard.radius + this.state.player.radius + 5
      )
        continue;
      this.state.status = "captured";
      this.state.outcomeReason = `${guard.label} intercepted you.`;
      this.#record("mission_outcome", `CAPTURED BY ${guard.label}`, this.state.player.position);
      return;
    }
  }

  #checkExits(): void {
    if (!this.state.player.hasArtifact) return;
    const exit = MUSEUM_MAP.exits.find((candidate) =>
      circleIntersectsRect(this.state.player.position, this.state.player.radius, candidate),
    );
    if (!exit) return;
    this.state.status = "won";
    this.state.outcomeReason = `Artifact extracted through ${exit.label}.`;
    this.#record("mission_outcome", "ARTIFACT EXTRACTED", this.state.player.position);
  }

  #tickLockdown(): void {
    if (this.state.lockdownTicksRemaining === null || this.state.status !== "playing") return;
    this.state.lockdownTicksRemaining -= 1;
    if (this.state.lockdownTicksRemaining > 0) return;
    this.state.lockdownTicksRemaining = 0;
    this.state.status = "lockdown";
    this.state.outcomeReason = "The museum completed its lockdown sequence.";
    this.#record("mission_outcome", "LOCKDOWN COMPLETE");
  }
}
