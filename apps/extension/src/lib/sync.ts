import { position, type Playback } from "@repo/protocol";

/** Drift in seconds we tolerate before seeking. */
export const DRIFT = 1;

/** How long after applying state its media events count as echoes. */
export const ECHO_MS = 1000;

export interface Media {
  paused: boolean;
  time: number;
  rate: number;
  duration: number;
}

export interface Steps {
  play?: boolean;
  rate?: number;
  seek?: number;
}

/** What to change on the video so it matches the room at server time `now`. */
export function plan(media: Media, playback: Playback, now: number): Steps {
  const target = Math.min(
    position(playback, now),
    Number.isFinite(media.duration) ? media.duration : Infinity,
  );
  return {
    play: playback.playing === media.paused ? playback.playing : undefined,
    rate: media.rate === playback.rate ? undefined : playback.rate,
    seek: Math.abs(media.time - target) > DRIFT ? target : undefined,
  };
}

export type Kind = "play" | "pause" | "seeked" | "ratechange" | "ended";

/** State we just applied, so the events it causes are not reported back. */
export interface Expected {
  playback: Playback;
  /** Local time until which matching events are echoes. */
  until: number;
}

/** Whether a media event was caused by us applying `expected`. */
export function echo(
  expected: Expected | null,
  kind: Kind,
  media: Media,
  local: number,
  server: number,
): boolean {
  if (!expected || local > expected.until) return false;
  if (kind === "play") return expected.playback.playing;
  if (kind === "pause") return !expected.playback.playing;
  if (kind === "ratechange") return media.rate === expected.playback.rate;
  if (kind === "seeked")
    return Math.abs(media.time - position(expected.playback, server)) <= DRIFT;
  return false;
}
