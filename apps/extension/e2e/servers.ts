import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as http, type Server } from "node:http";
import { createServer as tcp, connect, type Socket } from "node:net";
import { extname, join, resolve } from "node:path";

export const SITE_PORT = 4173;
/** The extension under test is built against this port. */
export const PROXY_PORT = 8787;
const BACKEND_PORT = 8788;

export const SITE = `http://localhost:${SITE_PORT}`;

const ROOT = resolve(import.meta.dirname, "site");
const BACKEND = resolve(import.meta.dirname, "../../backend");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webm": "video/webm",
};

/** Static fixture site with byte ranges, which video seeking needs. */
export function site(): Promise<Server> {
  const server = http((request, response) => {
    const path = new URL(request.url ?? "/", SITE).pathname;
    const file = join(ROOT, path === "/" ? "watch.html" : path);
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const range = request.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (!range) {
      response.writeHead(200, {
        "content-type": type,
        "content-length": size,
        "accept-ranges": "bytes",
      });
      createReadStream(file).pipe(response);
      return;
    }
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    response.writeHead(206, {
      "content-type": type,
      "content-length": end - start + 1,
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
    });
    createReadStream(file, { start, end }).pipe(response);
  });
  return new Promise((done) => server.listen(SITE_PORT, () => done(server)));
}

/**
 * A TCP proxy in front of the backend, so tests can cut every socket the
 * way a network drop does, without the extension knowing.
 */
export function proxy() {
  const sockets = new Set<Socket>();
  const server = tcp((client) => {
    const upstream = connect(BACKEND_PORT, "127.0.0.1");
    sockets.add(client);
    sockets.add(upstream);
    client.pipe(upstream).pipe(client);
    const end = () => {
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    client.on("error", end).on("close", end);
    upstream.on("error", end).on("close", end);
  });
  return new Promise<{ kill(): void; close(): void }>((done) =>
    server.listen(PROXY_PORT, () =>
      done({
        kill: () => {
          for (const socket of sockets) socket.destroy();
        },
        close: () => {
          for (const socket of sockets) socket.destroy();
          server.close();
        },
      }),
    ),
  );
}

async function healthy(): Promise<boolean> {
  const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/health`).catch(
    () => null,
  );
  return response?.ok ?? false;
}

/** `wrangler dev` with local persistence, so rooms survive a restart. */
export async function backend() {
  const state = { child: null as ChildProcess | null };

  async function start() {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "wrangler",
        "dev",
        "--port",
        String(BACKEND_PORT),
        "--ip",
        "127.0.0.1",
      ],
      { cwd: BACKEND, stdio: "ignore", detached: true },
    );
    state.child = child;
    const deadline = Date.now() + 60_000;
    while (!(await healthy())) {
      if (Date.now() > deadline) throw new Error("wrangler dev did not start");
      await new Promise((done) => setTimeout(done, 250));
    }
  }

  async function stop() {
    const child = state.child;
    if (!child?.pid) return;
    const exited = new Promise((done) => child.once("exit", done));
    process.kill(-child.pid, "SIGTERM");
    await exited;
    state.child = null;
  }

  await start();
  return {
    stop,
    async restart() {
      await stop();
      await start();
    },
  };
}
