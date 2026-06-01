"use client";

import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface AddressParts {
  /** Street-level address line, e.g. "123 Vineyard Way" */
  addressLine: string;
  city: string;
  /** State / region */
  region: string;
  postalCode: string;
}

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (addressLine: string) => void;
  /** Fired when the host picks a suggestion — fills city/region/postal. */
  onSelect: (parts: AddressParts) => void;
  placeholder?: string;
}

interface MapboxFeature {
  properties: {
    name?: string; // street address line
    full_address?: string;
    context?: {
      place?: { name?: string };
      region?: { name?: string; region_code?: string };
      postcode?: { name?: string };
    };
  };
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Address input with Mapbox geocoding suggestions. Selecting a suggestion
 * fills the street line and reports city/region/postal back to the parent so
 * the public city/region fields can be prefilled (host can still override).
 *
 * Degrades to a plain text input when NEXT_PUBLIC_MAPBOX_TOKEN is unset.
 */
export function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  // Suppress the next fetch right after a selection (value change shouldn't re-query)
  const skipNextFetch = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced geocoding lookup
  useEffect(() => {
    if (!TOKEN) return;
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          `https://api.mapbox.com/search/geocode/v6/forward` +
          `?q=${encodeURIComponent(q)}` +
          `&access_token=${TOKEN}` +
          `&types=address&autocomplete=true&limit=5`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Mapbox ${res.status}`);
        const json = await res.json();
        setSuggestions(json.features || []);
        setOpen((json.features || []).length > 0);
        setActiveIdx(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(f: MapboxFeature) {
    const p = f.properties;
    const ctx = p.context || {};
    skipNextFetch.current = true;
    onChange(p.name || p.full_address || "");
    onSelect({
      addressLine: p.name || "",
      city: ctx.place?.name || "",
      region: ctx.region?.region_code || ctx.region?.name || "",
      postalCode: ctx.postcode?.name || "",
    });
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      choose(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        name="address_line"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "Start typing the address…"}
        autoComplete="off"
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-light/50" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-input border border-subtle bg-card shadow-card-hover"
          role="listbox"
        >
          {suggestions.map((f, i) => (
            <li key={i} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                onClick={() => choose(f)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === activeIdx ? "bg-sand/40" : "hover:bg-sand/30"
                }`}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest/60" />
                <span className="text-ink">{f.properties.full_address || f.properties.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
