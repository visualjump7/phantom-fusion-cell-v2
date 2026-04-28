import { redirect } from "next/navigation";

/**
 * /comms lands on Chat by default (product decision — Chat is the headliner
 * feature for Phase 1). Users with alerts get pulled to /comms/alerts via
 * explicit tab click or the dashboard's "Recent Alerts" View-all link.
 */
export default function CommsIndex() {
  redirect("/comms/chat");
}
