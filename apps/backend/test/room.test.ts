import {
  env,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  GRACE_MS,
  type ClientMessage,
  type ServerMessage,
} from "@repo/protocol";
import { EMPTY_MS, type State } from "../src/logic";

interface Client {
  socket: WebSocket;
  send(message: ClientMessage): void;
  next(
    type?: ServerMessage["type"],
    check?: (message: ServerMessage) => boolean,
  ): Promise<ServerMessage>;
  closed: Promise<CloseEvent>;
}

async function connect(id: string): Promise<Client> {
  const response = await SELF.fetch(`https://watch.test/rooms/${id}`, {
    headers: { Upgrade: "websocket" },
  });
  const socket = response.webSocket!;
  socket.accept();
  const inbox: ServerMessage[] = [];
  const waiting: Array<() => void> = [];
  socket.addEventListener("message", (event) => {
    if (event.data === "pong") return;
    inbox.push(JSON.parse(event.data as string));
    waiting.splice(0).forEach((wake) => wake());
  });
  const closed = new Promise<CloseEvent>((resolve) =>
    socket.addEventListener("close", resolve),
  );
  return {
    socket,
    closed,
    send: (message) => socket.send(JSON.stringify(message)),
    async next(type, check) {
      for (;;) {
        const index = inbox.findIndex(
          (message) =>
            (!type || message.type === type) && (!check || check(message)),
        );
        if (index !== -1) return inbox.splice(index, 1)[0];
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
    },
  };
}

async function enter(id: string, name: string, resume?: string) {
  const client = await connect(id);
  client.send({ type: "join", name, resume });
  const welcome = (await client.next("welcome")) as Extract<
    ServerMessage,
    { type: "welcome" }
  >;
  return { client, welcome };
}

function stub(id: string) {
  return env.ROOM.get(env.ROOM.idFromName(id));
}

/** Edit the live room state in place, e.g. to move timestamps into the past. */
async function age(id: string, edit: (state: State) => void) {
  await runInDurableObject(stub(id), (instance) => {
    edit((instance as unknown as { state: State }).state);
  });
}

describe("room server", () => {
  it("rejects bad room ids and non-WebSocket requests", async () => {
    expect((await SELF.fetch("https://watch.test/rooms/a!")).status).toBe(400);
    expect((await SELF.fetch("https://watch.test/rooms/abcdef")).status).toBe(
      426,
    );
    expect((await SELF.fetch("https://watch.test/health")).status).toBe(200);
  });

  it("creates the room on first join and tells existing members about newcomers", async () => {
    const ana = await enter("party-1", "Ana");
    expect(ana.welcome.room.host).toBe(ana.welcome.you);
    expect(ana.welcome.room.name).toBe("Ana's room");

    const ben = await enter("party-1", "Ben");
    expect(ben.welcome.room.members.map((m) => m.name)).toEqual(["Ana", "Ben"]);
    const update = await ana.client.next("room");
    expect(update.type === "room" && update.room.members).toHaveLength(2);
  });

  it("answers pings without a room message", async () => {
    const client = await connect("party-2");
    const pong = new Promise((resolve) =>
      client.socket.addEventListener(
        "message",
        (event) => event.data === "pong" && resolve(true),
      ),
    );
    client.socket.send("ping");
    expect(await pong).toBe(true);
  });

  it("enforces host-only control and broadcasts server-stamped playback", async () => {
    const ana = await enter("party-3", "Ana");
    const ben = await enter("party-3", "Ben");
    await ana.client.next("room");

    const before = Date.now();
    ana.client.send({
      type: "playback",
      url: "https://v.test/1",
      playing: true,
      position: 5,
      rate: 1,
    });
    const seen = await ben.client.next("room");
    expect(seen.type === "room" && seen.room.playback).toMatchObject({
      url: "https://v.test/1",
      playing: true,
      position: 5,
    });
    expect(
      seen.type === "room" && seen.room.playback.at,
    ).toBeGreaterThanOrEqual(before);

    ben.client.send({
      type: "playback",
      url: "https://v.test/1",
      playing: false,
      position: 6,
      rate: 1,
    });
    expect(await ben.client.next("error")).toMatchObject({ code: "forbidden" });

    ana.client.send({ type: "mode", mode: "everyone" });
    await ben.client.next("room");
    ben.client.send({
      type: "playback",
      url: "https://v.test/1",
      playing: false,
      position: 6,
      rate: 1,
    });
    const paused = await ana.client.next(
      "room",
      (m) => m.type === "room" && !m.room.playback.playing,
    );
    expect(paused.type === "room" && paused.room.playback.playing).toBe(false);
  });

  it("rejects malformed messages and intents before joining", async () => {
    const client = await connect("party-4");
    client.socket.send("{nope");
    expect(await client.next("error")).toMatchObject({ code: "invalid" });
    client.send({ type: "mode", mode: "everyone" });
    expect(await client.next("error")).toMatchObject({ code: "unjoined" });
  });

  it("keeps a dropped host's seat and role, and restores both on resume", async () => {
    const ana = await enter("party-5", "Ana");
    const ben = await enter("party-5", "Ben");
    await ana.client.next("room");

    ana.client.socket.close(1000);
    const offline = await ben.client.next("room");
    expect(offline.type === "room" && offline.room.members[0].online).toBe(
      false,
    );
    expect(offline.type === "room" && offline.room.host).toBe(ana.welcome.you);

    const back = await enter("party-5", "Ana", ana.welcome.resume);
    expect(back.welcome.you).toBe(ana.welcome.you);
    expect(back.welcome.room.host).toBe(ana.welcome.you);
    expect(back.welcome.room.members.every((m) => m.online)).toBe(true);
  });

  it("closes the old socket when a member resumes elsewhere", async () => {
    const ana = await enter("party-6", "Ana");
    await enter("party-6", "Ana", ana.welcome.resume);
    expect((await ana.client.closed).code).toBe(4000);
  });

  it("hands the host role on once the grace period runs out", async () => {
    const ana = await enter("party-7", "Ana");
    const ben = await enter("party-7", "Ben");
    await ana.client.next("room");
    ana.client.socket.close(1000);
    await ben.client.next("room");

    // Pretend the drop happened a full grace period ago
    await age("party-7", (state) => {
      state.away[ana.welcome.you] -= GRACE_MS;
    });
    expect(await runDurableObjectAlarm(stub("party-7"))).toBe(true);

    const handed = await ben.client.next("room");
    expect(handed.type === "room" && handed.room.host).toBe(ben.welcome.you);
    expect(handed.type === "room" && handed.room.members).toHaveLength(1);
  });

  it("moves the host role immediately when the host leaves", async () => {
    const ana = await enter("party-8", "Ana");
    const ben = await enter("party-8", "Ben");
    await ana.client.next("room");
    ana.client.send({ type: "leave" });
    expect((await ana.client.closed).code).toBe(1000);
    const after = await ben.client.next("room");
    expect(after.type === "room" && after.room.host).toBe(ben.welcome.you);
  });

  it("keeps an empty room's settings for whoever joins next", async () => {
    const ana = await enter("party-9", "Ana");
    ana.client.send({ type: "mode", mode: "everyone" });
    await ana.client.next("room");
    ana.client.send({ type: "leave" });
    await ana.client.closed;

    const ben = await enter("party-9", "Ben");
    expect(ben.welcome.room.host).toBe(ben.welcome.you);
    expect(ben.welcome.room.mode).toBe("everyone");
    expect(ben.welcome.room.members.map((m) => m.name)).toEqual(["Ben"]);
  });

  it("deletes a room that stayed empty, so the next join starts fresh", async () => {
    const ana = await enter("party-10", "Ana");
    ana.client.send({ type: "leave" });
    await ana.client.closed;
    await age("party-10", (state) => {
      state.empty! -= EMPTY_MS;
    });
    expect(await runDurableObjectAlarm(stub("party-10"))).toBe(true);

    const ben = await enter("party-10", "Ben");
    expect(ben.welcome.room.name).toBe("Ben's room");
  });
});
