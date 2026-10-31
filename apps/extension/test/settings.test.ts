import { describe, expect, it } from "vitest";
import { RECENT_MAX, remember, type Recent } from "../src/lib/settings";

const entry = (id: string, at = 0): Recent => ({
  id,
  name: id,
  host: "Ana",
  at,
});

describe("remember", () => {
  it("puts the room first without duplicating it", () => {
    const list = [entry("a"), entry("b"), entry("c")];
    expect(remember(list, entry("b", 5)).map((room) => room.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("keeps only the most recent rooms", () => {
    const list = Array.from({ length: RECENT_MAX }, (_, index) =>
      entry(`r${index}`),
    );
    const next = remember(list, entry("new"));
    expect(next).toHaveLength(RECENT_MAX);
    expect(next[0].id).toBe("new");
    expect(next.at(-1)!.id).toBe(`r${RECENT_MAX - 2}`);
  });
});
