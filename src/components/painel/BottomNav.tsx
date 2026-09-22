"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { isActive, NAV_ITEMS } from "./nav";

/** Barra de navegação fixa no rodapé (< 1024px). "Sair" fica dentro da página Perfil no celular. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Painel"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] leading-none tracking-[-0.01em] min-[360px]:text-[0.6875rem] min-[360px]:tracking-normal",
                  active ? "font-semibold text-brand" : "text-ink-muted",
                )}
              >
                {active && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" />}
                <Icon aria-hidden className="size-[1.35rem]" strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
