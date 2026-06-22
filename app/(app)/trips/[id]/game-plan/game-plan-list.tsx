"use client";

import { GamePlanTaskRow } from "./game-plan-task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addTask,
  claimTask,
  deleteTask,
  getGamePlan,
  joinAsHelper,
  leaveAsHelper,
  releaseTask,
  setDone,
  setTaskDue,
  setTaskNote,
} from "@/lib/actions/game-plan";
import { sortGamePlan } from "@/lib/game-plan/derive";
import type { GamePlanTask } from "@/lib/schemas/game-plan";
import { useTripChannel } from "@/lib/realtime/use-trip-channel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus } from "lucide-react";
import { useCallback, useState } from "react";

const GAME_PLAN_TABLES = ["game_plan_tasks", "game_plan_task_helpers"];

interface GamePlanListProps {
  tripId: string;
  initialTasks: GamePlanTask[];
  currentUserId: string;
  isHost: boolean;
}

export function GamePlanList({
  tripId,
  initialTasks,
  currentUserId,
  isHost,
}: GamePlanListProps) {
  const queryClient = useQueryClient();
  const queryKey = ["game-plan", tripId];

  const { data: tasks = [] } = useQuery({
    queryKey,
    queryFn: () => getGamePlan(tripId),
    initialData: initialTasks,
    // Treat server-hydrated data as immediately stale so realtime invalidations
    // refetch on remount instead of serving 30s-old data.
    initialDataUpdatedAt: 0,
  });

  // Stable callback so the realtime channel doesn't resubscribe each render.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game-plan", tripId] });
  }, [queryClient, tripId]);
  useTripChannel(tripId, GAME_PLAN_TABLES, invalidate);

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["game-plan", tripId] });

  const claim = useMutation({ mutationFn: (id: string) => claimTask(id), onSettled: refetch });
  const release = useMutation({ mutationFn: (id: string) => releaseTask(id), onSettled: refetch });
  const done = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => setDone({ task_id: v.id, done: v.done }),
    onSettled: refetch,
  });
  const join = useMutation({ mutationFn: (id: string) => joinAsHelper(id), onSettled: refetch });
  const leave = useMutation({ mutationFn: (id: string) => leaveAsHelper(id), onSettled: refetch });
  const saveNote = useMutation({
    mutationFn: (v: { id: string; note: string | null }) =>
      setTaskNote({ task_id: v.id, note: v.note }),
    onSettled: refetch,
  });
  const saveDue = useMutation({
    mutationFn: (v: { id: string; due: string | null }) =>
      setTaskDue({ task_id: v.id, due_date: v.due }),
    onSettled: refetch,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteTask(id), onSettled: refetch });

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      const res = await addTask({
        trip_id: tripId,
        title: title.trim(),
        due_date: due || null,
      });
      if ("error" in res && res.error) {
        const err = res.error as unknown;
        const msg =
          typeof err === "string"
            ? err
            : (err as { _form?: string[] })._form?.[0] ?? "Couldn't add to-do";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      setTitle("");
      setDue("");
      setAdding(false);
      setAddError(null);
    },
    onError: (e: Error) => setAddError(e.message),
    onSettled: refetch,
  });

  // Single "today" for all rows; local date in YYYY-MM-DD.
  const today = new Date().toLocaleDateString("en-CA");
  const ordered = sortGamePlan(tasks);

  return (
    <div className="space-y-4">
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
          className="rounded-card border bg-card p-4 shadow-card"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">What needs doing?</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book the Saturday tee time"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Needed by (optional)</Label>
              <Input
                id="task-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            {addError && <p className="text-sm text-brick">{addError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAdding(false);
                  setAddError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-forest text-white hover:bg-forest-dark"
                disabled={!title.trim() || add.isPending}
              >
                Add to-do
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full gap-1.5 bg-forest text-white hover:bg-forest-dark"
        >
          <Plus className="h-4 w-4" />
          Add a to-do
        </Button>
      )}

      {ordered.length === 0 ? (
        <div className="topo-bg rounded-card border bg-card p-8 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-sage" />
          <h2 className="mt-3 font-semibold text-ink">Nothing to plan yet</h2>
          <p className="mt-1 text-sm text-ink-light">
            Add the first to-do — tee times, tickets, reservations. Anyone can claim it.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {ordered.map((task) => (
            <GamePlanTaskRow
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              isHost={isHost}
              today={today}
              tripId={tripId}
              onClaim={(id) => claim.mutate(id)}
              onRelease={(id) => release.mutate(id)}
              onToggleDone={(id, d) => done.mutate({ id, done: d })}
              onJoin={(id) => join.mutate(id)}
              onLeave={(id) => leave.mutate(id)}
              onSaveNote={(id, note) => saveNote.mutate({ id, note })}
              onSaveDue={(id, d) => saveDue.mutate({ id, due: d })}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
