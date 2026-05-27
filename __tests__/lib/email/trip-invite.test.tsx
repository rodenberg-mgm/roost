import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";
import { TripInviteEmail } from "@/lib/email/templates/trip-invite";

describe("TripInviteEmail", () => {
  it("renders the trip name", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("Sonoma Weekend");
  });

  it("renders the host name", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("Matt");
  });

  it("renders the view trip URL", async () => {
    const html = await render(
      <TripInviteEmail
        tripName="Sonoma Weekend"
        hostName="Matt"
        tripDates="May 16 – May 18, 2025"
        viewUrl="https://roost.app/trip/abc123"
      />
    );
    expect(html).toContain("https://roost.app/trip/abc123");
  });
});
