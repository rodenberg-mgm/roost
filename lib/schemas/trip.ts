import { z } from "zod";

export const createTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(100),
  starts_on: z.string().nullable(), // ISO date string or null for TBD
  ends_on: z.string().nullable(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  property_id: z.string().uuid().nullable().optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = createTripSchema.partial().extend({
  house_rules: z.string().max(5000).optional(),
  local_tips: z.string().max(5000).optional(),
  stocked_items: z.array(z.string()).optional(),
});

export type UpdateTripInput = z.infer<typeof updateTripSchema>;
