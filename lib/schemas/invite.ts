import { z } from "zod";

export const inviteRoleSchema = z.enum(["co-host", "guest"]);
export type InviteRole = z.infer<typeof inviteRoleSchema>;

export const sendInvitesSchema = z.object({
  trip_id: z.string().uuid(),
  emails: z.array(z.string().email("Invalid email")).min(1, "At least one email required"),
  // Role the invitee lands in when they join. Batch-level: one choice per send.
  role: inviteRoleSchema.default("guest"),
});

export type SendInvitesInput = z.infer<typeof sendInvitesSchema>;
