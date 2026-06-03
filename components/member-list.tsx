"use client";

import { allowedMemberActions } from "@/lib/members/permissions";
import { setMemberRole, removeMember, transferHost, type Member } from "@/lib/actions/members";
import { Crown, Loader2, MoreVertical, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

interface MemberListProps {
  tripId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: "host" | "co-host" | "guest";
}

const ROLE_LABEL: Record<Member["role"], string> = {
  host: "Host",
  "co-host": "Co-host",
  guest: "Guest",
};

export function MemberList({ tripId, members, currentUserId, currentUserRole }: MemberListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: "remove" | "transfer-host"; member: Member } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actorIsPrimaryHost = members.some((m) => m.user_id === currentUserId && m.is_primary_host);

  useEffect(() => {
    if (openFor === null) return;
    const close = () => setOpenFor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFor(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openFor]);

  async function run(p: Promise<{ error?: string } | { data: unknown }>) {
    setBusy(true);
    setError(null);
    const res = await p;
    setBusy(false);
    setOpenFor(null);
    setConfirm(null);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <ul className="space-y-2.5">
      {members.map((m) => {
        const actions = allowedMemberActions({
          actorRole: currentUserRole,
          actorIsPrimaryHost,
          target: {
            role: m.role,
            isPrimaryHost: m.is_primary_host,
            joined: m.joined,
            isSelf: m.user_id === currentUserId,
          },
        });
        const initial = (m.name || "?").charAt(0).toUpperCase();
        return (
          <li key={m.user_id} className="relative flex items-center gap-3 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand font-display text-xs font-bold uppercase text-ink-light">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-ink">{m.name}</span>
              {m.email && <span className="block truncate text-xs text-ink-light">{m.email}</span>}
            </div>
            <span className="rounded-badge bg-sand/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-light">
              {m.is_primary_host ? "Host" : m.joined ? ROLE_LABEL[m.role] : "Invited"}
            </span>

            {actions.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={`Manage ${m.name}`}
                  onClick={() => setOpenFor(openFor === m.user_id ? null : m.user_id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-button text-ink-light transition-colors hover:bg-sand/50 hover:text-forest"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {openFor === m.user_id && (
                  <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-card border bg-card shadow-card" onPointerDown={(e) => e.stopPropagation()}>
                    {actions.includes("make-co-host") && (
                      <MenuItem icon={UserPlus} label="Make co-host" disabled={busy}
                        onClick={() => run(setMemberRole(tripId, m.user_id, "co-host"))} />
                    )}
                    {actions.includes("make-guest") && (
                      <MenuItem icon={UserMinus} label="Make guest" disabled={busy}
                        onClick={() => run(setMemberRole(tripId, m.user_id, "guest"))} />
                    )}
                    {actions.includes("transfer-host") && (
                      <MenuItem icon={Crown} label="Make host" disabled={busy}
                        onClick={() => { setOpenFor(null); setConfirm({ action: "transfer-host", member: m }); }} />
                    )}
                    {actions.includes("remove") && (
                      <MenuItem icon={Trash2} label="Remove from trip" destructive disabled={busy}
                        onClick={() => { setOpenFor(null); setConfirm({ action: "remove", member: m }); }} />
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}

      {error && <p className="text-xs text-brick">{error}</p>}

      {confirm && (
        <ConfirmOverlay
          busy={busy || isPending}
          title={confirm.action === "remove" ? `Remove ${confirm.member.name}?` : `Make ${confirm.member.name} the host?`}
          body={
            confirm.action === "remove"
              ? "They lose access to this trip. Their packing claims and meal signups are freed up; their photos stay."
              : "They become the host and you become a co-host. This can only be undone by the new host."
          }
          confirmLabel={confirm.action === "remove" ? "Remove" : "Make host"}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(
              confirm.action === "remove"
                ? removeMember(tripId, confirm.member.user_id)
                : transferHost(tripId, confirm.member.user_id)
            )
          }
        />
      )}
    </ul>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof UserPlus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-sand/40 disabled:opacity-50 ${
        destructive ? "text-brick" : "text-ink"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ConfirmOverlay({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-ink-light">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-button px-3 py-2 text-sm text-ink-light transition-colors hover:bg-sand/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-button bg-brick px-3 py-2 text-sm text-bone shadow-button transition-colors hover:bg-brick/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
