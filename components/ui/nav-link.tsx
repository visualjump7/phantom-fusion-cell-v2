"use client";

/**
 * NavLink — shared active-state-aware link for every nav surface.
 *
 * Consolidates the `isActive = pathname.startsWith(href)` + conditional
 * className pattern that used to be duplicated across Navbar, MobileNavDrawer,
 * AdminSettingsMenu, OverlayNavMenu. Each surface passes its own
 * base/active/inactive class strings; matching rules live here.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavLinkProps {
  href: string;
  /** Optional icon component — rendered before children. */
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  children?: ReactNode;
  onClick?: () => void;
  /** Base classes applied regardless of active state. */
  className?: string;
  /** Classes merged in when the link matches the current pathname. */
  activeClassName?: string;
  /** Classes merged in when the link does not match. */
  inactiveClassName?: string;
  /** If true, only match the exact pathname (no prefix match). */
  matchExact?: boolean;
}

export function isNavActive(
  pathname: string | null,
  href: string,
  matchExact = false
): boolean {
  if (!pathname) return false;
  if (matchExact) return pathname === href;
  // Root is a special case — prefix match would match every path.
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({
  href,
  icon: Icon,
  iconClassName = "h-5 w-5",
  children,
  onClick,
  className,
  activeClassName,
  inactiveClassName,
  matchExact = false,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href, matchExact);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(className, active ? activeClassName : inactiveClassName)}
    >
      {Icon && <Icon className={iconClassName} />}
      {children}
    </Link>
  );
}
