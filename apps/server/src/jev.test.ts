import { GameSimulation, projectDecisionBatch } from "@heist-one/game";
import { describe, expect, it } from "vitest";
import { compileJevRequest } from "./jev";

describe("compileJevRequest", () => {
  it("creates four complete questions per guard in one shared-state request", () => {
    const simulation = new GameSimulation("compile");
    const input = projectDecisionBatch(simulation.state, "epoch_compile");
    const request = compileJevRequest(input);

    expect(Object.keys(request.questions)).toHaveLength(24);
    expect(request.questions.guard_01__threat?.type).toBe("noul");
    expect(request.questions.guard_01__suspicion?.type).toBe("score");
    expect(request.questions.guard_01__intent?.type).toBe("choice");
    expect(request.questions.guard_01__attention?.type).toBe("choice");
    expect(String(request.questions.guard_01__threat?.instructions)).toContain(
      "guard_contexts.guard_01",
    );
  });
});
