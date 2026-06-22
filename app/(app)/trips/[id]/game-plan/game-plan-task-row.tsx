"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { taskState, dueStatus } from "@/lib/game-plan/derive";
import type { GamePlanTask } from "@/lib/schemas/game-plan";
import { Check, CornerUpRight, Pencil, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface GamePlanTaskRowProps {
  task: GamePlanTask;
  currentUserId: string;
  isHost: boolean;
  today: string;
  onClaim: (taskId: string) => void;
  onRelease: (taskId: string) => void;
  onToggleDone: (taskId: string, done: boolean) => void;
  onJoin: (taskId: string) => void;
  onLeave: (taskId: string) => void;
  onSaveNote: (taskId: string, note: string | null) => void;
  onSaveDue: (taskId: string, due: string | null) => void;
  onDelete: (taskId: string) => void;
  tripId: string;
}

function formatDue(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function GamePlanTaskRow({
  task,
  currentUserId,
  isHost,
  today,
  onClaim,
  onRelease,
  onToggleDone,
  onJoin,
  onLeave,
  onSaveNote,
  onSaveDue,
  onDelete,
  tripId,
}: GamePlanTaskRowProps) {
  const state = taskState(task);
  const due = dueStatus(task, today);
  const isOwner = task.owner_user_id === currentUserId;
  const isHelper = task.helpers.some((h) => h.user_id === currentUserId);
  const canManage = isOwner || isHost; // edit note/due, toggle done
  const canDelete = isHost || task.created_by_user_id === currentUserId;

  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(task.note ?? "");
  const [dueInput, setDueInput] = useState(task.due_date ?? "");

  const duePillClass =
    due === "overdue"
      ? "bg-brick/10 text-brick"
      : due === "soon"
        ? "bg-brick/10 text-brick"
        : "bg-sage/20 text-forest";

  return (
    <li
      className={`rounded-card border bg-card p-4 shadow-card ${
        state === "done" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium text-ink ${
                state === "done" ? "line-through" : ""
              }`}
            >
              {task.title}
            </span>
            {task.due_date && (
              <span
                className={`shrink-0 rounded-badge px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider ${duePillClass}`}
              >
                {due === "overdue" ? "Overdue · " : ""}
                {formatDue(task.due_date)}
              </span>
            )}
          </div>

          {/* Owner / helpers line */}
          <p className="mt-0.5 text-xs text-ink-light">
            {state === "open"
              ? "Nobody's on this yet"
              : `${task.owner_name ?? "Someone"} has it${
                  task.helpers.length > 0
                    ? ` · +${task.helpers.length} helping`
                    : ""
                }`}
          </p>

          {/* Source chip */}
          {task.source_kind === "meal" && (
            <Link
              href={`/trips/${tripId}/meals`}
              className="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light transition-colors hover:text-forest"
            >
              <CornerUpRight className="h-3 w-3" />
              From Meals
            </Link>
          )}

          {/* Note (read) */}
          {task.note && !editing && (
            <p className="mt-2 whitespace-pre-wrap text-sm italic text-ink-light">
              {task.note}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canManage && !editing && (
            <button
              type="button"
              onClick={() => {
                setNote(task.note ?? "");
                setDueInput(task.due_date ?? "");
                setEditing(true);
              }}
              title="Edit note & due date"
              aria-label="Edit note and due date"
              className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              title="Remove to-do"
              aria-label={`Remove ${task.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Edit form (note + due) */}
      {editing && (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor={`note-${task.id}`} className="text-sm text-ink-light">
              Note
            </label>
            <textarea
              id={`note-${task.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Booked 9:10am, confirmation #ABC123"
              className="w-full rounded-input border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`due-${task.id}`} className="text-sm text-ink-light">
              Needed by (optional)
            </label>
            <Input
              id={`due-${task.id}`}
              type="date"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setNote(task.note ?? "");
                setDueInput(task.due_date ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-forest text-white hover:bg-forest-dark"
              onClick={() => {
                onSaveNote(task.id, note.trim() ? note.trim() : null);
                onSaveDue(task.id, dueInput || null);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Action row */}
      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state === "open" ? (
            <Button
              type="button"
              className="h-11 gap-1 bg-forest text-sm text-white hover:bg-forest-dark"
              onClick={() => onClaim(task.id)}
            >
              <Check className="h-4 w-4" />
              I&apos;ll do this
            </Button>
          ) : (
            <>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onToggleDone(task.id, !task.done)}
                  className={`flex min-h-11 items-center gap-1 rounded-badge px-3 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider transition-colors ${
                    task.done
                      ? "bg-forest/10 text-forest"
                      : "bg-sand/50 text-ink-light hover:text-forest"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {task.done ? "Done" : "Mark done"}
                </button>
              )}
              {isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-1 text-xs"
                  onClick={() => onRelease(task.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  Let go
                </Button>
              )}
              {!isOwner &&
                (isHelper ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1 text-xs"
                    onClick={() => onLeave(task.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Stop helping
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1 text-xs"
                    onClick={() => onJoin(task.id)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    I can help
                  </Button>
                ))}
            </>
          )}
        </div>
      )}
    </li>
  );
}
