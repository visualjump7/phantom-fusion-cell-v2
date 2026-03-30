"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientContext } from "@/lib/use-client-context";
import { useRole } from "@/lib/use-role";
import {
  fetchDelegates,
  removeDelegate,
  DelegateUser,
} from "@/lib/delegate-service";
import { InviteDelegateModal } from "@/components/admin/shared/InviteDelegateModal";
import { EditDelegateAccessModal } from "@/components/admin/shared/EditDelegateAccessModal";

export default function DelegatesPage() {
  const { orgId, clientName } = useClientContext();
  const { isAdmin, userId } = useRole();
  const [delegates, setDelegates] = useState<DelegateUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editTarget, setEditTarget] = useState<DelegateUser | null>(null);

  const loadDelegates = async () => {
    setIsLoading(true);
    const data = await fetchDelegates(orgId);
    setDelegates(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDelegates();
  }, [orgId]);

  const handleRemove = async (delegateUserId: string) => {
    await removeDelegate(delegateUserId, orgId);
    setMenuOpen(null);
    loadDelegates();
  };

  const categoryColors: Record<string, string> = {
    family: "bg-emerald-600/20 text-emerald-400",
    business: "bg-blue-600/20 text-blue-400",
    personal: "bg-violet-600/20 text-violet-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delegate Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Users with limited, project-specific access for {clientName}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Delegate
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : delegates.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              No delegates yet. Add a delegate to grant limited project access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {delegates.map((d) => (
            <Card key={d.user_id} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/10 text-amber-400 text-sm font-bold">
                    {d.full_name?.[0]?.toUpperCase() || "D"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{d.full_name || d.email}</p>
                      <Badge variant="outline" className="text-[10px] bg-amber-600/20 text-amber-400 border-amber-600/30">
                        delegate
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${d.status === "active" ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}`}>
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.email}</p>
                    {d.assigned_assets.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.assigned_assets.map((a) => (
                          <span
                            key={a.id}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColors[a.category] || "bg-muted text-muted-foreground"}`}
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === d.user_id ? null : d.user_id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen === d.user_id && (
                      <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg">
                        <button
                          onClick={() => { setEditTarget(d); setMenuOpen(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit Access
                        </button>
                        <button
                          onClick={() => handleRemove(d.user_id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove Delegate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {showInvite && (
        <InviteDelegateModal
          orgId={orgId}
          grantedBy={userId || ""}
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); loadDelegates(); }}
        />
      )}

      {editTarget && (
        <EditDelegateAccessModal
          orgId={orgId}
          delegate={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); loadDelegates(); }}
        />
      )}
    </div>
  );
}
