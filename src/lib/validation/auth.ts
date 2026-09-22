import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")).pipe(z.string().max(200));

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email,
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(200),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha").max(200),
});
