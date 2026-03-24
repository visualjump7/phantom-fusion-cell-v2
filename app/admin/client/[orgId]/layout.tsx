"use client";

import { useParams } from "next/navigation";
import { ClientContextProvider } from "@/lib/client-context";
import { ClientBanner } from "@/components/admin/shared/ClientBanner";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <ClientContextProvider orgId={orgId}>
      <ClientBanner />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </ClientContextProvider>
  );
}
