// app/trip/[token]/join/join-form.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";

interface JoinFormProps {
  token: string;
  inviteEmail: string | undefined;
}

export function JoinForm({ token, inviteEmail }: JoinFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail || "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/trip/${token}/join/complete`,
        data: {
          display_name: name,
        },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-card border bg-card p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-forest/10">
          <Mail className="h-6 w-6 text-forest" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Check your email</h2>
        <p className="mt-2 text-sm text-ink-light">
          We sent a link to <strong>{email}</strong>. Click it to join the trip.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border bg-card p-6 shadow-card">
      <h2 className="mb-4 text-lg font-semibold text-ink">Join this trip</h2>
      <p className="mb-4 text-sm text-ink-light">
        Just your name and email — we&apos;ll send a link to confirm.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="join-email">Email</Label>
          <Input
            id="join-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          className="w-full bg-forest text-white hover:bg-forest-dark"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send magic link"
          )}
        </Button>
      </div>
    </form>
  );
}
