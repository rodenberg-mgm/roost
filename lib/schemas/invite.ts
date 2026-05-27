import { z } from "zod";

export const sendInvitesSchema = z.object({
  trip_id: z.string().uuid(),
  emails: z.array(z.string().email("Invalid email")).min(1, "At least one email required"),
});

export type SendInvitesInput = z.infer<typeof sendInvitesSchema>;
