"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { clearSessionCookie, getCurrentUser, SESSION_COOKIE, setSessionCookie } from "@/server/auth/current";
import { guardLogin, guardSignup } from "@/server/auth/rate-limits";
import { createSession, deleteExpiredSessions, deleteSession } from "@/server/auth/session";
import { clientIpFromHeaders } from "@/server/http";
import { authenticate, signup } from "@/server/services/accounts";

export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  let ok = false;
  const ip = clientIpFromHeaders(await headers());
  const state = await runAction(async () => {
    guardSignup(ip);
    const ctx = await signup(Object.fromEntries(formData));
    const { token, expiresAt } = await createSession(ctx.userId);
    await setSessionCookie(token, expiresAt);
    ok = true;
  });
  if (ok) redirect("/painel/perfil?boas-vindas=1");
  return state;
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  let ok = false;
  const ip = clientIpFromHeaders(await headers());
  const state = await runAction(async () => {
    guardLogin(ip, formData.get("email"));
    const ctx = await authenticate(Object.fromEntries(formData));
    if (!ctx) return;
    await deleteExpiredSessions().catch((e) => console.error(e));
    const { token, expiresAt } = await createSession(ctx.userId);
    await setSessionCookie(token, expiresAt);
    ok = true;
  });
  if (ok) redirect("/painel");
  if (state.status === "success") return { status: "error", message: "E-mail ou senha incorretos." };
  return state;
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function redirectIfLoggedIn() {
  if (await getCurrentUser()) redirect("/painel");
}
