import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Wordmark } from "@/components/ui/Wordmark";
import type { SessionUser } from "@/server/auth/session";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";

export type ShellProps = { user: Pick<SessionUser, "name" | "email">; children: ReactNode };

/**
 * Moldura do painel: barra lateral fixa no desktop (≥ 1024px) e, no celular,
 * cabeçalho compacto + barra inferior com os mesmos 5 destinos.
 * O conteúdo fica num container de até 72rem; as páginas cuidam dos próprios títulos.
 */
export function Shell({ user, children }: ShellProps) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 text-sm font-medium text-ink shadow-raised focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line px-4 py-6 lg:flex">
        <Link href="/painel" className="mb-8 self-start rounded-control px-2 py-1">
          <Wordmark />
        </Link>
        <SidebarNav />
        <div className="mt-auto border-t border-line pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className={cn(buttonStyles({ variant: "ghost", size: "sm", block: true }), "justify-start px-3")}
            >
              <LogOut aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-canvas/95 px-4 backdrop-blur lg:hidden">
        <Link href="/painel" className="rounded-control py-1">
          <Wordmark size="sm" />
        </Link>
      </header>

      <main
        id="conteudo"
        className="mx-auto w-full max-w-[72rem] px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
