import type { Page } from "@playwright/test";

interface ObservedSnapshot {
  status: "playing" | "won" | "captured" | "lockdown";
  player: {
    position: { x: number; y: number };
    disguised: boolean;
    hasBadge: boolean;
    hasArtifact: boolean;
  };
  doors: Array<{ id: string; open: boolean }>;
}

export type SnapshotReader = () => ObservedSnapshot | null;

export const trackGameSnapshots = (page: Page): SnapshotReader => {
  let latest: ObservedSnapshot | null = null;
  page.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => {
      try {
        const message = JSON.parse(String(frame.payload)) as {
          type?: string;
          snapshot?: ObservedSnapshot;
        };
        if (message.type === "snapshot" && message.snapshot) latest = message.snapshot;
      } catch {
        // Ignore non-JSON frames. The game protocol itself is JSON-only.
      }
    });
  });
  return () => latest;
};

const waitForState = async (
  page: Page,
  readSnapshot: SnapshotReader,
  description: string,
  predicate: (snapshot: ObservedSnapshot) => boolean,
  timeoutMs = 5_000,
): Promise<ObservedSnapshot> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = readSnapshot();
    if (snapshot && predicate(snapshot)) return snapshot;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for ${description}.`);
};

const moveAxisTo = async (
  page: Page,
  readSnapshot: SnapshotReader,
  axis: "x" | "y",
  target: number,
  tolerance = 9,
): Promise<void> => {
  const positiveKey = axis === "x" ? "KeyD" : "KeyS";
  const negativeKey = axis === "x" ? "KeyA" : "KeyW";
  const deadline = Date.now() + 8_000;
  let activeKey: string | null = null;

  try {
    while (Date.now() < deadline) {
      const snapshot = readSnapshot();
      if (!snapshot) {
        await page.waitForTimeout(50);
        continue;
      }
      if (snapshot.status !== "playing") return;
      const delta = target - snapshot.player.position[axis];
      if (Math.abs(delta) <= tolerance) return;
      const nextKey = delta > 0 ? positiveKey : negativeKey;
      if (activeKey !== nextKey) {
        if (activeKey) await page.keyboard.up(activeKey);
        await page.keyboard.down(nextKey);
        activeKey = nextKey;
      }
      await page.waitForTimeout(40);
    }
  } finally {
    if (activeKey) await page.keyboard.up(activeKey);
    await page.waitForTimeout(120);
  }

  const lastPosition = readSnapshot()?.player.position[axis];
  throw new Error(
    `Timed out moving ${axis} to ${target}; last observed ${axis} was ${String(lastPosition)}.`,
  );
};

const interactUntil = async (
  page: Page,
  readSnapshot: SnapshotReader,
  description: string,
  predicate: (snapshot: ObservedSnapshot) => boolean,
): Promise<void> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press("KeyE");
    try {
      await waitForState(page, readSnapshot, description, predicate, 750);
      return;
    } catch {
      if (attempt === 2) throw new Error(`Interaction did not produce ${description}.`);
    }
  }
};

export const driveSuccessfulHeist = async (
  page: Page,
  readSnapshot: SnapshotReader,
): Promise<void> => {
  await waitForState(
    page,
    readSnapshot,
    "the first playing snapshot",
    (state) => state.status === "playing",
  );

  await moveAxisTo(page, readSnapshot, "x", 322);
  await moveAxisTo(page, readSnapshot, "y", 108);
  await interactUntil(page, readSnapshot, "staff jacket pickup", (state) => state.player.disguised);

  await moveAxisTo(page, readSnapshot, "y", 320);
  await moveAxisTo(page, readSnapshot, "x", 370);
  await interactUntil(page, readSnapshot, "staff door opening", (state) =>
    state.doors.some((door) => door.id === "staff_door" && door.open),
  );
  await moveAxisTo(page, readSnapshot, "x", 635);
  await interactUntil(page, readSnapshot, "security lobby door opening", (state) =>
    state.doors.some((door) => door.id === "public_door" && door.open),
  );
  await moveAxisTo(page, readSnapshot, "y", 400);
  await moveAxisTo(page, readSnapshot, "x", 705);
  await moveAxisTo(page, readSnapshot, "y", 575);
  await moveAxisTo(page, readSnapshot, "x", 590);
  await interactUntil(
    page,
    readSnapshot,
    "security badge pickup",
    (state) => state.player.hasBadge,
  );

  await moveAxisTo(page, readSnapshot, "x", 705);
  await moveAxisTo(page, readSnapshot, "y", 390);
  await moveAxisTo(page, readSnapshot, "x", 635);
  await moveAxisTo(page, readSnapshot, "y", 320);
  await moveAxisTo(page, readSnapshot, "x", 790);
  await interactUntil(page, readSnapshot, "vault door opening", (state) =>
    state.doors.some((door) => door.id === "vault_door" && door.open),
  );
  await moveAxisTo(page, readSnapshot, "y", 330);
  await moveAxisTo(page, readSnapshot, "x", 870);
  // Stay clear of the plinth's collision radius before crossing to its north side.
  await moveAxisTo(page, readSnapshot, "y", 286);
  await moveAxisTo(page, readSnapshot, "x", 1042);
  await interactUntil(page, readSnapshot, "artifact pickup", (state) => state.player.hasArtifact);

  await moveAxisTo(page, readSnapshot, "x", 1160);
  await moveAxisTo(page, readSnapshot, "y", 430);
  await moveAxisTo(page, readSnapshot, "x", 1110);
  await moveAxisTo(page, readSnapshot, "y", 690);
  await waitForState(page, readSnapshot, "clean extraction", (state) => state.status === "won");
};
