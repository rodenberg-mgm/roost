import type { GamePlanTask } from "@/lib/schemas/game-plan";

export type TaskState = "open" | "claimed" | "done";

export function taskState(task: GamePlanTask): TaskState {
  if (task.done) return "done";
  return task.owner_user_id ? "claimed" : "open";
}

/** Whole-day difference b - a for 'YYYY-MM-DD' strings (UTC, no TZ drift). */
function dayDiff(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((db - da) / 86_400_000);
}

export function dueStatus(
  task: GamePlanTask,
  today: string
): "overdue" | "soon" | "later" | null {
  if (task.done || !task.due_date) return null;
  const diff = dayDiff(today, task.due_date); // >0 future, <0 past
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "later";
}

/**
 * Sort for display: not-done before done; within not-done, soonest due first
 * with no-due last; ties broken by sort_order then created order (stable input).
 */
export function sortGamePlan(tasks: GamePlanTask[]): GamePlanTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due_date;
    const bd = b.due_date;
    if (ad && bd && ad !== bd) return ad < bd ? -1 : 1;
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;
    return a.sort_order - b.sort_order;
  });
}
