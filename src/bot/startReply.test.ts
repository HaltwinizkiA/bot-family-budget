import { describe, expect, it } from "vitest";
import { startReply } from "./startReply.js";

const link = "https://t.me/FamilyBudgetBot?startapp";

describe("startReply", () => {
  it("returns the current link reply only for an allowed id", () => {
    expect(startReply(111, new Set([111]), link)).toBe(
      "Семейный бюджет\nhttps://t.me/FamilyBudgetBot?startapp",
    );
    expect(startReply(222, new Set([111]), link)).toBeUndefined();
    expect(startReply(undefined, new Set([111]), link)).toBeUndefined();
    expect(startReply(111, new Set(), link)).toBeUndefined();
  });
});
