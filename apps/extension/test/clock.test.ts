import { describe, expect, it } from "vitest";
import { offset, sample } from "../src/lib/clock";

describe("clock", () => {
  it("is zero without samples", () => {
    expect(offset([])).toBe(0);
  });

  it("keeps the lowest-latency sample, which is the largest", () => {
    const samples = [500, 480, 530, 510].reduce(sample, [] as number[]);
    expect(offset(samples)).toBe(530);
  });

  it("forgets samples outside the window", () => {
    const samples = [900, ...Array(10).fill(100)].reduce(
      sample,
      [] as number[],
    );
    expect(offset(samples)).toBe(100);
  });
});
