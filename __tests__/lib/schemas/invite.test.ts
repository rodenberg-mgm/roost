import { describe, expect, it } from "vitest";
import { sendInvitesSchema } from "@/lib/schemas/invite";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

describe("sendInvitesSchema", () => {
  it("defaults role to guest when omitted", () => {
    const parsed = sendInvitesSchema.parse({
      trip_id: TRIP_ID,
      emails: ["friend@example.com"],
    });
    expect(parsed.role).toBe("guest");
  });

  it("accepts an explicit co-host role", () => {
    const parsed = sendInvitesSchema.parse({
      trip_id: TRIP_ID,
      emails: ["cohost@example.com"],
      role: "co-host",
    });
    expect(parsed.role).toBe("co-host");
  });

  it("rejects host as an invite role (host is transfer-only)", () => {
    const res = sendInvitesSchema.safeParse({
      trip_id: TRIP_ID,
      emails: ["x@example.com"],
      role: "host",
    });
    expect(res.success).toBe(false);
  });
});
