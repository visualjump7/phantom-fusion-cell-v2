/**
 * POST /api/admin/update-executive
 *
 * Update an executive's profile fields. Email changes hit auth.users via the
 * service-role client (so they keep working at sign-in); name + phone are
 * just profile-row updates. Admin/owner only.
 *
 * Password changes go through /api/admin/set-password instead — that route
 * already has the right validation.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface Body {
  userId: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: membership } = await anon
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const callerRole = (membership as { role: string } | null)?.role;
  if (callerRole !== "admin" && callerRole !== "owner") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json()) as Body;
  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  const email = body.email?.trim();
  const phone = body.phone === null ? null : body.phone?.trim() || undefined;

  if (email !== undefined && (!email || !/@/.test(email))) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (fullName !== undefined && fullName.length === 0) {
    return NextResponse.json({ error: "Full name can't be empty" }, { status: 400 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any;

  // 1) auth.users — only when the email actually changes. updateUserById will
  // 422 if the new email already belongs to another user; surface that.
  if (email !== undefined) {
    const { error: authErr } = await service.auth.admin.updateUserById(body.userId, {
      email,
      // Skip the confirmation email for admin-initiated changes — the admin
      // is asserting the new address.
      email_confirm: true,
    });
    if (authErr) {
      return NextResponse.json(
        { error: `Failed to update email: ${authErr.message}` },
        { status: 422 }
      );
    }
  }

  // 2) profile row — patch only the supplied fields
  const profileUpdate: Record<string, unknown> = {};
  if (fullName !== undefined) profileUpdate.full_name = fullName;
  if (email !== undefined) profileUpdate.email = email;
  if (phone !== undefined) profileUpdate.phone = phone;
  if (Object.keys(profileUpdate).length > 0) {
    const { error: profErr } = await svc
      .from("profiles")
      .update(profileUpdate)
      .eq("id", body.userId);
    if (profErr) {
      return NextResponse.json(
        { error: `Failed to update profile: ${profErr.message}` },
        { status: 500 }
      );
    }
  }

  // Audit (no org scope here — this is a global edit)
  await svc.from("audit_log").insert({
    user_id: user.id,
    action: "executive.profile_updated",
    metadata: {
      target_user_id: body.userId,
      changed: Object.keys(profileUpdate),
    },
  });

  return NextResponse.json({ success: true });
}
