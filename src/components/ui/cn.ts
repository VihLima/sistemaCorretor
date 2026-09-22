import { clsx, type ClassValue } from "clsx";

/** Junta classes condicionalmente (sem merge de conflitos: evite passar utilitários concorrentes). */
export function cn(...values: ClassValue[]) {
  return clsx(values);
}
