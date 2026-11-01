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
  free: false,
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

  it("moves the room when the host's synced tab plays a new video", () => {
    const host = { ...base, host: true, synced: true };
    expect(route(host)).toBe("report");
    // A playlist moving on in the background counts too
    expect(route({ ...host, foreground: false })).toBe("report");
  });

  it("offers to move the room when the host plays in another tab", () => {
    expect(route({ ...base, host: true })).toBe("offer");
    // The room's own video already offers to sync instead
    expect(route({ ...base, host: true, matches: true })).toBe("ignore");
    // Without a synced tab, the host's next video takes over
    expect(route({ ...base, host: true, free: true })).toBe("adopt");
  });

  it("never moves the room for muted, paused or background videos", () => {
    const host = { ...base, host: true, free: true };
    expect(route({ ...host, audible: false })).toBe("ignore");
    expect(route({ ...host, playing: false })).toBe("ignore");
    expect(route({ ...host, foreground: false })).toBe("ignore");
    expect(route({ ...host, synced: true, audible: false })).toBe("ignore");
  });

  it("lets followers pick a tab only by playing the room's video", () => {
    expect(route({ ...base, matches: true })).toBe("adopt");
    expect(route(base)).toBe("ignore");
    expect(route({ ...base, synced: true })).toBe("ignore");
  });
});
