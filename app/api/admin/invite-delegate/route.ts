import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = cookies();

  const supabase = createServerClient(
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

  // Verify caller is admin
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Parse request
  const { email, fullName, orgId, assetIds } = await request.json();

  if (!email || !fullName || !orgId || !assetIds || assetIds.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Service role key required
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 501 }
    );
  }

  const adminClient: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  try {
    let newUserId: string;

    // Check if user already exists in auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      newUserId = existingUser.id;
    } else {
      // Invite user via Supabase auth (sends magic link email)
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
        });

      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 422 });
      }

      newUserId = inviteData.user.id;

      // Update the auto-created profile
      await adminClient
        .from("profiles")
        .update({
          full_name: fullName,
          status: "invited",
          invited_by: user.id,
        })
        .eq("id", newUserId);
    }

    // Check if already a member of this org
    const { data: existingMember } = await adminClient
      .from("organization_members")
      .select("id, role")
      .eq("user_id", newUserId)
      .eq("organization_id", orgId)
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      // Update to delegate role
      await adminClient
        .from("organization_members")
        .update({ role: "delegate", status: "active" })
        .eq("user_id", newUserId)
        .eq("organization_id", orgId);
    } else {
      // Create org membership as delegate
      const { error: memberError } = await adminClient
        .from("organization_members")
        .insert({
          user_id: newUserId,
          organization_id: orgId,
          role: "delegate",
          status: "active",
        });

      if (memberError) {
        return NextResponse.json({ error: `Membership error: ${memberError.message}` }, { status: 500 });
      }
    }

    // Clear existing delegate access for this org, then insert new
    await adminClient
      .from("delegate_asset_access")
      .delete()
      .eq("user_id", newUserId)
      .eq("organization_id", orgId);

    const accessRows = assetIds.map((assetId: string) => ({
      user_id: newUserId,
      asset_id: assetId,
      organization_id: orgId,
      granted_by: user.id,
    }));

    const { error: accessError } = await adminClient
      .from("delegate_asset_access")
      .insert(accessRows);

    if (accessError) {
      return NextResponse.json({ error: `Access error: ${accessError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[invite-delegate] unexpected:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
