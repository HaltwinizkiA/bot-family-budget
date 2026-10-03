import { describe, expect, it } from "vitest";
import { parseAllowedUserIds } from "./allowedUserIds.js";

describe("parseAllowedUserIds", () => {
  it("returns an empty set when the variable is missing, empty, or has no integers", () => {
    expect(parseAllowedUserIds({})).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "" })).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "   " })).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: ",,," })).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "abc" })).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "1.5,1e2,+7,-1,0x10" })).toEqual(new Set());
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "9007199254740993" })).toEqual(new Set());
  });

  it("trims items, skips empty and non-integer items, and keeps integer neighbors", () => {
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "111,222" })).toEqual(new Set([111, 222]));
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: " 111 , , 222 " })).toEqual(new Set([111, 222]));
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "111,abc,222" })).toEqual(new Set([111, 222]));
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "111,1e2,222" })).toEqual(new Set([111, 222]));
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "007" })).toEqual(new Set([7]));
    expect(parseAllowedUserIds({ ALLOWED_USER_IDS: "111,111" })).toEqual(new Set([111]));
  });
});
