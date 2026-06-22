import { describe, expect, it } from "vitest";
import { taskState, dueStatus, sortGamePlan } from "@/lib/game-plan/derive";
import type { GamePlanTask } from "@/lib/schemas/game-plan";

function task(p: Partial<GamePlanTask>): GamePlanTask {
  return {
    id: "t",
    title: "Book tee time",
    owner_user_id: null,
    owner_name: null,
    note: null,
    due_date: null,
    done: false,
    created_by_user_id: "u0",
    source_kind: null,
    source_id: null,
    sort_order: 0,
    helpers: [],
    ...p,
  };
}

describe("taskState", () => {
  it("open when no owner and not done", () => {
    expect(taskState(task({}))).toBe("open");
  });
  it("claimed when owner set and not done", () => {
    expect(taskState(task({ owner_user_id: "u1" }))).toBe("claimed");
  });
  it("done when done is true regardless of owner", () => {
    expect(taskState(task({ owner_user_id: "u1", done: true }))).toBe("done");
    expect(taskState(task({ owner_user_id: null, done: true }))).toBe("done");
  });
});

describe("dueStatus", () => {
  const today = "2026-06-22";
  it("null when no due date", () => {
    expect(dueStatus(task({}), today)).toBeNull();
  });
  it("null when task is done even if past due", () => {
    expect(dueStatus(task({ due_date: "2026-06-01", done: true }), today)).toBeNull();
  });
  it("overdue when due before today", () => {
    expect(dueStatus(task({ due_date: "2026-06-21" }), today)).toBe("overdue");
  });
  it("soon when due today or within 2 days", () => {
    expect(dueStatus(task({ due_date: "2026-06-22" }), today)).toBe("soon");
    expect(dueStatus(task({ due_date: "2026-06-24" }), today)).toBe("soon");
  });
  it("later when due more than 2 days out", () => {
    expect(dueStatus(task({ due_date: "2026-06-25" }), today)).toBe("later");
  });
});

describe("sortGamePlan", () => {
  const today = "2026-06-22";
  it("done tasks sink below not-done", () => {
    const out = sortGamePlan(
      [task({ id: "done", done: true }), task({ id: "open" })],
      today
    );
    expect(out.map((t) => t.id)).toEqual(["open", "done"]);
  });
  it("among not-done, soonest due first and nulls last", () => {
    const out = sortGamePlan(
      [
        task({ id: "nodue" }),
        task({ id: "late", due_date: "2026-07-01" }),
        task({ id: "early", due_date: "2026-06-23" }),
      ],
      today
    );
    expect(out.map((t) => t.id)).toEqual(["early", "late", "nodue"]);
  });
  it("falls back to sort_order when due dates tie", () => {
    const out = sortGamePlan(
      [
        task({ id: "b", due_date: "2026-06-23", sort_order: 2 }),
        task({ id: "a", due_date: "2026-06-23", sort_order: 1 }),
      ],
      today
    );
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
