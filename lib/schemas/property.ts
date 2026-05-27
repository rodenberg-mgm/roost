import { z } from "zod";

export const createPropertySchema = z.object({
  name: z.string().min(1, "Property name is required").max(100),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  house_rules: z.string().max(5000).optional(),
  local_tips: z.string().max(5000).optional(),
  stocked_items: z.array(z.string()).optional(),
  // Sensitive fields
  wifi_ssid: z.string().max(100).optional(),
  wifi_password: z.string().max(100).optional(),
  door_code: z.string().max(50).optional(),
  gate_code: z.string().max(50).optional(),
  address_line: z.string().max(200).optional(),
  postal_code: z.string().max(20).optional(),
  parking_notes: z.string().max(1000).optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = Partial<CreatePropertyInput>;
