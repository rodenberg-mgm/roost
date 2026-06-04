// app/trip/[token]/join/join-form.tsx
"use client";

import { OtpCodeStep } from "@/components/auth/otp-code-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface JoinFormProps {
  token: string;
  inviteEmail: string | undefined;
}

export function JoinForm({ token, inviteEmail }: JoinFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail || "");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "code">("form");
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/trip/${token}/join/complete`,
        data: { display_name: name },
      },
    });
    if (authError) throw new Error(authError.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await sendCode();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      return;
    }

    setLoading(false);
    setStep("code");
  }

  if (step === "code") {
    return (
      <OtpCodeStep
        email={email}
        onVerified={() => router.push(`/trip/${token}/join/complete`)}
        onResend={sendCode}
        onChangeEmail={() => setStep("form")}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border bg-card p-6 shadow-card">
      <h2 className="mb-4 text-lg font-semibold text-ink">Join this trip</h2>
      <p className="mb-4 text-sm text-ink-light">
        Just your name and email — we&apos;ll send a 6-digit code (and a link).
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
            "Email me a code"
          )}
        </Button>
      </div>
    </form>
  );
}
