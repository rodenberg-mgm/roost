"use client";

import { resendInvite, revokeInvite } from "@/lib/actions/invites";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface InviteRow {
  id: string;
  email: string;
  consumed_at: string | null;
}

export function InviteList({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    id: string;
    text: string;
    ok: boolean;
  } | null>(null);

  async function handleResend(id: string) {
    setBusyId(id);
    setFeedback(null);
    const res = await resendInvite(id);
    setBusyId(null);
    setFeedback({ id, text: res.error ?? "Invite resent", ok: !res.error });
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    setFeedback(null);
    const res = await revokeInvite(id);
    setBusyId(null);
    if (res.error) {
      setFeedback({ id, text: res.error, ok: false });
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <ul className="space-y-2">
      {invites.map((inv) => {
        const joined = !!inv.consumed_at;
        const busy = busyId === inv.id || isPending;
        return (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <span className="block truncate text-ink">{inv.email}</span>
              {feedback?.id === inv.id && (
                <span
                  className={`text-xs ${feedback.ok ? "text-forest" : "text-brick"}`}
                >
                  {feedback.text}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className="rounded-badge bg-sand/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
                {joined ? "Joined" : "Pending"}
              </span>
              {!joined && (
                <>
                  <button
                    type="button"
                    onClick={() => handleResend(inv.id)}
                    disabled={busy}
                    title="Resend email"
                    aria-label={`Resend invite to ${inv.email}`}
                    className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest disabled:opacity-50"
                  >
                    {busyId === inv.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    disabled={busy}
                    title="Remove invite"
                    aria-label={`Remove invite to ${inv.email}`}
                    className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-brick/10 hover:text-brick disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
