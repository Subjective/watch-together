/**
 * Wire protocol shared by the room server and the extension.
 *
 * The server owns the room. Clients send intents, the server validates and
 * applies them, then broadcasts the whole room to every member.
 */

export type Mode = "host" | "everyone";

export interface Member {
  id: string;
  name: string;
  online: boolean;
  joined: number;
}

export interface Playback {
  url: string | null;
  title: string | null;
  playing: boolean;
  /** Position in seconds at server time `at`. */
  position: number;
  rate: number;
  /** Server time in ms when `position` was true. */
  at: number;
  /** Length of the video in seconds, when the reporter knows it. */
  duration: number | null;
  /** Preview image of the video: its poster or the page's share image. */
  image: string | null;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  mode: Mode;
  members: Member[];
  playback: Playback;
  /** Increments on every change, so clients can drop stale updates. */
  seq: number;
}

export type Intent =
  | {
      type: "playback";
      url: string | null;
      title?: string | null;
      playing: boolean;
      position: number;
      rate: number;
      duration?: number | null;
      image?: string | null;
    }
  | { type: "mode"; mode: Mode }
  | { type: "rename"; target: "room" | "self"; name: string };

export type ClientMessage =
  | { type: "join"; name: string; resume?: string; room?: string }
  | { type: "leave" }
  | Intent;

export type ErrorCode = "invalid" | "forbidden" | "unjoined";

export type ServerMessage =
  | { type: "welcome"; you: string; resume: string; room: Room; now: number }
  | { type: "room"; room: Room; now: number }
  | { type: "error"; code: ErrorCode; message: string };

export const LIMITS = {
  roomName: 30,
  userName: 20,
  url: 2048,
  title: 200,
  message: 4096,
} as const;

/** Text frame the server answers with "pong" without waking the room. */
export const PING = "ping";
export const PONG = "pong";

/** How long a dropped member keeps their seat, including the host role. */
export const GRACE_MS = 30_000;

export const ROOM_ID = /^[A-Za-z0-9_-]{6,50}$/;

/** Where playback should be right now, given the server clock. */
export function position(playback: Playback, now: number): number {
  if (!playback.playing) return playback.position;
  return playback.position + ((now - playback.at) / 1000) * playback.rate;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** An absolute http(s) URL, or null. */
function link(value: unknown): string | null {
  const url = text(value, LIMITS.url);
  if (!url || !URL.canParse(url)) return null;
  return /^https?:$/.test(new URL(url).protocol) ? url : null;
}

function decode(raw: string): unknown {
  // JSON.parse has no non-throwing variant
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Validate an untrusted client frame. Returns null when malformed. */
export function parse(raw: string): ClientMessage | null {
  if (raw.length > LIMITS.message) return null;
  const data = decode(raw);
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;

  switch (message.type) {
    case "join": {
      const name = text(message.name, LIMITS.userName);
      if (!name) return null;
      const resume =
        typeof message.resume === "string" ? message.resume : undefined;
      const room = text(message.room, LIMITS.roomName) ?? undefined;
      return { type: "join", name, resume, room };
    }
    case "leave":
      return { type: "leave" };
    case "playback": {
      const url = message.url === null ? null : text(message.url, LIMITS.url);
      if (url === null && message.url !== null) return null;
      if (typeof message.playing !== "boolean") return null;
      if (!number(message.position) || message.position < 0) return null;
      if (!number(message.rate) || message.rate <= 0 || message.rate > 16)
        return null;
      return {
        type: "playback",
        url,
        title: text(message.title, LIMITS.title),
        playing: message.playing,
        position: message.position,
        rate: message.rate,
        duration:
          number(message.duration) && message.duration > 0
            ? message.duration
            : null,
        image: link(message.image),
      };
    }
    case "mode":
      if (message.mode !== "host" && message.mode !== "everyone") return null;
      return { type: "mode", mode: message.mode };
    case "rename": {
      if (message.target !== "room" && message.target !== "self") return null;
      const name = text(
        message.name,
        message.target === "room" ? LIMITS.roomName : LIMITS.userName,
      );
      if (!name) return null;
      return { type: "rename", target: message.target, name };
    }
  }
  return null;
}
