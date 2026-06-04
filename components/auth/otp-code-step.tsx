"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";

interface OtpCodeStepProps {
  email: string;
  /** Called after a successful verifyOtp (session is now set). */
  onVerified: () => void;
  /** Re-send the code (parent re-calls signInWithOtp with the same options). */
  onResend: () => Promise<void>;
  /** Go back to the email/name step. */
  onChangeEmail: () => void;
}

export function OtpCodeStep({ email, onVerified, onResend, onChangeEmail }: OtpCodeStepProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error: vErr } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (vErr) {
      setVerifying(false);
      setError("That code didn't match. Check the email or resend a new one.");
      return;
    }
    // Session cookie is now set by the ssr browser client; let the parent navigate.
    onVerified();
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      await onResend();
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleVerify} className="rounded-card border bg-card p-6 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-forest/10">
        <Mail className="h-6 w-6 text-forest" />
      </div>
      <h2 className="text-lg font-semibold text-ink">Check your email</h2>
      <p className="mt-2 text-sm text-ink-light">
        Enter the 6-digit code we sent to <strong>{email}</strong>, or just click the link in the email.
      </p>

      <div className="mt-5 space-y-2 text-left">
        <Label htmlFor="otp-code">6-digit code</Label>
        <Input
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          autoFocus
          className="text-center text-lg tracking-[0.4em]"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        className="mt-4 w-full bg-forest text-white hover:bg-forest-dark"
        disabled={verifying || code.length < 6}
      >
        {verifying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify & continue"
        )}
      </Button>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-light">
        <button type="button" onClick={onChangeEmail} className="transition-colors hover:text-forest">
          ← Change email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="transition-colors hover:text-forest disabled:opacity-50"
        >
          {resending ? "Resending…" : "Resend code"}
        </button>
      </div>
    </form>
  );
}
