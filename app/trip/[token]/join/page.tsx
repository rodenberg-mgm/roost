// app/trip/[token]/join/page.tsx
import { JoinForm } from "./join-form";
import { validateInviteToken } from "@/lib/trip-access/validate-token";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface JoinPageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const validation = await validateInviteToken(token);

  if (!validation.valid || !validation.tripId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            {validation.error || "Invalid invite"}
          </h1>
          <p className="mt-2 text-sm text-ink-light">
            Ask your host for a new invite link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <Link
          href={`/trip/${token}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to trip
        </Link>
        <JoinForm token={token} inviteEmail={validation.email} />
      </div>
    </main>
  );
}
