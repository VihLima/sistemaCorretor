import { describe, expect, it } from "vitest";
import { guardLogin, guardSignup, LOGIN_LIMIT, SIGNUP_LIMIT } from "@/server/auth/rate-limits";
import { RateLimitError } from "@/server/errors";

const uniq = () => Math.random().toString(36).slice(2);

describe("guardLogin", () => {
  it("bloqueia o IP após 10 tentativas e libera após a janela", () => {
    const ip = `ip-${uniq()}`;
    for (let i = 0; i < LOGIN_LIMIT; i++) guardLogin(ip, `u${i}-${uniq()}@teste.com`, 0);
    expect(() => guardLogin(ip, `outro-${uniq()}@teste.com`, 1)).toThrow(RateLimitError);
    expect(() => guardLogin(ip, `outro-${uniq()}@teste.com`, 10 * 60 * 1000 + 1)).not.toThrow();
  });

  it("bloqueia o e-mail (normalizado) mesmo vindo de IPs diferentes", () => {
    const email = `Alvo-${uniq()}@Teste.com`;
    for (let i = 0; i < LOGIN_LIMIT; i++) guardLogin(`ip-${uniq()}`, i % 2 ? email : `  ${email.toLowerCase()} `, 0);
    expect(() => guardLogin(`ip-${uniq()}`, email.toUpperCase(), 1)).toThrow(/Muitas tentativas/);
  });
});

describe("guardSignup", () => {
  it("permite 5 cadastros por hora por IP", () => {
    const ip = `ip-${uniq()}`;
    for (let i = 0; i < SIGNUP_LIMIT; i++) guardSignup(ip, 0);
    expect(() => guardSignup(ip, 1)).toThrow(RateLimitError);
    expect(() => guardSignup(`ip-${uniq()}`, 1)).not.toThrow();
    expect(() => guardSignup(ip, 60 * 60 * 1000 + 1)).not.toThrow();
  });
});
