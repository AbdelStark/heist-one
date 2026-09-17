import type { ClientSnapshot, GuardState, Vec2 } from "@heist-one/game";
import Phaser from "phaser";
import { useEffect, useRef } from "react";

const GUARD_COLORS: Record<GuardState["suspicionBand"], number> = {
  relaxed: 0x8ba3a0,
  attentive: 0xd7e878,
  suspicious: 0xffb547,
  high_alert: 0xff6b4a,
  certain_threat: 0xff3158,
};

class HeistScene extends Phaser.Scene {
  #snapshot: ClientSnapshot | null = null;
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #labels: Phaser.GameObjects.Text[] = [];
  #guardLabels = new Map<string, Phaser.GameObjects.Text>();
  #selectedGuardId: string | null = null;
  #onSelect: (guardId: string) => void;

  constructor(onSelect: (guardId: string) => void) {
    super("heist");
    this.#onSelect = onSelect;
  }

  create(): void {
    this.#graphics = this.add.graphics();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const snapshot = this.#snapshot;
      if (!snapshot) return;
      const guard = [...snapshot.guards].sort(
        (left, right) =>
          Phaser.Math.Distance.Between(
            pointer.worldX,
            pointer.worldY,
            left.position.x,
            left.position.y,
          ) -
          Phaser.Math.Distance.Between(
            pointer.worldX,
            pointer.worldY,
            right.position.x,
            right.position.y,
          ),
      )[0];
      if (!guard) return;
      const hitDistance = Phaser.Math.Distance.Between(
        pointer.worldX,
        pointer.worldY,
        guard.position.x,
        guard.position.y,
      );
      if (hitDistance <= 28) this.#onSelect(guard.id);
    });
  }

  setSnapshot(snapshot: ClientSnapshot): void {
    const first = this.#snapshot === null;
    this.#snapshot = snapshot;
    if (first) this.#createStaticLabels(snapshot);
    this.#draw();
  }

  setSelectedGuard(guardId: string | null): void {
    this.#selectedGuardId = guardId;
    this.#draw();
  }

  #createStaticLabels(snapshot: ClientSnapshot): void {
    for (const label of this.#labels) label.destroy();
    this.#labels = snapshot.map.zones.map((zone) =>
      this.add
        .text(zone.x + 14, zone.y + 12, zone.label, {
          color: "#61706d",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "12px",
          letterSpacing: 2,
        })
        .setDepth(2),
    );
  }

  #draw(): void {
    const snapshot = this.#snapshot;
    const graphics = this.#graphics;
    if (!snapshot || !graphics) return;
    graphics.clear();

    graphics.fillStyle(0x090b0b, 1).fillRect(0, 0, snapshot.map.width, snapshot.map.height);
    for (const zone of snapshot.map.zones) {
      const light = snapshot.lights.find((candidate) => candidate.id === zone.lightId)?.on ?? true;
      graphics
        .fillStyle(zone.color, light ? 1 : 0.32)
        .fillRect(zone.x, zone.y, zone.width, zone.height);
      graphics
        .lineStyle(1, light ? 0x33423f : 0x171b1a, 1)
        .strokeRect(zone.x, zone.y, zone.width, zone.height);
    }

    graphics.fillStyle(0x3a4543, 1);
    for (const wall of snapshot.map.walls)
      graphics.fillRect(wall.x, wall.y, wall.width, wall.height);

    for (const exit of snapshot.map.exits) {
      graphics.fillStyle(0xc8ff2e, 0.22).fillRect(exit.x, exit.y, exit.width, exit.height);
      graphics.lineStyle(2, 0xc8ff2e, 0.8).strokeRect(exit.x, exit.y, exit.width, exit.height);
    }

    for (const door of snapshot.doors) {
      graphics.fillStyle(
        door.open ? 0x4f665f : door.access === "secured" ? 0xff3158 : 0xffb547,
        door.open ? 0.35 : 0.9,
      );
      graphics.fillRect(door.x, door.y, door.width, door.height);
    }

    for (const pickup of snapshot.pickups) {
      if (!pickup.available) continue;
      const color =
        pickup.id === "artifact" ? 0xc8ff2e : pickup.id === "badge" ? 0x47caff : 0xd8d3c5;
      graphics
        .fillStyle(color, 0.95)
        .fillCircle(pickup.position.x, pickup.position.y, pickup.id === "artifact" ? 10 : 7);
      graphics.lineStyle(1, color, 0.35).strokeCircle(pickup.position.x, pickup.position.y, 15);
    }

    graphics
      .fillStyle(0xffb547, 0.9)
      .fillRect(snapshot.breaker.position.x - 6, snapshot.breaker.position.y - 9, 12, 18);
    for (const sound of snapshot.sounds) {
      const age = Math.max(0, snapshot.tick - sound.createdAtTick);
      const radius = 14 + (age % 40) * 1.4;
      graphics
        .lineStyle(2, 0x47caff, Math.max(0.1, 0.65 - age / 250))
        .strokeCircle(sound.position.x, sound.position.y, radius);
    }

    for (const guard of snapshot.guards) {
      const color = GUARD_COLORS[guard.suspicionBand];
      const target =
        guard.targetPosition ?? (guard.targetId === "player" ? snapshot.player.position : null);
      if (target) {
        graphics
          .lineStyle(1, color, 0.3)
          .lineBetween(guard.position.x, guard.position.y, target.x, target.y);
      }
      const facingAngle = Math.atan2(guard.facing.y, guard.facing.x);
      graphics
        .fillStyle(color, 0.13)
        .slice(
          guard.position.x,
          guard.position.y,
          guard.suspicionBand === "relaxed" ? 80 : 120,
          facingAngle - 0.34,
          facingAngle + 0.34,
          false,
        );
      graphics.fillPath();
      graphics.fillStyle(color, 1).fillCircle(guard.position.x, guard.position.y, 12);
      graphics.fillStyle(0x090b0b, 1).fillCircle(guard.position.x, guard.position.y, 5);
      if (this.#selectedGuardId === guard.id) {
        graphics.lineStyle(3, 0xc8ff2e, 1).strokeCircle(guard.position.x, guard.position.y, 19);
      }
      let label = this.#guardLabels.get(guard.id);
      if (!label) {
        label = this.add.text(0, 0, guard.label, {
          color: "#d8d3c5",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "10px",
          backgroundColor: "#090b0bcc",
          padding: { x: 3, y: 1 },
        });
        this.#guardLabels.set(guard.id, label);
      }
      label
        .setPosition(guard.position.x + 16, guard.position.y - 18)
        .setText(`${guard.label} / ${guard.intent.replaceAll("_", " ")}`);
    }

    const player = snapshot.player;
    const playerColor = player.hasArtifact ? 0xc8ff2e : player.disguised ? 0xd8d3c5 : 0x47caff;
    graphics.fillStyle(playerColor, 1);
    graphics.fillTriangle(
      player.position.x + player.facing.x * 16,
      player.position.y + player.facing.y * 16,
      player.position.x - player.facing.y * 10 - player.facing.x * 7,
      player.position.y + player.facing.x * 10 - player.facing.y * 7,
      player.position.x + player.facing.y * 10 - player.facing.x * 7,
      player.position.y - player.facing.x * 10 - player.facing.y * 7,
    );
    graphics.lineStyle(2, playerColor, 0.35).strokeCircle(player.position.x, player.position.y, 20);
  }
}

export function GameCanvas(props: {
  snapshot: ClientSnapshot | null;
  selectedGuardId: string | null;
  onSelectGuard: (guardId: string) => void;
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeistScene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new HeistScene(props.onSelectGuard);
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 1200,
      height: 720,
      parent: containerRef.current,
      backgroundColor: "#090b0b",
      render: { antialias: true, pixelArt: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    });
    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [props.onSelectGuard]);

  useEffect(() => {
    if (props.snapshot && sceneRef.current?.scene.isActive())
      sceneRef.current.setSnapshot(props.snapshot);
  }, [props.snapshot]);

  useEffect(() => {
    sceneRef.current?.setSelectedGuard(props.selectedGuardId);
  }, [props.selectedGuardId]);

  return (
    <div
      className="game-canvas"
      ref={containerRef}
      role="application"
      aria-label="Interactive museum floor plan"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard focus belongs on the interactive Phaser canvas wrapper.
      tabIndex={0}
    />
  );
}

export const directionLabel = (vector: Vec2): string => {
  if (Math.abs(vector.x) > Math.abs(vector.y)) return vector.x > 0 ? "east" : "west";
  return vector.y > 0 ? "south" : "north";
};
