/**
 * OmniGrid custom server.
 *
 * Single-process, single-port: Next.js (HTTP) + socket.io (WebSocket) share
 * the same node http.Server. This keeps the deployment story to a single
 * container and avoids a reverse-proxy hop between the dashboard and the
 * realtime SSH stream.
 *
 * Run via:  node --env-file=.env.local --import tsx server/index.ts
 */

import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { migrate } from "@/lib/db/migrate";
import { attachSshNamespace } from "@/lib/ssh/socket";
import { attachOperationsNamespace } from "@/lib/operations/socket";
import { closeAll as closeAllSsh } from "@/lib/ssh/manager";
import { startUptimeChecker, stopUptimeChecker } from "@/lib/uptime/checker";
import { getEnv } from "@/lib/env";

async function main() {
  const env = getEnv();
  const dev = env.NODE_ENV !== "production";

  // Apply DB migrations before serving traffic.
  const m = migrate();
  console.log(`[omnigrid] db schema v${m.current}` +
    (m.applied.length ? ` (applied: ${m.applied.join(", ")})` : ""));

  const app = next({ dev, hostname: env.OMNIGRID_HOST, port: env.OMNIGRID_PORT });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new IOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: false },           // same-origin only
    serveClient: false,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e6,
  });
  attachSshNamespace(io);
  const operations = attachOperationsNamespace(io);

  // Pass this publisher to job producers. They call publish({ workspaceId, jobId, type, payload }).
  void operations;

  let shuttingDown = false;

  httpServer.listen(env.OMNIGRID_PORT, env.OMNIGRID_HOST, () => {
    console.log(
      `[omnigrid] ready  http://${env.OMNIGRID_HOST}:${env.OMNIGRID_PORT}  ` +
        `(${dev ? "dev" : "prod"})`,
    );
    if (!shuttingDown) startUptimeChecker();
  });

  const shutdown = async (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[omnigrid] ${sig} received, shutting down`);
    await stopUptimeChecker();
    closeAllSsh();

    const closeIo = new Promise<void>((resolve) => io.close(() => resolve()));
    const closeHttp = new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    const deadline = new Promise<"deadline">((resolve) => {
      const timer = setTimeout(() => resolve("deadline"), 5000);
      timer.unref();
    });
    const result = await Promise.race([
      Promise.all([closeIo, closeHttp]).then(() => "closed" as const),
      deadline,
    ]);
    if (result === "deadline") {
      console.error("[omnigrid] shutdown deadline exceeded");
      process.exitCode = 1;
    }
    process.exit();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[omnigrid] fatal", err);
  process.exit(1);
});
