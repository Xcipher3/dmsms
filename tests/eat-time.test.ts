import { describe, expect, it } from "vitest";

import { toEatIso } from "@/lib/eat-time";

describe("toEatIso", () => {
  it("formats a UTC instant as an east african time ISO string", () => {
    expect(toEatIso(new Date("2026-01-15T12:00:00.000Z"))).toBe("2026-01-15T15:00:00.000+03:00");
  });

  it("preserves milliseconds", () => {
    expect(toEatIso(new Date("2026-06-10T08:15:30.123Z"))).toBe("2026-06-10T11:15:30.123+03:00");
  });

  it("rolls over midnight in the EAT wall clock", () => {
    expect(toEatIso(new Date("2026-12-31T22:30:00.000Z"))).toBe("2027-01-01T01:30:00.000+03:00");
  });

  it("defaults to the current instant with a +03:00 offset", () => {
    expect(toEatIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+03:00$/);
  });
});
