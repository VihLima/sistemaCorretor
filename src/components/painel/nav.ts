import { Building2, House, ListChecks, UserRound, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Destinos do painel, na mesma ordem na barra lateral (desktop) e na barra inferior (celular). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Início", icon: House },
  { href: "/painel/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/painel/leads", label: "Contatos", icon: Users },
  { href: "/painel/questionario", label: "Questionário", icon: ListChecks },
  { href: "/painel/perfil", label: "Perfil", icon: UserRound },
];

export function isActive(pathname: string, href: string) {
  return href === "/painel" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
