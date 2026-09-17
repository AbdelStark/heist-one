import { describe, expect, it } from "vitest";
import {
  applyDecisionResult,
  GameSimulation,
  type InputState,
  MUSEUM_MAP,
  projectDecisionBatch,
  ScriptedDecisionEngine,
} from "../src/index";

const IDLE: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
};

describe("GameSimulation", () => {
  it("reproduces the same checkpoint for the same inputs and actions", () => {
    const first = new GameSimulation("a", "fixed-seed");
    const second = new GameSimulation("b", "fixed-seed");
    for (let tick = 0; tick < 120; tick += 1) {
      const input = { ...IDLE, right: tick < 70, down: tick >= 70 };
      const actions = tick === 30 ? (["throw_noise"] as const) : [];
      first.step(input, actions);
      second.step(input, actions);
    }
    // Session identity is intentionally excluded from the state hash.
    expect(first.checkpointHash()).toBe(second.checkpointHash());
  });

  it("supports the complete disguise, badge, artifact, and extraction route", () => {
    const simulation = new GameSimulation("route");
    const disguise = simulation.state.pickups.find((pickup) => pickup.id === "disguise");
    const badge = simulation.state.pickups.find((pickup) => pickup.id === "badge");
    const artifact = simulation.state.pickups.find((pickup) => pickup.id === "artifact");
    const staffDoor = simulation.state.doors.find((door) => door.id === "staff_door");
    const vaultDoor = simulation.state.doors.find((door) => door.id === "vault_door");
    expect(disguise && badge && artifact && staffDoor && vaultDoor).toBeTruthy();
    if (!disguise || !badge || !artifact || !staffDoor || !vaultDoor) return;

    simulation.state.player.position = { ...disguise.position };
    simulation.step(IDLE, ["interact"]);
    expect(simulation.state.player.disguised).toBe(true);

    simulation.state.player.position = { x: staffDoor.x - 20, y: staffDoor.y + 35 };
    simulation.step(IDLE, ["interact"]);
    expect(staffDoor.open).toBe(true);

    simulation.state.player.position = { ...badge.position };
    simulation.step(IDLE, ["interact"]);
    expect(simulation.state.player.hasBadge).toBe(true);

    simulation.state.player.position = { x: vaultDoor.x - 20, y: vaultDoor.y + 35 };
    simulation.step(IDLE, ["interact"]);
    expect(vaultDoor.open).toBe(true);

    simulation.state.player.position = { ...artifact.position };
    simulation.step(IDLE, ["interact"]);
    expect(simulation.state.player.hasArtifact).toBe(true);

    const exit = MUSEUM_MAP.exits[0];
    expect(exit).toBeDefined();
    if (!exit) return;
    simulation.state.player.position = { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 };
    simulation.step(IDLE);
    expect(simulation.state.status).toBe("won");
  });

  it("records denied access without silently opening a restricted door", () => {
    const simulation = new GameSimulation("denied");
    const vaultDoor = simulation.state.doors.find((door) => door.id === "vault_door");
    expect(vaultDoor).toBeDefined();
    if (!vaultDoor) return;
    simulation.state.player.position = { x: vaultDoor.x - 20, y: vaultDoor.y + 35 };
    simulation.step(IDLE, ["interact"]);
    expect(vaultDoor.open).toBe(false);
    expect(vaultDoor.deniedAtTick).not.toBeNull();
    expect(simulation.state.materialEvents.at(-1)?.kind).toBe("door_denied");
  });

  it("batches decisions and applies a scripted judgment through policy", async () => {
    const simulation = new GameSimulation("decisions");
    simulation.state.player.position = { x: 500, y: 90 };
    simulation.state.player.currentZoneId = "staff";
    const guard = simulation.state.guards.find((candidate) => candidate.id === "guard_03");
    expect(guard).toBeDefined();
    if (!guard) return;
    guard.position = { x: 470, y: 85 };

    const input = projectDecisionBatch(simulation.state, "epoch_test");
    expect(input.guards).toHaveLength(6);
    const controller = new AbortController();
    const result = await new ScriptedDecisionEngine(0).decide(input, { signal: controller.signal });
    const applied = applyDecisionResult(simulation.state, input, result);

    expect(applied.every((entry) => entry.accepted)).toBe(true);
    expect(
      guard.decision?.observations.some((observation) => observation.kind === "restricted_person"),
    ).toBe(true);
    expect(["challenge", "pursue"]).toContain(guard.intent);
    expect(guard.targetId).toBe("player");
  });

  it("rejects a stale batch and uses a marked fallback", async () => {
    const simulation = new GameSimulation("stale");
    const input = projectDecisionBatch(simulation.state, "epoch_stale");
    const result = await new ScriptedDecisionEngine(0).decide(input, {
      signal: new AbortController().signal,
    });
    simulation.state.revision += 1;
    const applied = applyDecisionResult(simulation.state, input, result);
    expect(applied.every((entry) => !entry.accepted)).toBe(true);
    expect(simulation.state.guards.every((guard) => guard.decision?.source === "fallback")).toBe(
      true,
    );
  });
});
