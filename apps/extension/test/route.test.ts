import { describe, expect, it } from "vitest";
import { route, type Report } from "../src/lib/route";

const base: Report = {
  host: false,
  synced: false,
  matches: false,
  bound: false,
  playing: true,
  audible: true,
  foreground: true,
};

describe("route", () => {
  it("reports actions in the synced tab on the room's video", () => {
    expect(route({ ...base, synced: true, matches: true, bound: true })).toBe(
      "report",
    );
    expect(
      route({
        ...base,
        synced: true,
        matches: true,
        bound: true,
        playing: false,
        audible: false,
        foreground: false,
      }),
    ).toBe("report");
  });

  it("applies the room before trusting a video that hasn't been synced yet", () => {
    expect(route({ ...base, synced: true, matches: true })).toBe("push");
  });

  it("moves the host's synced tab to a video played with sound in front", () => {
    expect(route({ ...base, host: true })).toBe("adopt");
    expect(route({ ...base, host: true, synced: true })).toBe("adopt");
  });

  it("never moves the room for muted, paused or background videos", () => {
    expect(route({ ...base, host: true, audible: false })).toBe("ignore");
    expect(route({ ...base, host: true, playing: false })).toBe("ignore");
    expect(route({ ...base, host: true, foreground: false })).toBe("ignore");
  });

  it("lets followers pick a tab only by playing the room's video", () => {
    expect(route({ ...base, matches: true })).toBe("adopt");
    expect(route(base)).toBe("ignore");
    expect(route({ ...base, synced: true })).toBe("ignore");
  });
});
