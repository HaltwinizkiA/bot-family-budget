import { describe, expect, it } from "vitest";
import { createdBy } from "./author.js";

describe("createdBy", () => {
  it("stores the username without @", () => {
    expect(createdBy({ id: 7, username: "anna" })).toBe("anna");
    expect(createdBy({ id: 7, username: "@anna" })).toBe("anna");
  });

  it("falls back to the numeric id when the username is missing", () => {
    expect(createdBy({ id: 42, username: "" })).toBe("id:42");
    expect(createdBy({ id: 42 })).toBe("id:42");
  });
});
