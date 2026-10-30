import { describe, expect, it } from "vitest";
import type { Playback } from "@repo/protocol";
import { echo, plan, type Media } from "../src/lib/sync";

const playback: Playback = {
  url: "https://example.com/v",
  title: "Video",
  playing: true,
  position: 10,
  rate: 1,
  at: 1_000_000,
};

const media: Media = { paused: false, time: 10, rate: 1, duration: 60 };

describe("plan", () => {
  it("does nothing when the video matches", () => {
    expect(plan({ ...media, time: 12.5 }, playback, 1_002_000)).toEqual({});
  });

  it("ignores drift up to a second", () => {
    expect(
      plan({ ...media, time: 11 }, playback, 1_002_000).seek,
    ).toBeUndefined();
  });

  it("seeks to where the room is now when drift is over a second", () => {
    expect(plan(media, playback, 1_002_000).seek).toBe(12);
  });

  it("accounts for rate when projecting position", () => {
    expect(plan(media, { ...playback, rate: 2 }, 1_002_000)).toEqual({
      rate: 2,
      seek: 14,
    });
  });

  it("plays and pauses to match", () => {
    expect(plan({ ...media, paused: true }, playback, 1_000_000).play).toBe(
      true,
    );
    expect(plan(media, { ...playback, playing: false }, 1_005_000)).toEqual({
      play: false,
    });
  });

  it("never seeks past the end", () => {
    expect(plan(media, playback, 1_100_000).seek).toBe(60);
  });
});

describe("echo", () => {
  const expected = { playback, until: 5000 };

  it("suppresses events matching what was applied", () => {
    expect(echo(expected, "play", media, 4000, 1_000_000)).toBe(true);
    expect(echo(expected, "ratechange", media, 4000, 1_000_000)).toBe(true);
    expect(
      echo(expected, "seeked", { ...media, time: 10.2 }, 4000, 1_000_000),
    ).toBe(true);
  });

  it("reports events that contradict what was applied", () => {
    expect(echo(expected, "pause", media, 4000, 1_000_000)).toBe(false);
    expect(
      echo(expected, "ratechange", { ...media, rate: 2 }, 4000, 1_000_000),
    ).toBe(false);
    expect(
      echo(expected, "seeked", { ...media, time: 30 }, 4000, 1_000_000),
    ).toBe(false);
    expect(echo(expected, "ended", media, 4000, 1_000_000)).toBe(false);
  });

  it("reports everything once the window has passed", () => {
    expect(echo(expected, "play", media, 5001, 1_000_000)).toBe(false);
    expect(echo(null, "play", media, 0, 0)).toBe(false);
  });
});
