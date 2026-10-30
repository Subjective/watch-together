/**
 * One Durable Object per room. Holds the authoritative room state, persists
 * it on every change, and broadcasts the whole room to every connected socket.
 * Uses WebSocket hibernation: per-socket identity lives in the socket
 * attachment, so nothing is lost when the object is evicted.
 */

import { DurableObject } from "cloudflare:workers";
import { PING, PONG, parse, type ServerMessage } from "@repo/protocol";
import {
  apply,
  deadline,
  drop,
  expire,
  failed,
  join,
  leave,
  type State,
} from "./logic";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
}

interface Attachment {
  member: string;
}

export class Room extends DurableObject<Env> {
  private state: State | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<State>("state")) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const id = new URL(request.url).pathname.split("/")[2];
    const pair = new WebSocketPair();
    // The room id travels with the socket until it joins
    this.ctx.acceptWebSocket(pair[1], [id]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const message = typeof data === "string" ? parse(data) : null;
    if (!message)
      return this.send(socket, {
        type: "error",
        code: "invalid",
        message: "Malformed message",
      });

    if (message.type === "join") {
      const id = this.ctx.getTags(socket)[0];
      const result = join(
        this.state,
        id,
        message.name,
        message.room,
        message.resume,
        Date.now(),
        () => crypto.randomUUID(),
      );
      // A resumed member replaces any socket they still have open
      for (const other of this.sockets(result.member)) {
        if (other !== socket)
          other.close(4000, "Replaced by a newer connection");
      }
      // Attach after broadcasting so the joiner gets a welcome, not a room update
      await this.commit(result.state);
      socket.serializeAttachment({
        member: result.member,
      } satisfies Attachment);
      this.send(socket, {
        type: "welcome",
        you: result.member,
        resume: result.secret,
        room: result.state.room,
        now: Date.now(),
      });
      return;
    }

    const member = this.member(socket);
    if (!member || !this.state) {
      return this.send(socket, {
        type: "error",
        code: "unjoined",
        message: "Join the room first",
      });
    }

    if (message.type === "leave") {
      socket.serializeAttachment(null);
      await this.commit(leave(this.state, member, Date.now()));
      socket.close(1000, "Left the room");
      return;
    }

    const result = apply(this.state, member, message, Date.now());
    if (failed(result)) return this.send(socket, { type: "error", ...result });
    await this.commit(result);
  }

  async webSocketClose(socket: WebSocket) {
    const member = this.member(socket);
    // Complete the close handshake unless the socket is already gone
    if (socket.readyState !== WebSocket.CLOSED) socket.close(1000, "Closed");
    if (!member || !this.state) return;
    if (this.sockets(member).some((other) => other !== socket)) return;
    await this.commit(drop(this.state, member, Date.now()));
  }

  async webSocketError(socket: WebSocket) {
    const member = this.member(socket);
    if (!member || !this.state) return;
    if (this.sockets(member).some((other) => other !== socket)) return;
    await this.commit(drop(this.state, member, Date.now()));
  }

  async alarm() {
    if (!this.state) return;
    const now = Date.now();
    if (this.state.empty !== null && this.state.room.members.length === 0) {
      const due = deadline(this.state);
      if (due !== null && due <= now) {
        this.state = null;
        await this.ctx.storage.deleteAll();
        return;
      }
    }
    await this.commit(expire(this.state, now));
  }

  /** Persist, broadcast if anything changed, and reschedule the alarm. */
  private async commit(next: State) {
    const changed = next.room.seq !== this.state?.room.seq;
    this.state = next;
    await this.ctx.storage.put("state", next);
    const due = deadline(next);
    if (due === null) await this.ctx.storage.deleteAlarm();
    if (due !== null) await this.ctx.storage.setAlarm(due);
    if (!changed) return;
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      if (this.member(socket))
        this.send(socket, { type: "room", room: next.room, now });
    }
  }

  private member(socket: WebSocket): string | null {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    return attachment?.member ?? null;
  }

  private sockets(member: string): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((socket) => this.member(socket) === member);
  }

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }
}
