"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, User, Lock, Sun, Moon, Loader2, CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { useTheme } from "@/components/ThemeProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function SettingsPage() {
  const { role, userName, userEmail, userId } = useRole();
  const { theme, setTheme } = useTheme();

  // Profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!userId) return;
      const { data } = await db.from("profiles").select("full_name, phone").eq("id", userId).single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
      }
    }
    loadProfile();
  }, [userId]);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { setProfileMsg({ type: "error", text: "Name is required" }); return; }
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      const { error: profileError } = await db
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (profileError) throw new Error(profileError.message);

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (metaError) throw new Error(metaError.message);

      setProfileMsg({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      setProfileMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: "error", text: "Passwords do not match" }); return; }
    setIsSavingPassword(true);
    setPasswordMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "Password updated successfully" });
    } catch (err) {
      setPasswordMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to update password" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : role === "accountant" ? "Accountant" : role === "executive" ? "Executive" : "User";

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* ═══ PROFILE ═══ */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <div className="flex items-center gap-2">
                  <Input value={userEmail || ""} disabled className="opacity-60" />
                  <Badge variant="outline" className="shrink-0 capitalize text-xs">{roleLabel}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
              </div>

              {profileMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  profileMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {profileMsg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm">
                  {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ═══ PASSWORD ═══ */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Change Password</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Confirm New Password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </div>

              {passwordMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  passwordMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {passwordMsg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {passwordMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={isSavingPassword || !newPassword} size="sm" variant="outline">
                  {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ═══ APPEARANCE ═══ */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                <CardTitle className="text-base">Appearance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Choose your preferred color theme</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTheme("dark")}
                  className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                    theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex h-20 w-full items-end gap-1.5 rounded-lg bg-black p-3 border border-[hsl(0,0%,14%)]">
                    <div className="h-3 w-8 rounded bg-[hsl(95,55%,50%)]" />
                    <div className="h-2 w-6 rounded bg-[hsl(0,0%,18%)]" />
                    <div className="h-4 w-4 rounded bg-[hsl(0,0%,3%)]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    <span className="text-sm font-medium">Dark</span>
                  </div>
                  {theme === "dark" && (
                    <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <CheckCircle className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setTheme("light")}
                  className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                    theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex h-20 w-full items-end gap-1.5 rounded-lg bg-[#D3D5D8] p-3 border border-[#ACB1B6]">
                    <div className="h-3 w-8 rounded bg-[hsl(95,55%,38%)]" />
                    <div className="h-2 w-6 rounded bg-[#ACB1B6]" />
                    <div className="h-4 w-4 rounded bg-[#E2E3E6]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <span className="text-sm font-medium">Light</span>
                  </div>
                  {theme === "light" && (
                    <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <CheckCircle className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.main>
    </div>
  );
}
