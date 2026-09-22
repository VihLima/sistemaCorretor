export interface SummaryLine {
  label: string;
  value: string;
}

export function buildLeadMessage(input: {
  leadName: string;
  propertyTitle: string;
  propertyUrl: string;
  lines: SummaryLine[];
}): string {
  const parts = [
    `Olá, sou ${input.leadName}.`,
    `Tenho interesse no imóvel: ${input.propertyTitle}\n${input.propertyUrl}`,
  ];
  if (input.lines.length > 0) {
    parts.push(`Minhas informações:\n${input.lines.map((l) => `• ${l.label}: ${l.value}`).join("\n")}`);
  }
  parts.push("Gostaria de receber mais informações.");
  return parts.join("\n\n");
}

export function buildWhatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** Ponto de extensão para uma futura integração com a API oficial do WhatsApp Business. */
export interface LeadHandoffChannel {
  buildHandoffUrl(input: { phone: string; message: string }): string;
}

export const waMeChannel: LeadHandoffChannel = {
  buildHandoffUrl: ({ phone, message }) => buildWhatsappUrl(phone, message),
};
