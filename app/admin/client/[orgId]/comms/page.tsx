import { redirect } from "next/navigation";

/**
 * /admin/client/[orgId]/comms lands on Chat by default (matches the
 * principal-side /comms → /comms/chat redirect).
 */
export default function AdminCommsIndex({
  params,
}: {
  params: { orgId: string };
}) {
  redirect(`/admin/client/${params.orgId}/comms/chat`);
}
