import type {
  BreakerState,
  DoorState,
  GuardState,
  LightZoneState,
  MuseumMap,
  PickupState,
  Vec2,
} from "./types";

export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 13;

export const MUSEUM_MAP: MuseumMap = {
  width: 1200,
  height: 720,
  zones: [
    {
      id: "gallery",
      label: "PUBLIC GALLERY",
      access: "public",
      lightId: "gallery_lights",
      color: 0x172126,
      x: 20,
      y: 20,
      width: 370,
      height: 680,
    },
    {
      id: "staff",
      label: "STAFF WING",
      access: "staff",
      lightId: "staff_lights",
      color: 0x1c2422,
      x: 400,
      y: 20,
      width: 410,
      height: 330,
    },
    {
      id: "security",
      label: "SECURITY",
      access: "staff",
      lightId: "security_lights",
      color: 0x202027,
      x: 400,
      y: 370,
      width: 410,
      height: 330,
    },
    {
      id: "artifact",
      label: "ARTIFACT VAULT",
      access: "secured",
      lightId: "vault_lights",
      color: 0x251e1e,
      x: 820,
      y: 20,
      width: 360,
      height: 680,
    },
  ],
  walls: [
    { id: "north", x: 0, y: 0, width: 1200, height: 20 },
    { id: "south_a", x: 0, y: 700, width: 1040, height: 20 },
    { id: "south_b", x: 1130, y: 700, width: 70, height: 20 },
    { id: "west_a", x: 0, y: 0, width: 20, height: 310 },
    { id: "west_b", x: 0, y: 410, width: 20, height: 310 },
    { id: "east", x: 1180, y: 0, width: 20, height: 720 },
    { id: "staff_wall_a", x: 390, y: 20, width: 20, height: 260 },
    { id: "staff_wall_b", x: 390, y: 350, width: 20, height: 350 },
    { id: "vault_wall_a", x: 810, y: 20, width: 20, height: 280 },
    { id: "vault_wall_b", x: 810, y: 370, width: 20, height: 330 },
    { id: "security_wall_a", x: 410, y: 350, width: 190, height: 20 },
    { id: "security_wall_b", x: 670, y: 350, width: 140, height: 20 },
    { id: "gallery_plinth", x: 145, y: 165, width: 100, height: 60 },
    { id: "gallery_bench", x: 145, y: 495, width: 110, height: 40 },
    { id: "staff_desk", x: 540, y: 140, width: 120, height: 50 },
    { id: "security_console", x: 525, y: 495, width: 140, height: 55 },
    { id: "vault_plinth", x: 995, y: 315, width: 95, height: 90 },
  ],
  exits: [
    { id: "west_exit", label: "WEST EXIT", x: 0, y: 310, width: 28, height: 100 },
    { id: "south_exit", label: "SERVICE EXIT", x: 1040, y: 692, width: 90, height: 28 },
  ],
};

export const initialDoors = (): DoorState[] => [
  {
    id: "staff_door",
    label: "STAFF ACCESS",
    access: "staff",
    open: false,
    deniedAtTick: null,
    deniedAt: null,
    x: 390,
    y: 280,
    width: 20,
    height: 70,
  },
  {
    id: "public_door",
    label: "SECURITY LOBBY",
    access: "public",
    open: false,
    deniedAtTick: null,
    deniedAt: null,
    x: 600,
    y: 350,
    width: 70,
    height: 20,
  },
  {
    id: "vault_door",
    label: "VAULT ACCESS",
    access: "secured",
    open: false,
    deniedAtTick: null,
    deniedAt: null,
    x: 810,
    y: 300,
    width: 20,
    height: 70,
  },
];

export const initialLights = (): LightZoneState[] => [
  { id: "gallery_lights", label: "Gallery", on: true },
  { id: "staff_lights", label: "Staff wing", on: true },
  { id: "security_lights", label: "Security", on: true },
  { id: "vault_lights", label: "Vault", on: true },
];

export const initialPickups = (): PickupState[] => [
  { id: "disguise", label: "STAFF JACKET", position: { x: 322, y: 108 }, available: true },
  { id: "badge", label: "SECURITY BADGE", position: { x: 590, y: 575 }, available: true },
  { id: "artifact", label: "JEWEL OF DOUBT", position: { x: 1042, y: 296 }, available: true },
];

export const initialBreaker = (): BreakerState => ({
  id: "staff_breaker",
  position: { x: 742, y: 92 },
  lightId: "vault_lights",
});

const guard = (
  id: string,
  label: string,
  role: GuardState["role"],
  profile: GuardState["profile"],
  position: Vec2,
  patrol: Vec2[],
): GuardState => ({
  id,
  label,
  role,
  profile,
  position: { ...position },
  facing: { x: 1, y: 0 },
  radius: GUARD_RADIUS,
  patrol,
  patrolIndex: 0,
  intent: "continue_patrol",
  targetId: null,
  targetPosition: null,
  path: [],
  pathIndex: 0,
  speed: profile === "assertive" ? 92 : profile === "cautious" ? 76 : 84,
  suspicionBand: "relaxed",
  contextRevision: 0,
  decision: null,
});

export const initialGuards = (): GuardState[] => [
  guard("guard_01", "MARA", "patrol", "methodical", { x: 92, y: 112 }, [
    { x: 92, y: 112 },
    { x: 315, y: 112 },
    { x: 315, y: 286 },
    { x: 90, y: 286 },
  ]),
  guard("guard_02", "IVO", "patrol", "cautious", { x: 92, y: 610 }, [
    { x: 92, y: 610 },
    { x: 320, y: 610 },
    { x: 320, y: 430 },
    { x: 88, y: 430 },
  ]),
  guard("guard_03", "SERA", "patrol", "assertive", { x: 470, y: 85 }, [
    { x: 470, y: 85 },
    { x: 760, y: 85 },
    { x: 760, y: 280 },
    { x: 460, y: 280 },
  ]),
  guard("guard_04", "NOAH", "security_room", "methodical", { x: 470, y: 435 }, [
    { x: 470, y: 435 },
    { x: 750, y: 435 },
    { x: 750, y: 625 },
    { x: 470, y: 625 },
  ]),
  guard("guard_05", "VEGA", "artifact_guard", "cautious", { x: 910, y: 160 }, [
    { x: 910, y: 160 },
    { x: 1090, y: 160 },
    { x: 1090, y: 555 },
    { x: 910, y: 555 },
  ]),
  guard("guard_06", "KELL", "artifact_guard", "assertive", { x: 1090, y: 560 }, [
    { x: 1090, y: 560 },
    { x: 905, y: 560 },
    { x: 905, y: 170 },
    { x: 1090, y: 170 },
  ]),
];
