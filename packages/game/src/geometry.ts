import { MUSEUM_MAP } from "./map";
import type { DoorState, Rect, Vec2, Wall } from "./types";

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const pointInRect = (point: Vec2, rect: Rect): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const circleIntersectsRect = (position: Vec2, radius: number, rect: Rect): boolean => {
  const nearestX = clamp(position.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(position.y, rect.y, rect.y + rect.height);
  const dx = position.x - nearestX;
  const dy = position.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
};

export const collides = (
  position: Vec2,
  radius: number,
  walls: readonly Wall[],
  doors: readonly DoorState[],
  includeClosedDoors: boolean,
): boolean => {
  if (
    position.x - radius < 0 ||
    position.x + radius > MUSEUM_MAP.width ||
    position.y - radius < 0 ||
    position.y + radius > MUSEUM_MAP.height
  ) {
    return true;
  }
  if (walls.some((wall) => circleIntersectsRect(position, radius, wall))) return true;
  return (
    includeClosedDoors &&
    doors.some((door) => !door.open && circleIntersectsRect(position, radius, door))
  );
};

export const moveWithCollision = (
  position: Vec2,
  delta: Vec2,
  radius: number,
  doors: readonly DoorState[],
  includeClosedDoors: boolean,
): Vec2 => {
  const full = { x: position.x + delta.x, y: position.y + delta.y };
  if (!collides(full, radius, MUSEUM_MAP.walls, doors, includeClosedDoors)) return full;

  const xOnly = { x: position.x + delta.x, y: position.y };
  if (!collides(xOnly, radius, MUSEUM_MAP.walls, doors, includeClosedDoors)) return xOnly;

  const yOnly = { x: position.x, y: position.y + delta.y };
  if (!collides(yOnly, radius, MUSEUM_MAP.walls, doors, includeClosedDoors)) return yOnly;

  return position;
};

export const lineOfSight = (from: Vec2, to: Vec2, doors: readonly DoorState[]): boolean => {
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / 8));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    if (MUSEUM_MAP.walls.some((wall) => pointInRect(point, wall))) return false;
    if (doors.some((door) => !door.open && pointInRect(point, door))) return false;
  }
  return true;
};

export const normalize = (vector: Vec2): Vec2 => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
};

export const nearestPoint = <T extends { position: Vec2 }>(
  origin: Vec2,
  candidates: readonly T[],
  maxDistance: number,
): T | null => {
  let best: T | null = null;
  let bestDistance = maxDistance;
  for (const candidate of candidates) {
    const candidateDistance = distance(origin, candidate.position);
    if (candidateDistance < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }
  return best;
};

export const rectCenter = (rect: Rect): Vec2 => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});
