"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { SearchBar } from "@/components/search/SearchBar";

interface DashboardSearchBarProps {
  organizationId: string;
}

export function DashboardSearchBar({ organizationId }: DashboardSearchBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Also listen for Cmd+K so this mirrors the Navbar behavior on the globe page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClick = useCallback(() => {
    setSearchOpen(true);
  }, []);

  return (
    <>
      <button
        onClick={handleClick}
        className={`
          fixed bottom-20 left-1/2 -translate-x-1/2 z-30
          flex items-center gap-3
          w-[min(600px,calc(100vw-2rem))]
          rounded-xl
          bg-black/60 backdrop-blur-[20px]
          border border-white/10
          px-4 py-3
          cursor-pointer
          transition-all duration-200
          hover:border-[var(--accent-primary)]
          ${searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
        `}
        type="button"
      >
        <Search className="h-4 w-4 text-white/40 shrink-0" />

        <span className="text-white/40 text-sm select-none flex-1 text-left">
          Ask your Fusion Cell anything...
        </span>

        {/* Cmd+K badge — hidden on mobile */}
        <span className="hidden sm:flex items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-white/40 font-medium select-none shrink-0">
          <kbd>&#8984;K</kbd>
        </span>
      </button>

      <SearchBar
        organizationId={organizationId}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
