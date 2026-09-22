"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { isActive, NAV_ITEMS } from "./nav";

/** Navegação vertical do painel (≥ 1024px). */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-control px-3 text-[0.9375rem] transition-colors",
                  active
                    ? "bg-surface font-medium text-ink shadow-card"
                    : "text-ink-muted hover:bg-ink/5 hover:text-ink",
                )}
              >
                <Icon aria-hidden className={cn("size-[1.15rem]", active ? "text-brand" : "text-ink-faint")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
