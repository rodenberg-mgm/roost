export type MemberRole = "host" | "co-host" | "guest";

export type MemberAction = "make-co-host" | "make-guest" | "remove" | "transfer-host";

export interface MemberTarget {
  role: MemberRole;
  isPrimaryHost: boolean;
  joined: boolean;
  isSelf: boolean;
}

export interface AllowedActionsInput {
  actorRole: MemberRole;
  actorIsPrimaryHost: boolean;
  target: MemberTarget;
}

/**
 * The set of member-management actions an actor may take on a target.
 * Single source of truth shared by the server actions and the UI so the
 * guardrail rules never drift.
 */
export function allowedMemberActions(input: AllowedActionsInput): MemberAction[] {
  const { actorRole, actorIsPrimaryHost, target } = input;

  // Only hosts/co-hosts manage members.
  if (actorRole !== "host" && actorRole !== "co-host") return [];
  // The primary host is untouchable; you can't manage yourself here.
  if (target.isPrimaryHost || target.isSelf) return [];

  // A host-role member is always the primary host in our data model; if one ever
  // reaches here without that flag, deny rather than trust the inconsistent input.
  if (target.role === "host") return [];

  const actions: MemberAction[] = [];
  if (target.role === "guest") actions.push("make-co-host");
  if (target.role === "co-host") actions.push("make-guest");
  actions.push("remove");
  if (actorIsPrimaryHost && target.joined) actions.push("transfer-host");
  return actions;
}
