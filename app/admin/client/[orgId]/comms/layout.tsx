"use client";

/**
 * Admin Comms — thin shell inside the client workspace.
 * The outer ClientContextProvider + ClientBanner + max-width container come
 * from app/admin/client/[orgId]/layout.tsx. This layer just adds the Comms
 * page title and the Alerts/Chat tab pills.
 */

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientContext } from "@/lib/use-client-context";

export default function AdminCommsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params.orgId as string;
  const { clientName } = useClientContext();

  const isChat = pathname?.includes("/comms/chat") ?? false;
  const isAlerts = pathname?.includes("/comms/alerts") ?? false;

  const base = `/admin/client/${orgId}/comms`;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Comms</h1>
        <p className="text-sm text-muted-foreground">
          Chat with {clientName} and manage alerts
        </p>
      </div>

      {/* Tab pills */}
      <div className="-mx-4 overflow-x-auto border-b border-border sm:mx-0 sm:overflow-visible">
        <div className="flex gap-2 px-4 pb-3 sm:px-0">
          <CommsTab href={`${base}/chat`} active={isChat} icon={MessageCircle}>
            Secure Chat
          </CommsTab>
          <CommsTab href={`${base}/alerts`} active={isAlerts} icon={MessageSquare}>
            Alerts
          </CommsTab>
        </div>
      </div>

      {children}
    </div>
  );
}

function CommsTab({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
