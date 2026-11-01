import { DRIFT } from "./sync";
import { clock } from "./clock";
import { key } from "./key";
import type { Status } from "./messages";
import type { Room } from "@repo/protocol";

/** The button after the pill's text. */
export type Offer = "sync" | "follow" | "move";

/** What the pill on a video shows. */
export interface Overlay {
  text: string;
  count: number;
  /** Something needs attention: amber, and it doesn't fade. */
  warn: boolean;
  /** A button after the text. */
  offer: Offer | null;
  /** Changes when a new note should bring the pill back. */
  id: number;
}

/** How long a note replaces the pill's label. */
export const NOTE_MS = 3000;

/**
 * A short line about someone else changing the room, or about your own
 * change moving the room to another video. Null when nothing is worth saying.
 */
export function note(before: Room, after: Room, you: string): string | null {
  const previous = before.playback;
  const next = after.playback;
  if (next.at === previous.at || !next.by || !next.url) return null;
  const moved = key(next.url) !== key(previous.url);
  if (next.by === you)
    return moved && after.host === you
      ? `Room moved to ${next.title ?? "a new video"}`
      : null;
  const name =
    after.members.find((member) => member.id === next.by)?.name ?? "Someone";
  if (moved) return `${name} switched videos`;
  if (next.playing !== previous.playing)
    return `${name} ${next.playing ? "played" : "paused"}`;
  if (next.rate !== previous.rate) return `${name} set speed ${next.rate}×`;
  const expected = previous.playing
    ? previous.position + ((next.at - previous.at) / 1000) * previous.rate
    : previous.position;
  if (Math.abs(next.position - expected) <= DRIFT) return null;
  return `${name} jumped to ${clock(next.position)}`;
}

/** Everything a tab's pill depends on. */
export interface Scene {
  room: Room;
  you: string;
  status: Status;
  blocked: boolean;
  /** This tab is your synced tab. */
  synced: boolean;
  /** The host played another video here, so the room could move here. */
  candidate: boolean;
  /** The tab's URL. */
  url: string | undefined;
  /** A recent note, which replaces the label. */
  note: string | null;
  /** Counts notes, so each one brings the pill back. */
  id: number;
}

/** The pill for one tab, or null for none. */
export function overlay(scene: Scene): Overlay | null {
  const room = scene.room;
  const host = room.host === scene.you;
  const matches =
    key(scene.url) !== null && key(scene.url) === key(room.playback.url);
  const base = {
    count: room.members.length,
    warn: false,
    offer: null,
    id: scene.id,
  };
  if (!scene.synced) {
    if (matches)
      return { ...base, text: "Not synced", warn: true, offer: "sync" };
    if (!host || !scene.candidate) return null;
    return { ...base, text: "Not synced", warn: true, offer: "move" };
  }
  if (!matches) {
    if (host || !room.playback.url) return null;
    return {
      ...base,
      text: scene.note ?? "Not synced",
      warn: true,
      offer: "follow",
    };
  }
  if (scene.status !== "connected")
    return { ...base, text: "Reconnecting…", warn: true };
  if (scene.blocked)
    return { ...base, text: "Press play to catch up", warn: true };
  if (scene.note) return { ...base, text: scene.note };
  const leader = room.members.find((member) => member.id === room.host);
  return {
    ...base,
    text: host || !leader ? room.name : `Synced with ${leader.name}`,
  };
}
