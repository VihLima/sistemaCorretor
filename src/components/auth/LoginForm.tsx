"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/(auth)/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialFormState);
  // controlado para não perder o e-mail quando o React reinicia o formulário após a action
  const [email, setEmail] = useState("");
  const errors = state.fieldErrors ?? {};

  return (
    <div>
      <h1 className="font-display text-[2.25rem] leading-tight tracking-[-0.015em] text-ink">Entrar</h1>
      <p className="mt-2 text-ink-muted">Acesse seus imóveis e contatos.</p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormMessage state={state} />
        <Field label="E-mail" error={errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Senha" error={errors.password}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton size="lg" block pendingLabel="Entrando…" className="mt-1">
          Entrar
        </SubmitButton>
      </form>

      <p className="mt-8 text-sm text-ink-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
