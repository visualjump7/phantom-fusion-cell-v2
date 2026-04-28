"use client";

/**
 * Comms — unified top-level shell for structured alerts + real-time chat.
 *
 * Renders the shared chrome (Navbar + page header + pill tabs) and lets the
 * child route fill in the body. Tabs:
 *   /comms/chat    → real-time chat (default landing, per product decision)
 *   /comms/alerts  → structured alerts / decisions / approvals (unchanged)
 *
 * The /comms index page redirects to /comms/chat.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, MessageCircle, type LucideIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";

export default function CommsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/comms/chat") ?? false;
  const isAlerts = pathname?.startsWith("/comms/alerts") ?? false;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Navbar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        {/* Page header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-title font-bold text-foreground">Comms</h1>
            <p className="text-[length:var(--font-size-body)] text-muted-foreground">
              Chat with your team and respond to alerts
            </p>
          </div>
        </div>

        {/* Tab pills — horizontal-scrollable on mobile */}
        <div className="-mx-4 mb-6 overflow-x-auto border-b border-border sm:mx-0 sm:overflow-visible">
          <div className="flex gap-2 px-4 pb-3 sm:px-0">
            <CommsTab href="/comms/chat" active={isChat} icon={MessageCircle}>
              Secure Chat
            </CommsTab>
            <CommsTab href="/comms/alerts" active={isAlerts} icon={MessageSquare}>
              Alerts
            </CommsTab>
          </div>
        </div>

        {children}
      </motion.main>
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
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[length:var(--font-size-body)] font-medium transition-colors",
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
