/**
 * Pure room logic. The Durable Object persists and broadcasts; everything
 * that decides what the room looks like lives here so it can be unit tested.
 */

import {
  GRACE_MS,
  LIMITS,
  type ErrorCode,
  type Intent,
  type Member,
  type Room,
} from "@repo/protocol";

/** An empty room is kept this long so its link and rejoin keep working. */
export const EMPTY_MS = 30 * 60_000;

export interface State {
  room: Room;
  /** Member id to resume secret. Never broadcast. */
  secrets: Record<string, string>;
  /** Member id to the server time their last socket closed. */
  away: Record<string, number>;
  /** Server time the last member left, or null while anyone is in. */
  empty: number | null;
}

export interface Failure {
  code: ErrorCode;
  message: string;
}

export function create(id: string, name: string, now: number): State {
  return {
    room: {
      id,
      name,
      host: "",
      mode: "host",
      members: [],
      playback: {
        url: null,
        title: null,
        playing: false,
        position: 0,
        rate: 1,
        at: now,
        duration: null,
        image: null,
      },
      seq: 0,
    },
    secrets: {},
    away: {},
    empty: now,
  };
}

/** The member who should hold the host role if the current one is gone. */
function successor(room: Room): string {
  const ordered = [...room.members].sort((a, b) => a.joined - b.joined);
  const online = ordered.find((member) => member.online);
  return online?.id ?? ordered[0]?.id ?? "";
}

export function join(
  state: State | null,
  id: string,
  name: string,
  label: string | undefined,
  resume: string | undefined,
  now: number,
  fresh: () => string,
): { state: State; member: string; secret: string } {
  const next = state
    ? structuredClone(state)
    : create(id, label ?? `${name}'s room`.slice(0, LIMITS.roomName), now);
  const returning = Object.entries(next.secrets).find(
    ([, secret]) => resume !== undefined && secret === resume,
  );

  if (returning) {
    const member = next.room.members.find((m) => m.id === returning[0])!;
    member.online = true;
    delete next.away[member.id];
    next.empty = null;
    next.room.seq++;
    return { state: next, member: member.id, secret: returning[1] };
  }

  const member: Member = { id: fresh(), name, online: true, joined: now };
  const secret = fresh();
  next.room.members.push(member);
  next.secrets[member.id] = secret;
  if (!next.room.members.some((m) => m.id === next.room.host)) {
    next.room.host = member.id;
  }
  next.empty = null;
  next.room.seq++;
  return { state: next, member: member.id, secret };
}

function remove(state: State, ids: string[], now: number): State {
  const next = structuredClone(state);
  next.room.members = next.room.members.filter((m) => !ids.includes(m.id));
  for (const id of ids) {
    delete next.secrets[id];
    delete next.away[id];
  }
  if (ids.includes(next.room.host)) next.room.host = successor(next.room);
  if (next.room.members.length === 0) next.empty = now;
  next.room.seq++;
  return next;
}

/** Explicit leave: the seat and any host role go immediately. */
export function leave(state: State, member: string, now: number): State {
  return remove(state, [member], now);
}

/** Socket closed without a leave: keep the seat for the grace period. */
export function drop(state: State, member: string, now: number): State {
  const next = structuredClone(state);
  const target = next.room.members.find((m) => m.id === member);
  if (!target) return state;
  target.online = false;
  next.away[member] = now;
  next.room.seq++;
  return next;
}

/** Remove members whose grace period has run out. */
export function expire(state: State, now: number): State {
  const gone = Object.entries(state.away)
    .filter(([, since]) => now - since >= GRACE_MS)
    .map(([id]) => id);
  if (gone.length === 0) return state;
  return remove(state, gone, now);
}

/** When the room next needs attention, or null if never. */
export function deadline(state: State): number | null {
  const times = Object.values(state.away).map((since) => since + GRACE_MS);
  if (state.empty !== null) times.push(state.empty + EMPTY_MS);
  if (times.length === 0) return null;
  return Math.min(...times);
}

export function apply(
  state: State,
  member: string,
  intent: Intent,
  now: number,
): State | Failure {
  const host = state.room.host === member;
  const next = structuredClone(state);

  switch (intent.type) {
    case "playback": {
      if (state.room.mode === "host" && !host) {
        return {
          code: "forbidden",
          message: "Only the host can control playback",
        };
      }
      if (intent.url !== state.room.playback.url && !host) {
        return {
          code: "forbidden",
          message: "Only the host can change the video",
        };
      }
      next.room.playback = {
        url: intent.url,
        title: intent.title ?? null,
        playing: intent.playing,
        position: intent.position,
        rate: intent.rate,
        at: now,
        duration: intent.duration ?? null,
        image: intent.image ?? null,
      };
      break;
    }
    case "mode": {
      if (!host)
        return {
          code: "forbidden",
          message: "Only the host can change control mode",
        };
      next.room.mode = intent.mode;
      break;
    }
    case "rename": {
      if (intent.target === "room") {
        if (!host)
          return {
            code: "forbidden",
            message: "Only the host can rename the room",
          };
        next.room.name = intent.name;
        break;
      }
      next.room.members.find((m) => m.id === member)!.name = intent.name;
      break;
    }
  }

  next.room.seq++;
  return next;
}

export function failed(result: State | Failure): result is Failure {
  return "code" in result;
}
