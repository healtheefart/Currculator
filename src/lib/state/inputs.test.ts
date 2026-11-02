import { describe, expect, it } from "vitest";
import { parseMinutes, parseMultiplier } from "./inputs";

describe("parseMinutes", () => {
  it.each([
    ["60", 60],
    [" 0 ", 0],
    ["1440", 1440],
    ["007", 7],
  ])("%j → %d", (text, expected) => {
    expect(parseMinutes(text)).toBe(expected);
  });

  it.each(["", " ", "-1", "1441", "1.5", "abc", "6 0", "1e2"])("%j → null", (text) => {
    expect(parseMinutes(text)).toBeNull();
  });
});

describe("parseMultiplier", () => {
  it.each([
    ["1.5", 1.5],
    [".5", 0.5],
    ["5", 5],
    [" 2 ", 2],
    ["0.5", 0.5],
  ])("%j → %d", (text, expected) => {
    expect(parseMultiplier(text)).toBe(expected);
  });

  it.each(["0.4", "5.1", "1,5", "", "-1", "1.", "abc", "1e0"])("%j → null", (text) => {
    expect(parseMultiplier(text)).toBeNull();
  });
});
