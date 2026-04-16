"use client";

import { useState, useRef, useEffect } from "react";
import { searchAirports } from "@/lib/airports";
import type { Airport } from "@/lib/travel-types";

interface AirportSearchProps {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport) => void;
  placeholder?: string;
}

export function AirportSearch({ label, value, onChange, placeholder = "Search airport..." }: AirportSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(q: string) {
    setQuery(q);
    setResults(searchAirports(q));
    setOpen(q.length > 0);
  }

  function handleSelect(ap: Airport) {
    onChange(ap);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {value ? (
        <button
          type="button"
          onClick={() => { onChange(null as unknown as Airport); setQuery(""); }}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors text-left"
        >
          <span className="font-bold text-primary">{value.code}</span>
          <span className="text-muted-foreground truncate">{value.city}</span>
          <span className="ml-auto text-xs text-muted-foreground">&times;</span>
        </button>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {results.map((ap) => (
            <li key={ap.code}>
              <button
                type="button"
                onClick={() => handleSelect(ap)}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted/40 transition-colors text-left"
              >
                <span className="font-bold text-primary w-10">{ap.code}</span>
                <span className="flex-1 truncate">{ap.city}, {ap.country}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{ap.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
