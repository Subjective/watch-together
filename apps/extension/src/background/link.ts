import {
  PING,
  PONG,
  type ClientMessage,
  type ServerMessage,
} from "@repo/protocol";

/** Reconnect delays in ms; the last one repeats forever. */
export const BACKOFF = [1000, 2000, 4000, 8000, 15000];

/** Keepalive interval. It also keeps the MV3 service worker awake. */
export const PING_MS = 20_000;

/** A socket that has been silent this long is considered dead. */
const SILENT_MS = 45_000;

export interface Events {
  /** The socket opened; send `join`. */
  open(): void;
  message(message: ServerMessage): void;
  /** The socket dropped and a reconnect is scheduled. */
  lost(): void;
}

/**
 * One WebSocket to a room that reconnects with backoff until `close` is
 * called. Never gives up on its own.
 */
export class Link {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private ping: ReturnType<typeof setInterval> | undefined;
  private heard = 0;

  constructor(
    private url: string,
    private events: Events,
  ) {}

  open() {
    clearTimeout(this.retry);
    this.heard = Date.now();
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.heard = Date.now();
      this.events.open();
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket) return;
      this.heard = Date.now();
      if (event.data === PONG) return;
      this.events.message(JSON.parse(event.data) as ServerMessage);
    };
    socket.onclose = () => this.lose(socket);
    clearInterval(this.ping);
    this.ping = setInterval(() => {
      if (Date.now() - this.heard > SILENT_MS) return this.lose(socket);
      if (socket.readyState === WebSocket.OPEN) socket.send(PING);
    }, PING_MS);
  }

  /** Forget a dead socket and schedule the next attempt. */
  private lose(socket: WebSocket) {
    if (socket !== this.socket) return;
    this.socket = null;
    clearInterval(this.ping);
    socket.close();
    this.events.lost();
    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;
    this.retry = setTimeout(() => this.open(), delay);
  }

  /** Call once the server welcomed us, so the next drop retries quickly. */
  settled() {
    this.attempt = 0;
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  /** Stop for good. */
  close() {
    clearTimeout(this.retry);
    clearInterval(this.ping);
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Closed");
  }
}
