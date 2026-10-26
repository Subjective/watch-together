import { describe, expect, it } from "vitest";
import { key } from "../src/lib/key";

describe("key", () => {
  it("uses the v parameter for YouTube", () => {
    const id = "youtube:dQw4w9WgXcQ";
    expect(key("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(id);
    expect(key("https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ")).toBe(
      id,
    );
    expect(key("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(id);
    expect(key("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(id);
    expect(key("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(id);
  });

  it("drops tracking, position and room parameters", () => {
    expect(
      key(
        "https://example.com/watch/1?utm_source=x&t=10&si=a&feature=b&fbclid=c&wt_room=abcdef&ep=2",
      ),
    ).toBe("https://example.com/watch/1?ep=2");
  });

  it("ignores parameter order and the hash", () => {
    expect(key("https://example.com/v?b=2&a=1#top")).toBe(
      key("https://example.com/v?a=1&b=2"),
    );
  });

  it("keeps paths and queries that identify different videos", () => {
    expect(key("https://example.com/v?id=1")).not.toBe(
      key("https://example.com/v?id=2"),
    );
    expect(key("https://example.com/a")).not.toBe(key("https://example.com/b"));
  });

  it("returns null for missing or invalid URLs", () => {
    expect(key(null)).toBeNull();
    expect(key(undefined)).toBeNull();
    expect(key("not a url")).toBeNull();
  });
});
