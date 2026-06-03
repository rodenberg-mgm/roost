import { describe, expect, it } from "vitest";
import { allowedMemberActions } from "@/lib/members/permissions";

const target = (over = {}) => ({
  role: "guest" as const,
  isPrimaryHost: false,
  joined: true,
  isSelf: false,
  ...over,
});

describe("allowedMemberActions", () => {
  it("gives a guest actor no actions", () => {
    expect(
      allowedMemberActions({ actorRole: "guest", actorIsPrimaryHost: false, target: target() })
    ).toEqual([]);
  });

  it("never allows acting on the primary host", () => {
    expect(
      allowedMemberActions({
        actorRole: "host",
        actorIsPrimaryHost: true,
        target: target({ role: "host", isPrimaryHost: true }),
      })
    ).toEqual([]);
  });

  it("never allows acting on yourself", () => {
    expect(
      allowedMemberActions({
        actorRole: "co-host",
        actorIsPrimaryHost: false,
        target: target({ role: "co-host", isSelf: true }),
      })
    ).toEqual([]);
  });

  it("lets a host promote a guest to co-host (and remove)", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "guest" }) })
    ).toEqual(["make-co-host", "remove", "transfer-host"]);
  });

  it("lets a host demote a co-host to guest (and remove)", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "co-host" }) })
    ).toEqual(["make-guest", "remove", "transfer-host"]);
  });

  it("offers transfer-host only to the primary host on a joined target", () => {
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ role: "co-host" }) })
    ).toContain("transfer-host");
    // a co-host (not primary host) cannot transfer
    expect(
      allowedMemberActions({ actorRole: "co-host", actorIsPrimaryHost: false, target: target({ role: "guest" }) })
    ).not.toContain("transfer-host");
    // not offered on a not-yet-joined member
    expect(
      allowedMemberActions({ actorRole: "host", actorIsPrimaryHost: true, target: target({ joined: false }) })
    ).not.toContain("transfer-host");
  });

  it("lets a co-host promote/remove a guest but not transfer host", () => {
    expect(
      allowedMemberActions({ actorRole: "co-host", actorIsPrimaryHost: false, target: target({ role: "guest" }) })
    ).toEqual(["make-co-host", "remove"]);
  });

  it("denies all actions on a host-role target that isn't the primary host", () => {
    expect(
      allowedMemberActions({
        actorRole: "host",
        actorIsPrimaryHost: true,
        target: target({ role: "host", isPrimaryHost: false }),
      })
    ).toEqual([]);
  });
});
