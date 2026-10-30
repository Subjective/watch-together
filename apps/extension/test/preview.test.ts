import { describe, expect, it } from "vitest";
import type { Playback } from "@repo/protocol";
import { preview } from "../src/lib/preview";

const playback = (
  url: string | null,
  image: string | null = null,
): Playback => ({
  url,
  title: null,
  playing: false,
  position: 0,
  rate: 1,
  at: 0,
  duration: null,
  image,
});

describe("preview", () => {
  it("uses YouTube's thumbnail for any YouTube URL", () => {
    const thumb = "https://i.ytimg.com/vi/abc123/mqdefault.jpg";
    expect(preview(playback("https://www.youtube.com/watch?v=abc123"))).toBe(
      thumb,
    );
    expect(preview(playback("https://youtu.be/abc123?t=5"))).toBe(thumb);
    expect(
      preview(
        playback("https://www.youtube.com/watch?v=abc123", "https://x/y"),
      ),
    ).toBe(thumb);
  });

  it("falls back to the reported image, or nothing", () => {
    expect(
      preview(playback("https://example.com/v", "https://example.com/p.jpg")),
    ).toBe("https://example.com/p.jpg");
    expect(preview(playback("https://example.com/v"))).toBeNull();
    expect(preview(playback(null))).toBeNull();
  });
});
