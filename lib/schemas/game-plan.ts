import { z } from "zod";

export const addTaskSchema = z.object({
  trip_id: z.string().uuid(),
  title: z.string().min(1, "Give the to-do a name").max(200),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
  // Soft source reference for cross-page creation (e.g. a meal slot). Both or neither.
  source_kind: z.string().max(40).nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
});
export type AddTaskInput = z.infer<typeof addTaskSchema>;

export const setTaskNoteSchema = z.object({
  task_id: z.string().uuid(),
  // Empty string from the input is normalized to null (clears the note).
  note: z.string().max(280).nullable(),
});
export type SetTaskNoteInput = z.infer<typeof setTaskNoteSchema>;

export const setTaskDueSchema = z.object({
  task_id: z.string().uuid(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable(),
});
export type SetTaskDueInput = z.infer<typeof setTaskDueSchema>;

// Shared shapes returned by getGamePlan and consumed by derive + UI.
export interface GamePlanHelper {
  id: string;
  user_id: string;
  user_name: string;
}

export interface GamePlanTask {
  id: string;
  title: string;
  owner_user_id: string | null;
  owner_name: string | null;
  note: string | null;
  due_date: string | null; // 'YYYY-MM-DD'
  done: boolean;
  created_by_user_id: string;
  source_kind: string | null;
  source_id: string | null;
  sort_order: number;
  helpers: GamePlanHelper[];
}
