"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "owner" | "admin" | "accountant" | "executive" | null;

interface UseRoleResult {
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isExecutive: boolean;
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

        const userRole = (members && members.length > 0 ? members[0].role : null) as UserRole;

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

  return {
    role,
    isLoading,
    isAdmin: role === "owner" || role === "admin" || role === "accountant",
    isExecutive: role === "executive",
    userId,
    userEmail,
    userName,
  };
}

export function clearRoleCache() {
  cachedResult = null;
}
