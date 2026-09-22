import type { Channel, Classification, LeadStatus, PropertyPurpose, PropertyStatus, PropertyType, QuestionType } from "./types";

export const CHANNEL_LABELS: Record<Channel, string> = {
  INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE: "Google", QR_CODE: "QR Code", DIRECT: "Link direto", OTHER: "Outros",
};
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo", CONTACTED: "Contatado", NEGOTIATING: "Em negociação", VISIT_SCHEDULED: "Visita agendada",
  PROPOSAL: "Proposta", CONVERTED: "Convertido", LOST: "Perdido",
};
export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  HIGH: "Alta intenção", MEDIUM: "Média intenção", LOW: "Baixa intenção", UNRATED: "Sem classificação",
};
export const CLASSIFICATION_DISCLAIMER = "Indicação baseada nas respostas — não é garantia de intenção.";
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicado", PAUSED: "Pausado", SOLD: "Vendido", RENTED: "Alugado",
};
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "Casa", APARTMENT: "Apartamento", TOWNHOUSE: "Sobrado", LAND: "Terreno", COMMERCIAL: "Comercial", OTHER: "Outro",
};
export const PROPERTY_PURPOSE_LABELS: Record<PropertyPurpose, string> = { SALE: "Venda", RENT: "Aluguel" };
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Escolha única", MULTI_CHOICE: "Múltipla escolha", YES_NO: "Sim ou não", TEXT: "Texto", NUMBER: "Número",
};
