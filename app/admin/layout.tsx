"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Plus, ChevronRight, Loader2, UserCog,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { fetchClientProfiles, ClientProfile } from "@/lib/client-service";
import { useRole } from "@/lib/use-role";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin } = useRole();

  useEffect(() => {
    fetchClientProfiles().then((data) => {
      setClients(data);
      setIsLoading(false);
    });
  }, []);

  const isCommandCenter = pathname === "/admin";
  const isOnboard = pathname === "/admin/onboard";
  const isUsers = pathname === "/admin/users";

  // Inside a workspace — don't render sidebar
  const isWorkspace = pathname.startsWith("/admin/client/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      {isWorkspace ? (
        children
      ) : (
        <div className="mx-auto flex max-w-7xl gap-0 px-4 sm:px-6 lg:px-8">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 border-r border-border pt-8 pr-6 lg:block">
            <nav className="space-y-1">
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isCommandCenter
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Admin
              </Link>

              {/* Team nav — admin only */}
              {isAdmin && (
                <Link
                  href="/admin/users"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isUsers
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <UserCog className="h-4 w-4" />
                  Team
                </Link>
              )}

              <div className="pt-4">
                <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Principals
                </p>
                {isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  clients.map((client) => {
                    const isActive = pathname.startsWith(`/admin/client/${client.organization_id}`);
                    return (
                      <Link
                        key={client.id}
                        href={`/admin/client/${client.organization_id}`}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {client.display_name}
                        </div>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    );
                  })
                )}
              </div>

              {/* Onboard — admin only */}
              {isAdmin && (
                <div className="pt-2">
                  <Link
                    href="/admin/onboard"
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isOnboard
                        ? "bg-primary/10 text-primary"
                        : "text-primary/60 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Onboard Principal
                  </Link>
                </div>
              )}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 pt-8 lg:pl-8">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}
