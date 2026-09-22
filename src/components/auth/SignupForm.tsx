"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction } from "@/app/(auth)/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/form-state";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialFormState);
  // controlados para não perder o que foi digitado quando o React reinicia o formulário após a action
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const errors = state.fieldErrors ?? {};

  return (
    <div>
      <h1 className="font-display text-[2.25rem] leading-tight tracking-[-0.015em] text-ink">Criar sua conta</h1>
      <p className="mt-2 text-ink-muted">Em seguida você completa o perfil e publica o primeiro imóvel.</p>

      <form action={formAction} className="mt-8 flex flex-col gap-5" noValidate>
        <FormMessage state={state} />
        <Field label="Seu nome" error={errors.name}>
          <Input
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
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
        <Field label="Senha" hint="Pelo menos 8 caracteres." error={errors.password}>
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton size="lg" block pendingLabel="Criando conta…" className="mt-1">
          Criar conta
        </SubmitButton>
      </form>

      <p className="mt-8 text-sm text-ink-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
