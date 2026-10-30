/**
 * Worker entry: routes /rooms/:id to that room's Durable Object.
 */

import { ROOM_ID } from "@repo/protocol";
import { Room, type Env } from "./room";

export { Room };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok" });

    const parts = url.pathname.split("/");
    if (parts.length !== 3 || parts[1] !== "rooms") {
      return new Response("Not found", { status: 404 });
    }
    if (!ROOM_ID.test(parts[2])) {
      return new Response("Invalid room id", { status: 400 });
    }
    return env.ROOM.get(env.ROOM.idFromName(parts[2])).fetch(request);
  },
};
