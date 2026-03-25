"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Loader2, MoreVertical, ShieldCheck, Briefcase,
  Eye, UserX, KeyRound, Trash2, RefreshCw, Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchTeamMembers, toggleUserStatus, removeUser, TeamMember,
} from "@/lib/user-service";
import { useRole } from "@/lib/use-role";
import { formatTimeAgo } from "@/lib/utils";
import { InviteUserModal } from "@/components/admin/shared/InviteUserModal";
import { ChangeRoleModal } from "@/components/admin/shared/ChangeRoleModal";
import { AssignPrincipalsModal } from "@/components/admin/shared/AssignPrincipalsModal";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-red-600 text-white border-red-600",
  manager: "bg-amber-600 text-white border-amber-600",
  viewer: "bg-blue-600 text-white border-blue-600",
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  manager: Briefcase,
  viewer: Eye,
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active: { label: "Active", class: "bg-emerald-600 text-white border-emerald-600" },
  invited: { label: "Invited", class: "bg-amber-600 text-white border-amber-600" },
  disabled: { label: "Disabled", class: "bg-muted text-muted-foreground border-border" },
};

export default function TeamManagementPage() {
  const { isAdmin, userId: currentUserId } = useRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showInvite, setShowInvite] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadMembers = async () => {
    try {
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (err) {
      console.error("[TeamManagement] Failed to load members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const active = member.status !== "active";
    const result = await toggleUserStatus(member.id, active);
    if (result.success) {
      showToast(`${member.full_name || member.email} has been ${active ? "enabled" : "disabled"}`);
      loadMembers();
    }
    setMenuOpenId(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const name = removeTarget.full_name || removeTarget.email;
    const result = await removeUser(removeTarget.id);
    if (result.success) {
      showToast(`${name} has been removed`);
      setRemoveTarget(null);
      loadMembers();
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name && name.length > 0) {
      return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email && email.length > 0) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} team member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Team Member
          </Button>
        )}
      </div>

      {/* User list */}
      <div className="space-y-2">
        {members.map((member) => {
          const initials = getInitials(member.full_name, member.email);
          const roleBadge = ROLE_BADGE_COLORS[member.role] || ROLE_BADGE_COLORS.viewer;
          const RoleIcon = ROLE_ICONS[member.role] || Eye;
          const statusConfig = STATUS_BADGE[member.status] || STATUS_BADGE.active;
          const isSelf = member.id === currentUserId;

          return (
            <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border">
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {member.full_name || member.email}
                      </p>
                      {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      <Badge variant="outline" className={roleBadge}>
                        <RoleIcon className="mr-1 h-3 w-3" />
                        {member.role}
                      </Badge>
                      <Badge variant="outline" className={statusConfig.class}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{member.email}</span>
                      {member.last_login_at && (
                        <span>Last login: {formatTimeAgo(member.last_login_at)}</span>
                      )}
                    </div>
                    {/* Assigned principals */}
                    {member.assignments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {member.assignments.map((a) => (
                          <span
                            key={a.organization_id}
                            className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            {a.display_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions menu */}
                  {isAdmin && !isSelf && (
                    <div className="relative" ref={menuOpenId === member.id ? menuRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === member.id ? null : member.id);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {menuOpenId === member.id && (
                        <div className="absolute right-0 top-full mt-1 z-10 min-w-[200px] rounded-lg border border-border bg-card py-1 shadow-lg">
                          <button
                            onClick={() => { setMenuOpenId(null); setRoleTarget(member); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Change role
                          </button>
                          {(member.role === "manager" || member.role === "viewer") && (
                            <button
                              onClick={() => { setMenuOpenId(null); setAssignTarget(member); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                            >
                              <Building2 className="h-3.5 w-3.5" /> Manage assignments
                            </button>
                          )}
                          <button
                            onClick={() => { handleToggleStatus(member); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            {member.status === "active" ? "Disable user" : "Enable user"}
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button
                            onClick={() => { setMenuOpenId(null); setRemoveTarget(member); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove user
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {members.length === 0 && (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No team members yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <InviteUserModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={() => { loadMembers(); showToast("Invitation sent successfully"); }}
      />

      {roleTarget && (
        <ChangeRoleModal
          open={!!roleTarget}
          userId={roleTarget.id}
          userName={roleTarget.full_name || roleTarget.email}
          currentRole={roleTarget.role}
          onClose={() => setRoleTarget(null)}
          onSuccess={() => { loadMembers(); showToast("Role updated successfully"); }}
        />
      )}

      {assignTarget && (
        <AssignPrincipalsModal
          open={!!assignTarget}
          userId={assignTarget.id}
          userName={assignTarget.full_name || assignTarget.email}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => { loadMembers(); showToast("Assignments updated"); }}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${removeTarget?.full_name || removeTarget?.email}? This will revoke all access.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <p className="text-sm font-medium text-foreground">{toast}</p>
        </div>
      )}
    </div>
  );
}
