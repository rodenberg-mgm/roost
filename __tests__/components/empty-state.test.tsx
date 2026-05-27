import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/empty-state";
import { Map } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning your next adventure."
      />
    );
    expect(screen.getByText("No trips yet")).toBeDefined();
    expect(screen.getByText("Start planning your next adventure.")).toBeDefined();
  });

  it("renders optional action button", () => {
    render(
      <EmptyState
        icon={Map}
        title="No trips yet"
        description="Start planning."
        action={{ label: "Start a Trip", href: "/trips/new" }}
      />
    );
    expect(screen.getByText("Start a Trip")).toBeDefined();
  });
});
