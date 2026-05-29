"use client";

import { Eye } from "lucide-react";

interface SensitiveFieldProps {
  label: string;
  value: string | null;
  revealed: boolean;
  onRevealRequest: () => void;
}

export function SensitiveField({ label, value, revealed, onRevealRequest }: SensitiveFieldProps) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink-light">{label}</span>
      {revealed ? (
        <span className="font-mono text-sm text-ink">{value}</span>
      ) : (
        <button
          onClick={onRevealRequest}
          className="flex items-center gap-1 text-sm text-forest hover:text-forest-dark"
        >
          <span>••••••</span>
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
