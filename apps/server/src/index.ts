import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import type { ClientMessage, ServerMessage } from "@heist-one/game";
import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config";
import { SessionRuntime } from "./session";

const app = Fastify({ logger: true });
await app.register(websocket);

const inputSchema = z.object({
  type: z.literal("input"),
  sequence: z.number().int().nonnegative(),
  input: z.object({
    up: z.boolean(),
    down: z.boolean(),
    left: z.boolean(),
    right: z.boolean(),
    sprint: z.boolean(),
    crouch: z.boolean(),
  }),
});
const actionSchema = z.object({
  type: z.literal("action"),
  sequence: z.number().int().nonnegative(),
  action: z.enum(["interact", "throw_noise"]),
});
const restartSchema = z.object({
  type: z.literal("restart"),
  sequence: z.number().int().nonnegative(),
});
const selectSchema = z.object({
  type: z.literal("select_guard"),
  sequence: z.number().int().nonnegative(),
  guardId: z.string().nullable(),
});
const clientMessageSchema = z.discriminatedUnion("type", [
  inputSchema,
  actionSchema,
  restartSchema,
  selectSchema,
]);

app.get("/health", async () => ({ ok: true }));
app.get("/api/config", async () => ({
  defaultMode: config.defaultMode,
  liveAvailable: config.liveAvailable,
  decisionTimeoutMs: config.decisionTimeoutMs,
  liveCallLimit: config.liveCallLimit,
}));

app.get("/ws", { websocket: true }, (socket, request) => {
  const query = z.object({ mode: z.enum(["scripted", "jev"]).optional() }).safeParse(request.query);
  const requestedMode = query.success
    ? (query.data.mode ?? config.defaultMode)
    : config.defaultMode;
  const mode = requestedMode === "jev" && config.liveAvailable ? "jev" : "scripted";
  const sessionId = crypto.randomUUID();
  const send = (message: ServerMessage): void => {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  };
  const session = new SessionRuntime({ sessionId, mode, send });
  session.start();

  socket.on("message", (buffer: Buffer) => {
    try {
      const parsed = clientMessageSchema.safeParse(JSON.parse(buffer.toString()));
      if (!parsed.success) {
        send({
          type: "error",
          code: "invalid_message",
          message: "Client message failed validation.",
        });
        return;
      }
      session.handle(parsed.data as ClientMessage);
    } catch {
      send({ type: "error", code: "invalid_json", message: "Client message was not valid JSON." });
    }
  });
  socket.on("close", () => void session.close());
  socket.on("error", () => void session.close());
});

const webDist = resolve(fileURLToPath(new URL("../../web/dist", import.meta.url)));
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.get("/*", (_request, reply) => reply.sendFile("index.html"));
}

await app.listen({ port: config.port, host: config.host });
