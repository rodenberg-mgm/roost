// app/trip/[token]/join/complete/page.tsx
import { consumeInviteAndJoin } from "@/lib/actions/grants";
import { redirect } from "next/navigation";

interface CompletePageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinCompletePage({ params }: CompletePageProps) {
  const { token } = await params;
  const result = await consumeInviteAndJoin(token);

  if (result.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-ink-light">{result.error}</p>
        </div>
      </main>
    );
  }

  redirect(`/trips/${result.data!.tripId}`);
}
