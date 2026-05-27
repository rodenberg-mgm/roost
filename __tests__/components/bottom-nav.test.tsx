import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { BottomNav } from "@/components/bottom-nav";

describe("BottomNav", () => {
  it("renders My Trips and Settings links", () => {
    render(<BottomNav />);
    expect(screen.getByText("My Trips")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("highlights the active route", () => {
    render(<BottomNav />);
    const myTrips = screen.getByText("My Trips").closest("a");
    expect(myTrips?.className).toContain("text-fern");
  });
});
