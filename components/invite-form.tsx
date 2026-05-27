"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendInvites } from "@/lib/actions/invites";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";

interface InviteFormProps {
  tripId: string;
}

export function InviteForm({ tripId }: InviteFormProps) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addEmail() {
    setEmails([...emails, ""]);
  }

  function updateEmail(index: number, value: string) {
    const updated = [...emails];
    updated[index] = value;
    setEmails(updated);
  }

  function removeEmail(index: number) {
    if (emails.length === 1) return;
    setEmails(emails.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    const validEmails = emails.filter((e) => e.trim().length > 0);
    if (validEmails.length === 0) {
      setError("Enter at least one email");
      setLoading(false);
      return;
    }

    const result = await sendInvites({
      trip_id: tripId,
      emails: validEmails,
    });

    setLoading(false);

    if (result.error) {
      const formError = (result.error as Record<string, string[]>)._form;
      setError(formError?.[0] || "Failed to send invites");
      return;
    }

    if (result.data) {
      setResults(result.data);
      const failedEmails = result.data
        .filter((r) => !r.success)
        .map((r) => r.email);
      setEmails(failedEmails.length > 0 ? failedEmails : [""]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Guest emails</Label>
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
              autoFocus={i === emails.length - 1}
            />
            {emails.length > 1 && (
              <button
                type="button"
                onClick={() => removeEmail(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button text-ink-light hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addEmail}
        className="flex items-center gap-1 text-sm text-fern hover:text-fern-dark"
      >
        <Plus className="h-4 w-4" />
        Add another
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <div className="space-y-1 rounded-card bg-page p-3">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.success ? (
                <Check className="h-4 w-4 text-fern" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className="text-ink">{r.email}</span>
              {r.error && <span className="text-xs text-ink-light">— {r.error}</span>}
            </div>
          ))}
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-fern text-white hover:bg-fern-dark"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending invites...
          </>
        ) : (
          "Send invites"
        )}
      </Button>
    </form>
  );
}
