import { RateLimitError } from "@/server/errors";
import { checkRateLimit } from "@/server/rate-limit";

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const LOGIN_LIMIT = 10;
export const SIGNUP_LIMIT = 5;

/** Tentativas de login: 10 a cada 10 min por IP e 10 a cada 10 min por e-mail (normalizado). */
export function guardLogin(ip: string, email: unknown, now = Date.now()) {
  if (!checkRateLimit(`login-ip:${ip}`, LOGIN_LIMIT, TEN_MINUTES, now)) throw new RateLimitError();
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (normalized && !checkRateLimit(`login-email:${normalized}`, LOGIN_LIMIT, TEN_MINUTES, now)) throw new RateLimitError();
}

/** Cadastros: 5 por hora por IP. */
export function guardSignup(ip: string, now = Date.now()) {
  if (!checkRateLimit(`signup-ip:${ip}`, SIGNUP_LIMIT, ONE_HOUR, now)) throw new RateLimitError();
}
