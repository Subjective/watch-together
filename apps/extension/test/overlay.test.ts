import { describe, expect, it } from "vitest";
import type { Playback, Room } from "@repo/protocol";
import { note, overlay, type Scene } from "../src/lib/overlay";

const VIDEO = "https://example.com/watch?v=a";

function room(playback: Partial<Playback> = {}): Room {
  return {
    id: "room-1",
    name: "Ana's room",
    host: "ana",
    mode: "host",
    members: [
      { id: "ana", name: "Ana", online: true, joined: 0 },
      { id: "ben", name: "Ben", online: true, joined: 1 },
    ],
    playback: {
      url: VIDEO,
      title: "Video A",
      playing: false,
      position: 10,
      rate: 1,
      at: 1000,
      duration: 120,
      image: null,
      by: "ana",
      ...playback,
    },
    seq: 1,
  };
}

describe("note", () => {
  const before = room();

  it("says what someone else did", () => {
    expect(note(before, room({ at: 2000, playing: true }), "ben")).toBe(
      "Ana played",
    );
    expect(
      note(room({ playing: true }), room({ at: 2000, position: 11 }), "ben"),
    ).toBe("Ana paused");
    expect(note(before, room({ at: 2000, rate: 1.5 }), "ben")).toBe(
      "Ana set speed 1.5×",
    );
    expect(note(before, room({ at: 2000, position: 75 }), "ben")).toBe(
      "Ana jumped to 1:15",
    );
    expect(
      note(before, room({ at: 2000, url: "https://example.com/b" }), "ben"),
    ).toBe("Ana switched videos");
  });

  it("stays quiet about your own changes and repeats", () => {
    expect(note(before, room({ at: 2000, playing: true }), "ana")).toBeNull();
    expect(note(before, room(), "ben")).toBeNull();
    // Playing on from where it was isn't a jump
    const playing = room({ playing: true });
    expect(
      note(playing, room({ playing: true, at: 3000, position: 12 }), "ben"),
    ).toBeNull();
  });

  it("tells the host when their play moved the room", () => {
    expect(
      note(
        before,
        room({ at: 2000, url: "https://example.com/b", title: "Video B" }),
        "ana",
      ),
    ).toBe("Room moved to Video B");
  });
});

describe("overlay", () => {
  const scene: Scene = {
    room: room(),
    you: "ben",
    status: "connected",
    blocked: false,
    synced: true,
    url: VIDEO,
    note: null,
    id: 0,
  };

  it("names who you're synced with, or the room for the host", () => {
    expect(overlay(scene)).toMatchObject({
      text: "Synced with Ana",
      count: 2,
      warn: false,
      offer: null,
    });
    expect(overlay({ ...scene, you: "ana" })?.text).toBe("Ana's room");
  });

  it("shows notes, and problems over notes", () => {
    expect(overlay({ ...scene, note: "Ana paused" })?.text).toBe("Ana paused");
    expect(
      overlay({ ...scene, note: "Ana paused", status: "reconnecting" }),
    ).toMatchObject({ text: "Reconnecting…", warn: true });
    expect(overlay({ ...scene, blocked: true })).toMatchObject({
      text: "Press play to catch up",
      warn: true,
    });
  });

  it("offers to sync another tab showing the room's video", () => {
    expect(overlay({ ...scene, synced: false })).toMatchObject({
      text: "Not synced",
      offer: "sync",
    });
    expect(
      overlay({ ...scene, synced: false, url: "https://example.com/b" }),
    ).toBeNull();
  });

  it("offers a follower the host's new video", () => {
    const away = { ...scene, url: "https://example.com/b" };
    expect(overlay(away)).toMatchObject({ offer: "follow" });
    expect(overlay({ ...away, note: "Ana switched videos" })?.text).toBe(
      "Ana switched videos",
    );
    expect(overlay({ ...away, you: "ana" })).toBeNull();
  });
});
