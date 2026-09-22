import type { BadgeTone } from "@/components/ui/Badge";
import type { PropertyStatus } from "@/domain/types";

/** Cor do Badge de status do imóvel (lista e página do imóvel). */
export const PROPERTY_STATUS_TONES: Record<PropertyStatus, BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  PAUSED: "warning",
  SOLD: "info",
  RENTED: "info",
};
