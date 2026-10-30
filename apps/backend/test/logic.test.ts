import { describe, expect, it } from "vitest";
import { GRACE_MS, position, type Intent } from "@repo/protocol";
import {
  EMPTY_MS,
  apply,
  deadline,
  drop,
  expire,
  failed,
  join,
  leave,
  type State,
} from "../src/logic";

function ids() {
  let count = 0;
  return () => `id${++count}`;
}

function room(...names: string[]): { state: State; members: string[] } {
  const fresh = ids();
  const members: string[] = [];
  let state: State | null = null;
  names.forEach((name, index) => {
    const result = join(
      state,
      "room-1",
      name,
      undefined,
      undefined,
      index,
      fresh,
    );
    state = result.state;
    members.push(result.member);
  });
  return { state: state!, members };
}

const play: Intent = {
  type: "playback",
  url: "https://a.test/v",
  playing: true,
  position: 10,
  rate: 1,
};

describe("join", () => {
  it("makes the first member host and names the room after them", () => {
    const { state, members } = room("Ana");
    expect(state.room.host).toBe(members[0]);
    expect(state.room.name).toBe("Ana's room");
    expect(state.empty).toBeNull();
  });

  it("resumes an existing seat with the same id and host role", () => {
    const { state, members } = room("Ana", "Ben");
    const away = drop(state, members[0], 100);
    const secret = state.secrets[members[0]];
    const back = join(away, "room-1", "Ana", undefined, secret, 200, ids());
    expect(back.member).toBe(members[0]);
    expect(back.state.room.host).toBe(members[0]);
    expect(
      back.state.room.members.find((m) => m.id === members[0])?.online,
    ).toBe(true);
    expect(back.state.away).toEqual({});
  });

  it("treats an unknown resume secret as a new member", () => {
    const { state } = room("Ana");
    const result = join(
      state,
      "room-1",
      "Eve",
      undefined,
      "guess",
      5,
      () => "new",
    );
    expect(result.member).toBe("new");
    expect(result.state.room.members).toHaveLength(2);
  });
});

describe("permissions", () => {
  it("only lets the host control playback in host mode", () => {
    const { state, members } = room("Ana", "Ben");
    const result = apply(state, members[0], play, 50) as State;
    expect(result.room.playback).toMatchObject({
      playing: true,
      position: 10,
      at: 50,
    });
    // Same video, so only the control mode can refuse it
    expect(
      failed(apply(result, members[1], { ...play, playing: false }, 60)),
    ).toBe(true);
  });

  it("lets everyone control the current video but only the host change it", () => {
    const { state, members } = room("Ana", "Ben");
    const open = apply(
      apply(state, members[0], { type: "mode", mode: "everyone" }, 1) as State,
      members[0],
      play,
      2,
    ) as State;
    const paused = apply(
      open,
      members[1],
      { ...play, playing: false, position: 12 },
      3,
    );
    expect(failed(paused)).toBe(false);
    expect(
      failed(apply(open, members[1], { ...play, url: "https://b.test" }, 4)),
    ).toBe(true);
  });

  it("only lets the host rename the room or change mode", () => {
    const { state, members } = room("Ana", "Ben");
    expect(
      failed(
        apply(
          state,
          members[1],
          { type: "rename", target: "room", name: "X" },
          1,
        ),
      ),
    ).toBe(true);
    expect(
      failed(apply(state, members[1], { type: "mode", mode: "everyone" }, 1)),
    ).toBe(true);
    const renamed = apply(
      state,
      members[1],
      { type: "rename", target: "self", name: "Benny" },
      1,
    ) as State;
    expect(renamed.room.members[1].name).toBe("Benny");
  });
});

describe("leaving and grace", () => {
  it("moves the host role immediately on leave", () => {
    const { state, members } = room("Ana", "Ben", "Cy");
    const next = leave(state, members[0], 10);
    expect(next.room.host).toBe(members[1]);
    expect(next.secrets[members[0]]).toBeUndefined();
  });

  it("keeps a dropped host through the grace period, then hands off to an online member", () => {
    const { state, members } = room("Ana", "Ben", "Cy");
    const ben = drop(state, members[1], 0);
    const ana = drop(ben, members[0], 5);
    expect(expire(ana, 5 + GRACE_MS - 1).room.host).toBe(members[0]);
    const after = expire(ana, 5 + GRACE_MS);
    expect(after.room.members.map((m) => m.id)).toEqual([members[2]]);
    expect(after.room.host).toBe(members[2]);
  });

  it("schedules the next deadline from grace periods and emptiness", () => {
    const { state, members } = room("Ana");
    expect(deadline(state)).toBeNull();
    expect(deadline(drop(state, members[0], 100))).toBe(100 + GRACE_MS);
    expect(deadline(leave(state, members[0], 100))).toBe(100 + EMPTY_MS);
  });
});

describe("position", () => {
  it("advances while playing at the playback rate", () => {
    const playback = {
      url: null,
      title: null,
      playing: true,
      position: 10,
      rate: 2,
      at: 1000,
    };
    expect(position(playback, 3000)).toBe(14);
    expect(position({ ...playback, playing: false }, 3000)).toBe(10);
  });
});
