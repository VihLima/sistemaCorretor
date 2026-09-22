"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";
import { Spinner } from "./Spinner";

export type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  /** Texto exibido enquanto o formulário é enviado (padrão: o próprio `children`). */
  pendingLabel?: ReactNode;
};

/** Botão de envio: desabilita e mostra um spinner enquanto a server action do formulário pai roda. */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <Spinner label="Enviando" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
