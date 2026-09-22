import { z } from "zod";
import { QUESTION_TYPES } from "@/domain/types";

export const questionSchema = z
  .object({
    label: z.string().trim().min(3, "Escreva a pergunta").max(200),
    type: z.enum(QUESTION_TYPES, "Escolha o tipo de resposta"),
    required: z.boolean(),
    isVisitIntent: z.boolean().default(false),
    options: z
      .array(
        z.object({
          id: z.string().optional(),
          label: z.string().trim().min(1, "Opção sem texto").max(100),
          weight: z.coerce.number().int("Use números inteiros").min(0, "Peso mínimo 0").max(100, "Peso máximo 100"),
        }),
      )
      .max(12, "Máximo de 12 opções"),
  })
  .superRefine((q, ctx) => {
    if ((q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && q.options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Adicione pelo menos 2 opções" });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;
