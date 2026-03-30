"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "manager" | "viewer" | "executive" | "delegate" | null;

interface UseRoleResult {
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isViewer: boolean;
  isExecutive: boolean;
  isDelegate: boolean;
  isStaff: boolean;
  isTeam: boolean;
  isPrincipalSide: boolean;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

let cachedResult: {
  role: UserRole;
  userId: string | null;
  email: string | null;
  name: string | null;
} | null = null;

export function useRole(): UseRoleResult {
  const [role, setRole] = useState<UserRole>(cachedResult?.role || null);
  const [userId, setUserId] = useState<string | null>(cachedResult?.userId || null);
  const [userEmail, setUserEmail] = useState<string | null>(cachedResult?.email || null);
  const [userName, setUserName] = useState<string | null>(cachedResult?.name || null);
  const [isLoading, setIsLoading] = useState(cachedResult === null);

  useEffect(() => {
    if (cachedResult) {
      setRole(cachedResult.role);
      setUserId(cachedResult.userId);
      setUserEmail(cachedResult.email);
      setUserName(cachedResult.name);
      setIsLoading(false);
      return;
    }

    async function fetchRole() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setIsLoading(false);
          return;
        }

        const email = user.email || null;
        const name = user.user_metadata?.full_name || (email ? email.split("@")[0] : null);

        const { data: members, error: memberError } = await db
          .from("organization_members")
          .select("role")
          .eq("user_id", user.id);

        if (memberError) {
          console.error("[useRole] Error:", memberError);
          setIsLoading(false);
          return;
        }

        // Normalize legacy roles
        let rawRole = members && members.length > 0 ? members[0].role : null;
        if (rawRole === "owner") rawRole = "admin";
        if (rawRole === "accountant") rawRole = "manager";

        const userRole = rawRole as UserRole;

        cachedResult = { role: userRole, userId: user.id, email, name };
        setRole(userRole);
        setUserId(user.id);
        setUserEmail(email);
        setUserName(name);
      } catch (error) {
        console.error("[useRole] Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRole();
  }, []);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isViewer = role === "viewer";
  const isExecutive = role === "executive";
  const isDelegate = role === "delegate";
  const isStaff = isAdmin || isManager;
  const isTeam = isAdmin || isManager || isViewer;
  const isPrincipalSide = isExecutive || isDelegate;

  return {
    role,
    isLoading,
    isAdmin,
    isManager,
    isViewer,
    isExecutive,
    isDelegate,
    isStaff,
    isTeam,
    isPrincipalSide,
    userId,
    userEmail,
    userName,
  };
}

export function clearRoleCache() {
  cachedResult = null;
}
