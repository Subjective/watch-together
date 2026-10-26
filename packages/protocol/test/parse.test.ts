import { describe, expect, it } from "vitest";
import { LIMITS, parse } from "../src";

describe("parse", () => {
  it("accepts well-formed messages and trims names", () => {
    expect(parse('{"type":"join","name":"  Ana "}')).toEqual({
      type: "join",
      name: "Ana",
      resume: undefined,
      room: undefined,
    });
    expect(
      parse(
        '{"type":"playback","url":null,"playing":false,"position":0,"rate":1}',
      ),
    ).toMatchObject({ url: null });
  });

  it("rejects malformed, oversized and out-of-range input", () => {
    expect(parse("{nope")).toBeNull();
    expect(parse("null")).toBeNull();
    expect(parse('{"type":"join","name":""}')).toBeNull();
    expect(
      parse(
        JSON.stringify({ type: "join", name: "x".repeat(LIMITS.userName + 1) }),
      ),
    ).toBeNull();
    expect(
      parse(
        '{"type":"playback","url":"https://a.test","playing":true,"position":-1,"rate":1}',
      ),
    ).toBeNull();
    expect(
      parse(
        '{"type":"playback","url":"https://a.test","playing":true,"position":1,"rate":0}',
      ),
    ).toBeNull();
    expect(parse('{"type":"mode","mode":"chaos"}')).toBeNull();
    expect(parse(" ".repeat(LIMITS.message + 1))).toBeNull();
  });
});
