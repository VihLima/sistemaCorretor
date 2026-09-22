import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Início" };

/** Provisório: a Task 14 substitui por métricas do painel. */
export default async function PainelHome() {
  const user = await requireUser();
  return <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Olá, {user.name}</h1>;
}
