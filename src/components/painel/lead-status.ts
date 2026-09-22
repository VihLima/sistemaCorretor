import type { BadgeTone } from "@/components/ui/Badge";
import type { LeadStatus } from "@/domain/types";

/** Cor do status do contato. "Novo" fica em destaque: é quem ainda espera atendimento. */
export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  NEW: "warning",
  CONTACTED: "neutral",
  NEGOTIATING: "info",
  VISIT_SCHEDULED: "info",
  PROPOSAL: "info",
  CONVERTED: "success",
  LOST: "neutral",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
export const formatDateTime = (d: Date) => dateTime.format(d);

/** Pontuação normalizada para 0–100 (ex.: 65/100); `null` quando não há perguntas pontuáveis. */
export function scoreOutOf100(score: number, maxScore: number): number | null {
  if (maxScore <= 0) return null;
  return Math.round((Math.min(score, maxScore) / maxScore) * 100);
}
