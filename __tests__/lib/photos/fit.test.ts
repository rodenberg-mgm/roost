import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/photos/fit";

describe("fitWithin", () => {
  it("downscales a landscape image to the max longest edge", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it("downscales a portrait image to the max longest edge", () => {
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never upscales below the max", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("rounds to whole pixels", () => {
    expect(fitWithin(1000, 333, 400)).toEqual({ width: 400, height: 133 });
  });
});
