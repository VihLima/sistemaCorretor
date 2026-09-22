# Corretor Leads MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working SaaS MVP where a real-estate agent publishes property pages whose "Tenho interesse" flow qualifies visitors (contact + questionnaire + score) before handing them off to the agent's WhatsApp, with a dashboard to manage the resulting leads.

**Architecture:** Single Next.js 16 (App Router) app. Pure business rules live in `src/domain` (no I/O, unit-tested). Data access + authorization live in `src/server/services` (every panel function takes a `Ctx` with `accountId` from the session; integration-tested against a real Postgres). UI in `src/app` + `src/components` is thin and calls services via server actions (panel) or JSON route handlers (public visitor flow).

**Tech Stack:** Next.js 16.3 · React 19 · TypeScript 5 · Tailwind CSS 4 · Prisma 7.10 (`prisma-client` generator + `@prisma/adapter-pg`) · PostgreSQL 17 (Docker locally, Supabase in prod) · Zod 4 · bcryptjs 3 · qrcode · @supabase/supabase-js 2 · Vitest 4 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-22-corretor-leads-mvp-design.md`

## Global Constraints

- All user-facing copy in **Brazilian Portuguese**; code identifiers, file names and commit messages in English (commit messages may be PT).
- Every panel service function takes `ctx: Ctx` (`{ accountId, userId }`) obtained from the session — never from client input — and filters by `ctx.accountId`. Accessing another account's record throws `NotFoundError` (never reveals existence).
- Public endpoints derive `accountId` from the property server-side and only operate on `status = PUBLISHED` properties.
- Classification thresholds: `>= 60%` HIGH, `>= 30%` MEDIUM, else LOW; no scorable questions or incomplete lead → UNRATED.
- Classification must always be shown with the disclaimer: **"Indicação baseada nas respostas — não é garantia de intenção."**
- Do not store visitor IP addresses. `visitorId` is a random UUID.
- Question weights are integers 0–100. Max 10 questions per questionnaire. Max 12 options per question. Max 20 photos per property, 5 MB each, JPG/PNG/WebP verified by magic bytes.
- Touch targets in the public flow ≥ 48px. Layout must work at 320px, 768px, 1366px widths.
- Money stored as integer reais (`Int`), displayed with `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })`.
- Phones stored as digits with country code (e.g. `5567999991234`).
- Next.js 16 conventions: route `params`/`searchParams` are Promises; `cookies()`/`headers()` are async; request interception file is `src/proxy.ts` exporting `proxy`.
- Commit after each task (git identity already configured in repo). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deviations from spec (intentional, flagged to user)

1. **Auth:** instead of Auth.js v5 (still beta), a small first-party session system: bcrypt password hashes + random session tokens stored hashed (SHA-256) in a `Session` table, sent as an `httpOnly` cookie. Fewer moving parts, fully testable, no beta dependency.
2. **Visitor ID:** kept in `localStorage` (first-party) instead of a cookie; same privacy properties, simpler client code.
3. `Lead` gains `publicToken` (lets the anonymous visitor continue their own lead without accessing others), `completedAt`; `LeadAnswer` gains `displayValue` + `position` snapshots; `Property` gains `agentId` (whose WhatsApp receives leads — prepares multi-agent accounts); `Question` gains `isVisitIntent` (already mentioned in spec).
4. Deleting a property that has leads is **blocked** (agent should mark it sold/paused) so leads are never lost by accident.

---

## File Structure

```
docker-compose.yml, docker/init-test-db.sql      # local Postgres (dev + test DBs)
prisma.config.ts, prisma/schema.prisma, prisma/seed.ts
src/
  proxy.ts                                     # redirects unauthenticated /painel/* to /login
  domain/                                      # pure logic, no I/O
    types.ts          labels.ts      slug.ts      phone.ts      format.ts
    questionnaire.ts  scoring.ts     default-questionnaire.ts
    attribution.ts    whatsapp.ts    consent.ts
  lib/
    validation/{parse,auth,profile,property,question,lead}.ts
    form-state.ts                              # FormState type shared by actions + forms
    image-resize.ts                            # client-side downscale before upload
    tracking.ts                                # client: visitorId + first-touch attribution
  server/
    db.ts  context.ts  errors.ts  rate-limit.ts  http.ts  action.ts
    auth/{password,session,current}.ts
    storage/{index,local,memory,supabase,sniff}.ts
    services/{accounts,profile,properties,questionnaires,public-leads,leads,analytics}.ts
  app/
    layout.tsx  globals.css  page.tsx  manifest.ts  privacidade/page.tsx
    (auth)/login/page.tsx  (auth)/cadastro/page.tsx  (auth)/actions.ts
    painel/layout.tsx  painel/page.tsx
    painel/imoveis/{page.tsx, novo/page.tsx, actions.ts}
    painel/imoveis/[id]/{page.tsx, qrcode/route.ts}
    painel/leads/{page.tsx, actions.ts}  painel/leads/[id]/page.tsx
    painel/questionario/{page.tsx, actions.ts}
    painel/perfil/{page.tsx, actions.ts}
    imovel/[slug]/{page.tsx, interesse/page.tsx}
    api/public/events/route.ts
    api/public/leads/route.ts
    api/public/leads/[id]/answers/route.ts
    api/public/leads/[id]/whatsapp/route.ts
    uploads/[...key]/route.ts                  # serves local-driver uploads
    pwa-icon/[size]/route.tsx                  # generated PNG icons
  components/
    ui/        (Button, Input, Field, Select, Textarea, Badge, Card, EmptyState, SubmitButton, FormMessage)
    painel/    (Shell, SidebarNav, BottomNav, StatCard, PropertyForm, PhotoManager, StatusControl,
                SharePanel, LeadFilters, LeadTable, LeadStatusSelect, NoteForm, QuestionEditor, ProfileForm,
                ClassificationBadge, ChannelBars)
    publico/   (Gallery, PropertyFacts, AgentCard, StickyCta, TrackPageView, InterestFlow)
public/sw.js
tests/unit/*.test.ts
tests/integration/{global-setup,setup,helpers}.ts + *.test.ts
e2e/{global-setup.ts, fluxo-completo.spec.ts, fixtures/casa.png}
playwright.config.ts  vitest.config.ts
README.md  docs/{arquitetura,deploy,lgpd-pendencias}.md
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: whole Next.js scaffold, `docker-compose.yml`, `docker/init-test-db.sql`, `.env.example`, `.env`, `vitest.config.ts`
- Modify: `package.json` (name + scripts), `.gitignore`

**Interfaces:**
- Produces: `npm run dev|build|test|test:unit|test:integration|db:up`, path alias `@/* → src/*`, local Postgres on `localhost:5433` with DBs `corretor` and `corretor_test`.

- [ ] **Step 1: Scaffold Next.js in a temp folder** (the project folder name has uppercase letters/accents, which are invalid npm names)

```bash
cd "C:/Users/vinic/OneDrive/Área de Trabalho/sistemaCorretor"
npx create-next-app@16.3.6 sistema-corretor-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cp -r sistema-corretor-tmp/. . && rm -rf sistema-corretor-tmp
```
Expected: `package.json`, `src/app`, `next.config.ts`, `postcss.config.mjs` now at repo root. If `cp` overwrote `.git`, abort and redo excluding it (`sistema-corretor-tmp/.git` should not exist because we did not init git there; create-next-app may init git — delete `sistema-corretor-tmp/.git` before copying).

- [ ] **Step 2: Install dependencies**

```bash
npm i @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg zod@^4 bcryptjs@^3 qrcode@^1.5.4 @supabase/supabase-js@^2 lucide-react clsx dotenv server-only
npm i -D prisma@7.10.0 vitest@^4.1 tsx @types/qrcode @playwright/test@1.63.0
```

- [ ] **Step 3: Set package name and scripts** in `package.json`:

```json
{
  "name": "sistema-corretor",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e": "playwright test",
    "db:up": "docker compose up -d db",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force"
  }
}
```

- [ ] **Step 4: Docker Postgres**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: corretor
      POSTGRES_PASSWORD: corretor
      POSTGRES_DB: corretor
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
volumes:
  pgdata: {}
```
`docker/init-test-db.sql`:
```sql
CREATE DATABASE corretor_test;
```

- [ ] **Step 5: Env files**

`.env.example` (commit) and `.env` (copy, gitignored):
```
DATABASE_URL="postgresql://corretor:corretor@localhost:5433/corretor"
TEST_DATABASE_URL="postgresql://corretor:corretor@localhost:5433/corretor_test"
APP_URL="http://localhost:3000"
# local | supabase  (tests force "memory")
STORAGE_DRIVER="local"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_BUCKET="property-images"
```
Append to `.gitignore`:
```
.env
/src/generated
/.data
/test-results
/playwright-report
```
(Ensure `.env.example` is NOT ignored — create-next-app ignores `.env*`; add `!.env.example`.)

- [ ] **Step 6: Vitest config** `vitest.config.ts`:

```ts
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 20000,
          env: {
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
            STORAGE_DRIVER: "memory",
            APP_URL: "http://localhost:3000",
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 7: Verify**

```bash
docker compose up -d db
docker compose exec db psql -U corretor -c "\l" | grep corretor_test
npm run build
```
Expected: `corretor_test` listed; Next build succeeds (the `prisma generate` part will fail until Task 5 — for this step run `npx next build` instead).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 16, Tailwind, Vitest e Postgres via Docker"
```

---

### Task 2: Domain — slug, phone, formatting

**Files:**
- Create: `src/domain/slug.ts`, `src/domain/phone.ts`, `src/domain/format.ts`
- Test: `tests/unit/slug.test.ts`, `tests/unit/phone.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  - `slugify(input: string): string`
  - `uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string>`
  - `normalizeBrPhone(raw: string): string | null` → digits with `55` prefix
  - `formatBrPhone(digits: string): string` → `"(67) 99999-1234"`
  - `rate(numerator: number, denominator: number): number | null`
  - `formatPercent(value: number | null): string`, `formatBRL(value: number): string`

- [ ] **Step 1: Write failing tests**

`tests/unit/slug.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/domain/slug";

describe("slugify", () => {
  it("remove acentos, pontuação e espaços", () => {
    expect(slugify("Casa no Jardim dos Estados")).toBe("casa-no-jardim-dos-estados");
    expect(slugify("Apartamento – Centro, 3 quartos!")).toBe("apartamento-centro-3-quartos");
    expect(slugify("Sobrado Carandá Bosque")).toBe("sobrado-caranda-bosque");
  });
  it("usa fallback quando não sobra nada", () => {
    expect(slugify("!!!")).toBe("imovel");
  });
  it("limita a 80 caracteres sem hífen no final", () => {
    const s = slugify("a".repeat(79) + " bbbb");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("retorna o base quando livre", async () => {
    expect(await uniqueSlug("casa", async () => false)).toBe("casa");
  });
  it("acrescenta sufixo numérico quando ocupado", async () => {
    const taken = new Set(["casa", "casa-2"]);
    expect(await uniqueSlug("casa", async (s) => taken.has(s))).toBe("casa-3");
  });
});
```

`tests/unit/phone.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatBrPhone, normalizeBrPhone } from "@/domain/phone";

describe("normalizeBrPhone", () => {
  it.each([
    ["(67) 99999-1234", "5567999991234"],
    ["+55 67 99999-1234", "5567999991234"],
    ["5567999991234", "5567999991234"],
    ["67 3333-1234", "556733331234"],
    ["55 99999-1234", "5555999991234"], // DDD 55 (RS)
    ["0055 67 99999-1234", "5567999991234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBrPhone(input)).toBe(expected);
  });
  it.each(["123", "", "abc", "1234567890123456"])("rejeita %s", (input) => {
    expect(normalizeBrPhone(input)).toBeNull();
  });
});

describe("formatBrPhone", () => {
  it("formata celular e fixo", () => {
    expect(formatBrPhone("5567999991234")).toBe("(67) 99999-1234");
    expect(formatBrPhone("556733331234")).toBe("(67) 3333-1234");
  });
});
```

`tests/unit/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, rate } from "@/domain/format";

const plain = (s: string) => s.replace(/\s/g, " ");

describe("rate", () => {
  it("retorna null sem denominador", () => expect(rate(3, 0)).toBeNull());
  it("calcula razão limitada a 1", () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(5, 4)).toBe(1);
  });
});

describe("formatPercent", () => {
  it("formata em pt-BR", () => {
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(0.125)).toBe("12,5%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatBRL", () => {
  it("formata sem centavos", () => {
    expect(plain(formatBRL(450000))).toBe("R$ 450.000");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --project unit`
Expected: FAIL — cannot resolve `@/domain/slug` etc.

- [ ] **Step 3: Implement**

`src/domain/slug.ts`:
```ts
export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "imovel";
}

export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Não foi possível gerar um endereço único para o imóvel");
}
```

`src/domain/phone.ts`:
```ts
/** Normaliza telefone brasileiro para dígitos com DDI 55 (ex.: 5567999991234). */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) return null;
  return digits;
}

export function formatBrPhone(digits: string): string {
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return digits;
}
```

`src/domain/format.ts`:
```ts
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.min(1, numerator / denominator);
}

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
export function formatPercent(value: number | null): string {
  return value === null ? "—" : percent.format(value);
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
export function formatBRL(value: number): string {
  return brl.format(value);
}
```

- [ ] **Step 4: Run tests** — `npx vitest run --project unit` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(domain): slug, telefone e formatação"`

---

### Task 3: Domain — questionnaire rules and scoring

**Files:**
- Create: `src/domain/types.ts`, `src/domain/questionnaire.ts`, `src/domain/scoring.ts`, `src/domain/default-questionnaire.ts`
- Test: `tests/unit/questionnaire.test.ts`, `tests/unit/scoring.test.ts`, `tests/unit/fixtures.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export const QUESTION_TYPES = ["TEXT", "NUMBER", "SINGLE_CHOICE", "MULTI_CHOICE", "YES_NO"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const CLASSIFICATIONS = ["HIGH", "MEDIUM", "LOW", "UNRATED"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];
export const CHANNELS = ["INSTAGRAM", "FACEBOOK", "GOOGLE", "QR_CODE", "DIRECT", "OTHER"] as const;
export type Channel = (typeof CHANNELS)[number];
export const LEAD_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "VISIT_SCHEDULED", "PROPOSAL", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const PROPERTY_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "SOLD", "RENTED"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "TOWNHOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_PURPOSES = ["SALE", "RENT"] as const;
export type PropertyPurpose = (typeof PROPERTY_PURPOSES)[number];
export type ShowIf = { questionId: string; optionIds: string[] };
export interface QuestionOptionDef { id: string; label: string; weight: number }
export interface QuestionDef {
  id: string; label: string; type: QuestionType; required: boolean;
  isVisitIntent: boolean; showIf: ShowIf | null; options: QuestionOptionDef[];
}
export interface AnswerValue { optionIds?: string[]; text?: string; number?: number }
export type AnswerMap = Record<string, AnswerValue>;
```
- `questionnaire.ts`: `isAnswered(q, a)`, `visibleQuestions(questions, answers)`, `validateAnswers(questions, answers): Record<string,string>`, `formatAnswer(q, a): string`, `detectVisitIntent(questions, answers): boolean`, `parseShowIf(json: unknown): ShowIf | null`
- `scoring.ts`: `questionMaxPoints(q)`, `answerPoints(q, a)`, `classify(score, maxScore)`, `scoreAnswers(questions, answers): ScoreResult` where `ScoreResult = { score: number; maxScore: number; classification: Classification; pointsByQuestion: Record<string, number> }`
- `default-questionnaire.ts`: `DEFAULT_QUESTIONNAIRE: QuestionTemplate[]`, `YES_NO_LABELS = ["Sim", "Não"] as const`, `QuestionTemplate = { label; type; required; isVisitIntent; options: { label: string; weight: number }[] }`

- [ ] **Step 1: Shared fixture** `tests/unit/fixtures.ts`:

```ts
import type { QuestionDef } from "@/domain/types";

const opt = (id: string, label: string, weight: number) => ({ id, label, weight });

export const questions: QuestionDef[] = [
  { id: "q1", label: "Pretende comprar ou alugar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q1a", "Comprar", 0), opt("q1b", "Alugar", 0), opt("q1c", "Ainda não sei", 0)] },
  { id: "q2", label: "Quando pretende fechar negócio?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q2a", "Imediatamente", 30), opt("q2b", "Em até 3 meses", 25), opt("q2c", "De 3 a 6 meses", 15), opt("q2d", "Só pesquisando", 5)] },
  { id: "q3", label: "Como pretende pagar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q3a", "À vista", 25), opt("q3b", "Financiamento", 15), opt("q3c", "Consórcio", 10), opt("q3d", "Ainda não sei", 0)] },
  { id: "q4", label: "Possui valor de entrada?", type: "YES_NO", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q4a", "Sim", 20), opt("q4b", "Não", 0)] },
  { id: "q5", label: "Gostaria de agendar uma visita?", type: "YES_NO", required: true, isVisitIntent: true, showIf: null,
    options: [opt("q5a", "Sim", 25), opt("q5b", "Não", 0)] },
];

export const pick = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([q, o]) => [q, { optionIds: [o] }]));
```

- [ ] **Step 2: Failing tests**

`tests/unit/scoring.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { classify, questionMaxPoints, scoreAnswers } from "@/domain/scoring";
import type { QuestionDef } from "@/domain/types";
import { pick, questions } from "./fixtures";

describe("classify", () => {
  it("aplica limites de 60% e 30%", () => {
    expect(classify(60, 100)).toBe("HIGH");
    expect(classify(59, 100)).toBe("MEDIUM");
    expect(classify(30, 100)).toBe("MEDIUM");
    expect(classify(29, 100)).toBe("LOW");
    expect(classify(0, 0)).toBe("UNRATED");
  });
});

describe("questionMaxPoints", () => {
  it("usa o maior peso em escolha única e a soma em múltipla", () => {
    expect(questionMaxPoints(questions[1])).toBe(30);
    const multi: QuestionDef = { ...questions[1], type: "MULTI_CHOICE" };
    expect(questionMaxPoints(multi)).toBe(75);
    expect(questionMaxPoints({ ...questions[0], type: "TEXT", options: [] })).toBe(0);
  });
});

describe("scoreAnswers", () => {
  it("lead ideal soma 100 de 100 → HIGH", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2a", q3: "q3a", q4: "q4a", q5: "q5a" }));
    expect(r).toMatchObject({ score: 100, maxScore: 100, classification: "HIGH" });
    expect(r.pointsByQuestion).toEqual({ q1: 0, q2: 30, q3: 25, q4: 20, q5: 25 });
  });
  it("65 pontos → HIGH", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2b", q3: "q3b", q4: "q4b", q5: "q5a" }));
    expect(r.score).toBe(65);
    expect(r.classification).toBe("HIGH");
  });
  it("exatamente 30 → MEDIUM", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2c", q3: "q3b", q4: "q4b", q5: "q5b" }));
    expect(r.score).toBe(30);
    expect(r.classification).toBe("MEDIUM");
  });
  it("só pesquisando → LOW", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1c", q2: "q2d", q3: "q3d", q4: "q4b", q5: "q5b" }));
    expect(r.classification).toBe("LOW");
  });
  it("sem perguntas pontuáveis → UNRATED", () => {
    expect(scoreAnswers([questions[0]], pick({ q1: "q1a" })).classification).toBe("UNRATED");
  });
  it("ignora opção de outra pergunta", () => {
    expect(scoreAnswers(questions, pick({ q2: "q3a" })).score).toBe(0);
  });
  it("pergunta oculta por condição não entra no máximo", () => {
    const conditional: QuestionDef = {
      id: "q6", label: "Já tem crédito aprovado?", type: "YES_NO", required: false, isVisitIntent: false,
      showIf: { questionId: "q3", optionIds: ["q3b"] }, options: [{ id: "q6a", label: "Sim", weight: 20 }, { id: "q6b", label: "Não", weight: 0 }],
    };
    const all = [...questions, conditional];
    const cash = scoreAnswers(all, pick({ q1: "q1a", q2: "q2a", q3: "q3a", q4: "q4a", q5: "q5a" }));
    expect(cash.maxScore).toBe(100);
    const financed = scoreAnswers(all, pick({ q1: "q1a", q2: "q2a", q3: "q3b", q4: "q4a", q5: "q5a", q6: "q6a" }));
    expect(financed.maxScore).toBe(120);
    expect(financed.score).toBe(110);
  });
});
```

`tests/unit/questionnaire.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { detectVisitIntent, formatAnswer, parseShowIf, validateAnswers, visibleQuestions } from "@/domain/questionnaire";
import type { QuestionDef } from "@/domain/types";
import { pick, questions } from "./fixtures";

const text: QuestionDef = { id: "t", label: "Observações", type: "TEXT", required: false, isVisitIntent: false, showIf: null, options: [] };
const num: QuestionDef = { id: "n", label: "Quantos quartos?", type: "NUMBER", required: true, isVisitIntent: false, showIf: null, options: [] };
const multi: QuestionDef = { id: "m", label: "O que é essencial?", type: "MULTI_CHOICE", required: false, isVisitIntent: false, showIf: null,
  options: [{ id: "m1", label: "Piscina", weight: 0 }, { id: "m2", label: "Quintal", weight: 0 }] };

describe("validateAnswers", () => {
  it("exige obrigatórias", () => {
    const errors = validateAnswers(questions, pick({ q1: "q1a" }));
    expect(Object.keys(errors).sort()).toEqual(["q2", "q3", "q4", "q5"]);
  });
  it("rejeita opção inexistente e múltiplas em escolha única", () => {
    expect(validateAnswers([questions[0]], pick({ q1: "zzz" }))).toEqual({ q1: "Opção inválida" });
    expect(validateAnswers([questions[0]], { q1: { optionIds: ["q1a", "q1b"] } })).toEqual({ q1: "Escolha apenas uma opção" });
  });
  it("aceita múltipla escolha, texto opcional vazio e número", () => {
    expect(validateAnswers([multi, text, num], { m: { optionIds: ["m1", "m2"] }, n: { number: 3 } })).toEqual({});
  });
  it("valida número e tamanho do texto", () => {
    expect(validateAnswers([num], { n: { number: -1 } })).toEqual({ n: "Número inválido" });
    expect(validateAnswers([text], { t: { text: "x".repeat(501) } })).toEqual({ t: "Resposta muito longa (máx. 500 caracteres)" });
  });
  it("não exige pergunta oculta", () => {
    const cond: QuestionDef = { ...questions[3], id: "c", required: true, showIf: { questionId: "q3", optionIds: ["q3b"] } };
    expect(validateAnswers([questions[2], cond], pick({ q3: "q3a" }))).toEqual({});
    expect(validateAnswers([questions[2], cond], pick({ q3: "q3b" }))).toEqual({ c: "Responda esta pergunta" });
  });
});

describe("visibleQuestions", () => {
  it("esconde filhos quando o pai está oculto", () => {
    const a: QuestionDef = { ...questions[3], id: "a", showIf: { questionId: "q3", optionIds: ["q3b"] } };
    const b: QuestionDef = { ...questions[3], id: "b", showIf: { questionId: "a", optionIds: ["q4a"] } };
    const ids = visibleQuestions([questions[2], a, b], { ...pick({ q3: "q3a" }), a: { optionIds: ["q4a"] } }).map((q) => q.id);
    expect(ids).toEqual(["q3"]);
  });
});

describe("formatAnswer", () => {
  it("formata cada tipo", () => {
    expect(formatAnswer(questions[1], { optionIds: ["q2b"] })).toBe("Em até 3 meses");
    expect(formatAnswer(multi, { optionIds: ["m1", "m2"] })).toBe("Piscina, Quintal");
    expect(formatAnswer(num, { number: 1500 })).toBe("1.500");
    expect(formatAnswer(text, { text: "  oi  " })).toBe("oi");
  });
});

describe("detectVisitIntent", () => {
  it("verdadeiro quando responde Sim na pergunta de visita", () => {
    expect(detectVisitIntent(questions, pick({ q5: "q5a" }))).toBe(true);
    expect(detectVisitIntent(questions, pick({ q5: "q5b" }))).toBe(false);
  });
});

describe("parseShowIf", () => {
  it("aceita formato válido e rejeita o resto", () => {
    expect(parseShowIf({ questionId: "q", optionIds: ["o"] })).toEqual({ questionId: "q", optionIds: ["o"] });
    expect(parseShowIf(null)).toBeNull();
    expect(parseShowIf({ questionId: 1 })).toBeNull();
  });
});
```

- [ ] **Step 3: Run** `npx vitest run --project unit` → FAIL (modules missing).

- [ ] **Step 4: Implement** — `src/domain/types.ts` exactly as in Interfaces above, then:

`src/domain/questionnaire.ts`:
```ts
import type { AnswerMap, AnswerValue, QuestionDef, ShowIf } from "./types";

export function isAnswered(q: Pick<QuestionDef, "type">, a: AnswerValue | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case "TEXT":
      return !!a.text?.trim();
    case "NUMBER":
      return typeof a.number === "number" && Number.isFinite(a.number);
    default:
      return (a.optionIds?.length ?? 0) > 0;
  }
}

/** Perguntas visíveis dadas as respostas atuais. Supõe pais antes dos filhos (ordem por posição). */
export function visibleQuestions<Q extends Pick<QuestionDef, "id" | "showIf">>(
  questions: Q[],
  answers: AnswerMap,
): Q[] {
  const visible: Q[] = [];
  const visibleIds = new Set<string>();
  for (const q of questions) {
    if (q.showIf) {
      const { questionId, optionIds } = q.showIf;
      if (!visibleIds.has(questionId)) continue;
      const selected = answers[questionId]?.optionIds ?? [];
      if (!selected.some((id) => optionIds.includes(id))) continue;
    }
    visible.push(q);
    visibleIds.add(q.id);
  }
  return visible;
}

export function validateAnswers(questions: QuestionDef[], answers: AnswerMap): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of visibleQuestions(questions, answers)) {
    const a = answers[q.id];
    if (!isAnswered(q, a)) {
      if (q.required) errors[q.id] = "Responda esta pergunta";
      continue;
    }
    if (q.type === "TEXT" && a!.text!.length > 500) {
      errors[q.id] = "Resposta muito longa (máx. 500 caracteres)";
    } else if (q.type === "NUMBER" && (a!.number! < 0 || a!.number! > 1e12)) {
      errors[q.id] = "Número inválido";
    } else if (q.type !== "TEXT" && q.type !== "NUMBER") {
      const ids = a!.optionIds!;
      const valid = new Set(q.options.map((o) => o.id));
      if (ids.some((id) => !valid.has(id))) errors[q.id] = "Opção inválida";
      else if (q.type !== "MULTI_CHOICE" && ids.length > 1) errors[q.id] = "Escolha apenas uma opção";
    }
  }
  return errors;
}

const numberFmt = new Intl.NumberFormat("pt-BR");

export function formatAnswer(q: QuestionDef, a: AnswerValue): string {
  switch (q.type) {
    case "TEXT":
      return a.text?.trim() ?? "";
    case "NUMBER":
      return a.number === undefined ? "" : numberFmt.format(a.number);
    default: {
      const labels = new Map(q.options.map((o) => [o.id, o.label]));
      return (a.optionIds ?? []).map((id) => labels.get(id)).filter(Boolean).join(", ");
    }
  }
}

export function detectVisitIntent(questions: QuestionDef[], answers: AnswerMap): boolean {
  return visibleQuestions(questions, answers).some((q) => {
    if (!q.isVisitIntent) return false;
    const selected = new Set(answers[q.id]?.optionIds ?? []);
    return q.options.some(
      (o) => selected.has(o.id) && (o.weight > 0 || o.label.trim().toLowerCase() === "sim"),
    );
  });
}

export function parseShowIf(value: unknown): ShowIf | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.questionId !== "string" || !Array.isArray(v.optionIds)) return null;
  if (!v.optionIds.every((id) => typeof id === "string")) return null;
  return { questionId: v.questionId, optionIds: v.optionIds as string[] };
}
```

`src/domain/scoring.ts`:
```ts
import { visibleQuestions } from "./questionnaire";
import type { AnswerMap, AnswerValue, Classification, QuestionDef } from "./types";

export const HIGH_THRESHOLD = 0.6;
export const MEDIUM_THRESHOLD = 0.3;

export interface ScoreResult {
  score: number;
  maxScore: number;
  classification: Classification;
  pointsByQuestion: Record<string, number>;
}

export function questionMaxPoints(q: QuestionDef): number {
  const weights = q.options.map((o) => o.weight);
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "YES_NO":
      return Math.max(0, ...weights);
    case "MULTI_CHOICE":
      return weights.filter((w) => w > 0).reduce((sum, w) => sum + w, 0);
    default:
      return 0;
  }
}

export function answerPoints(q: QuestionDef, a: AnswerValue | undefined): number {
  if (q.type === "TEXT" || q.type === "NUMBER" || !a?.optionIds?.length) return 0;
  const weights = new Map(q.options.map((o) => [o.id, o.weight]));
  const ids = q.type === "MULTI_CHOICE" ? a.optionIds : a.optionIds.slice(0, 1);
  return Math.max(0, ids.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0));
}

export function classify(score: number, maxScore: number): Classification {
  if (maxScore <= 0) return "UNRATED";
  const pct = score / maxScore;
  if (pct >= HIGH_THRESHOLD) return "HIGH";
  if (pct >= MEDIUM_THRESHOLD) return "MEDIUM";
  return "LOW";
}

export function scoreAnswers(questions: QuestionDef[], answers: AnswerMap): ScoreResult {
  const pointsByQuestion: Record<string, number> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of visibleQuestions(questions, answers)) {
    const points = answerPoints(q, answers[q.id]);
    pointsByQuestion[q.id] = points;
    score += points;
    maxScore += questionMaxPoints(q);
  }
  return { score, maxScore, classification: classify(score, maxScore), pointsByQuestion };
}
```

Note: `pointsByQuestion` only includes visible questions — the "ideal lead" test expects exactly `{q1..q5}`, which holds.

`src/domain/default-questionnaire.ts`:
```ts
import type { QuestionType } from "./types";

export const YES_NO_LABELS = ["Sim", "Não"] as const;

export interface QuestionTemplate {
  label: string;
  type: QuestionType;
  required: boolean;
  isVisitIntent: boolean;
  options: { label: string; weight: number }[];
}

export const DEFAULT_QUESTIONNAIRE: QuestionTemplate[] = [
  { label: "Você pretende comprar ou alugar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "Comprar", weight: 0 }, { label: "Alugar", weight: 0 }, { label: "Ainda não sei", weight: 0 }] },
  { label: "Quando pretende fechar negócio?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "Imediatamente", weight: 30 }, { label: "Em até 3 meses", weight: 25 }, { label: "De 3 a 6 meses", weight: 15 }, { label: "Só estou pesquisando", weight: 5 }] },
  { label: "Como pretende pagar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "À vista", weight: 25 }, { label: "Financiamento", weight: 15 }, { label: "Consórcio", weight: 10 }, { label: "Ainda não sei", weight: 0 }] },
  { label: "Você possui valor de entrada?", type: "YES_NO", required: true, isVisitIntent: false,
    options: [{ label: "Sim", weight: 20 }, { label: "Não", weight: 0 }] },
  { label: "Gostaria de agendar uma visita?", type: "YES_NO", required: true, isVisitIntent: true,
    options: [{ label: "Sim", weight: 25 }, { label: "Não", weight: 0 }] },
];
```

- [ ] **Step 5: Run** `npx vitest run --project unit` → PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat(domain): regras do questionário e pontuação"` (use `git add -A` first).

---

### Task 4: Domain — attribution, WhatsApp message, labels, consent, rate limiter

**Files:**
- Create: `src/domain/attribution.ts`, `src/domain/whatsapp.ts`, `src/domain/labels.ts`, `src/domain/consent.ts`, `src/server/rate-limit.ts`
- Test: `tests/unit/attribution.test.ts`, `tests/unit/whatsapp.test.ts`, `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `resolveAttribution(input: AttributionInput): Attribution`
    - `AttributionInput = { utmSource?, utmMedium?, utmCampaign?, utmContent?, utmTerm?, referrer?, gclid?, fbclid?: string | null; ownHost?: string | null }`
    - `Attribution = { channel: Channel; utmSource, utmMedium, utmCampaign, utmContent, utmTerm, referrer: string | null }`
  - `buildLeadMessage(input: { leadName: string; propertyTitle: string; propertyUrl: string; lines: { label: string; value: string }[] }): string`
  - `buildWhatsappUrl(phoneDigits: string, message: string): string`
  - `interface LeadHandoffChannel { buildHandoffUrl(input: { phone: string; message: string }): string }` and `waMeChannel`
  - `CHANNEL_LABELS`, `LEAD_STATUS_LABELS`, `CLASSIFICATION_LABELS`, `PROPERTY_STATUS_LABELS`, `PROPERTY_TYPE_LABELS`, `PROPERTY_PURPOSE_LABELS`, `QUESTION_TYPE_LABELS`, `CLASSIFICATION_DISCLAIMER`
  - `CONSENT_TEXT: string`
  - `checkRateLimit(key: string, limit: number, windowMs: number, now?: number): boolean`

- [ ] **Step 1: Failing tests**

`tests/unit/attribution.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveAttribution } from "@/domain/attribution";

describe("resolveAttribution", () => {
  it.each([
    [{ utmSource: "instagram" }, "INSTAGRAM"],
    [{ utmSource: "IG" }, "INSTAGRAM"],
    [{ utmSource: "facebook", utmMedium: "paid" }, "FACEBOOK"],
    [{ utmSource: "qrcode" }, "QR_CODE"],
    [{ utmSource: "google" }, "GOOGLE"],
    [{ gclid: "abc" }, "GOOGLE"],
    [{ fbclid: "abc" }, "FACEBOOK"],
    [{ fbclid: "abc", referrer: "https://l.instagram.com/" }, "INSTAGRAM"],
    [{ referrer: "https://www.instagram.com/" }, "INSTAGRAM"],
    [{ referrer: "https://m.facebook.com/" }, "FACEBOOK"],
    [{ referrer: "https://www.google.com.br/" }, "GOOGLE"],
    [{ referrer: "https://exemplo.com/" }, "OTHER"],
    [{ utmSource: "newsletter" }, "OTHER"],
    [{}, "DIRECT"],
  ] as const)("%o → %s", (input, channel) => {
    expect(resolveAttribution(input).channel).toBe(channel);
  });

  it("trata o próprio site como acesso direto e descarta o referrer", () => {
    const r = resolveAttribution({ referrer: "https://app.exemplo.com/imovel/x", ownHost: "app.exemplo.com" });
    expect(r).toMatchObject({ channel: "DIRECT", referrer: null });
  });

  it("preserva UTMs aparados e limitados", () => {
    const r = resolveAttribution({ utmSource: " instagram ", utmCampaign: "c".repeat(300) });
    expect(r.utmSource).toBe("instagram");
    expect(r.utmCampaign).toHaveLength(200);
    expect(r.utmMedium).toBeNull();
  });
});
```

`tests/unit/whatsapp.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildLeadMessage, buildWhatsappUrl } from "@/domain/whatsapp";

describe("buildLeadMessage", () => {
  it("monta mensagem com resumo", () => {
    const msg = buildLeadMessage({
      leadName: "João",
      propertyTitle: "Casa Jardim dos Estados",
      propertyUrl: "https://x.com/imovel/casa",
      lines: [{ label: "Finalidade", value: "Comprar" }, { label: "Visita", value: "Sim" }],
    });
    expect(msg).toBe(
      "Olá, sou João.\n\nTenho interesse no imóvel: Casa Jardim dos Estados\nhttps://x.com/imovel/casa\n\nMinhas informações:\n• Finalidade: Comprar\n• Visita: Sim\n\nGostaria de receber mais informações.",
    );
  });
  it("omite a seção de informações quando não há respostas", () => {
    const msg = buildLeadMessage({ leadName: "Ana", propertyTitle: "Apto", propertyUrl: "u", lines: [] });
    expect(msg).not.toContain("Minhas informações");
  });
});

describe("buildWhatsappUrl", () => {
  it("codifica a mensagem", () => {
    expect(buildWhatsappUrl("5567999991234", "Olá & tchau")).toBe(
      "https://wa.me/5567999991234?text=Ol%C3%A1%20%26%20tchau",
    );
  });
});
```

`tests/unit/rate-limit.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/server/rate-limit";

describe("checkRateLimit", () => {
  it("bloqueia após o limite e libera após a janela", () => {
    const key = `k-${Math.random()}`;
    expect(checkRateLimit(key, 2, 1000, 0)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 10)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 20)).toBe(false);
    expect(checkRateLimit(key, 2, 1000, 1001)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run --project unit` → FAIL.

- [ ] **Step 3: Implement**

`src/domain/attribution.ts`:
```ts
import type { Channel } from "./types";

export interface AttributionInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ownHost?: string | null;
}

export interface Attribution {
  channel: Channel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
}

const clean = (v: string | null | undefined, max = 200) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

function channelFromSource(source: string): Channel {
  const s = source.toLowerCase();
  if (s.includes("qr")) return "QR_CODE";
  if (s === "ig" || s.includes("instagram")) return "INSTAGRAM";
  if (s === "fb" || s === "meta" || s.includes("facebook")) return "FACEBOOK";
  if (s === "adwords" || s.includes("google")) return "GOOGLE";
  return "OTHER";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function channelFromHost(host: string): Channel | null {
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "INSTAGRAM";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com")) return "FACEBOOK";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "GOOGLE";
  return null;
}

export function resolveAttribution(input: AttributionInput): Attribution {
  const utmSource = clean(input.utmSource);
  const referrer = clean(input.referrer, 500);
  const refHost = referrer ? hostOf(referrer) : null;
  const ownHost = input.ownHost?.toLowerCase().split(":")[0] ?? null;
  const externalHost = refHost && refHost !== ownHost ? refHost : null;

  let channel: Channel;
  if (utmSource) channel = channelFromSource(utmSource);
  else if (clean(input.gclid)) channel = "GOOGLE";
  else if (clean(input.fbclid))
    channel = externalHost && channelFromHost(externalHost) === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK";
  else if (externalHost) channel = channelFromHost(externalHost) ?? "OTHER";
  else channel = "DIRECT";

  return {
    channel,
    utmSource,
    utmMedium: clean(input.utmMedium),
    utmCampaign: clean(input.utmCampaign),
    utmContent: clean(input.utmContent),
    utmTerm: clean(input.utmTerm),
    referrer: externalHost ? referrer : null,
  };
}
```

`src/domain/whatsapp.ts`:
```ts
export interface SummaryLine {
  label: string;
  value: string;
}

export function buildLeadMessage(input: {
  leadName: string;
  propertyTitle: string;
  propertyUrl: string;
  lines: SummaryLine[];
}): string {
  const parts = [
    `Olá, sou ${input.leadName}.`,
    `Tenho interesse no imóvel: ${input.propertyTitle}\n${input.propertyUrl}`,
  ];
  if (input.lines.length > 0) {
    parts.push(`Minhas informações:\n${input.lines.map((l) => `• ${l.label}: ${l.value}`).join("\n")}`);
  }
  parts.push("Gostaria de receber mais informações.");
  return parts.join("\n\n");
}

export function buildWhatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** Ponto de extensão para uma futura integração com a API oficial do WhatsApp Business. */
export interface LeadHandoffChannel {
  buildHandoffUrl(input: { phone: string; message: string }): string;
}

export const waMeChannel: LeadHandoffChannel = {
  buildHandoffUrl: ({ phone, message }) => buildWhatsappUrl(phone, message),
};
```

`src/domain/labels.ts`:
```ts
import type { Channel, Classification, LeadStatus, PropertyPurpose, PropertyStatus, PropertyType, QuestionType } from "./types";

export const CHANNEL_LABELS: Record<Channel, string> = {
  INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE: "Google", QR_CODE: "QR Code", DIRECT: "Link direto", OTHER: "Outros",
};
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo", CONTACTED: "Contatado", NEGOTIATING: "Em negociação", VISIT_SCHEDULED: "Visita agendada",
  PROPOSAL: "Proposta", CONVERTED: "Convertido", LOST: "Perdido",
};
export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  HIGH: "Alta intenção", MEDIUM: "Média intenção", LOW: "Baixa intenção", UNRATED: "Sem classificação",
};
export const CLASSIFICATION_DISCLAIMER = "Indicação baseada nas respostas — não é garantia de intenção.";
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicado", PAUSED: "Pausado", SOLD: "Vendido", RENTED: "Alugado",
};
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "Casa", APARTMENT: "Apartamento", TOWNHOUSE: "Sobrado", LAND: "Terreno", COMMERCIAL: "Comercial", OTHER: "Outro",
};
export const PROPERTY_PURPOSE_LABELS: Record<PropertyPurpose, string> = { SALE: "Venda", RENT: "Aluguel" };
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Escolha única", MULTI_CHOICE: "Múltipla escolha", YES_NO: "Sim ou não", TEXT: "Texto", NUMBER: "Número",
};
```

`src/domain/consent.ts`:
```ts
export const CONSENT_TEXT =
  "Concordo em compartilhar meus dados com o corretor responsável por este imóvel para ser contatado sobre ele, conforme a Política de Privacidade.";
```

`src/server/rate-limit.ts`:
```ts
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Limitador em memória (por instância). Em produção com várias instâncias, trocar por Redis/Upstash. */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
```

- [ ] **Step 4: Run** `npx vitest run --project unit` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(domain): origem do lead, mensagem do WhatsApp, rótulos e rate limit"`

---

### Task 5: Database schema, Prisma client, integration test harness

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `src/server/db.ts`, `src/server/context.ts`, `src/server/errors.ts`, `src/lib/validation/parse.ts`, `tests/integration/global-setup.ts`, `tests/integration/setup.ts`, `tests/integration/helpers.ts`
- Modify: `package.json` (add `"postinstall": "prisma generate"`)
- Test: `tests/integration/db.test.ts`

**Interfaces:**
- Produces: `db` (PrismaClient), `type Tx = Prisma.TransactionClient`, `type Ctx = { accountId: string; userId: string }`, errors `AppError`, `NotFoundError(what?)`, `ValidationError(fieldErrors, message?)`, `ConflictError(message)`, `RateLimitError()`, `parseOrThrow(schema, input)`, test helper `resetDb()`.

- [ ] **Step 1: Prisma config** `prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
```

- [ ] **Step 2: Schema** `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum UserRole { OWNER AGENT }
enum PropertyType { HOUSE APARTMENT TOWNHOUSE LAND COMMERCIAL OTHER }
enum PropertyPurpose { SALE RENT }
enum PropertyStatus { DRAFT PUBLISHED PAUSED SOLD RENTED }
enum QuestionType { TEXT NUMBER SINGLE_CHOICE MULTI_CHOICE YES_NO }
enum LeadClassification { HIGH MEDIUM LOW UNRATED }
enum LeadStatus { NEW CONTACTED NEGOTIATING VISIT_SCHEDULED PROPOSAL CONVERTED LOST }
enum Channel { INSTAGRAM FACEBOOK GOOGLE QR_CODE DIRECT OTHER }
enum AnalyticsEventType { PAGE_VIEW QUESTIONNAIRE_START QUESTIONNAIRE_COMPLETE WHATSAPP_CLICK }

model Account {
  id             String           @id @default(cuid())
  name           String
  createdAt      DateTime         @default(now())
  users          User[]
  properties     Property[]
  questionnaires Questionnaire[]
  leads          Lead[]
  events         AnalyticsEvent[]
}

model User {
  id           String     @id @default(cuid())
  accountId    String
  account      Account    @relation(fields: [accountId], references: [id], onDelete: Cascade)
  name         String
  email        String     @unique
  passwordHash String
  role         UserRole   @default(OWNER)
  photoUrl     String?
  photoKey     String?
  creci        String?
  phone        String?
  whatsapp     String?
  bio          String?
  agencyName   String?
  instagramUrl String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  sessions     Session[]
  properties   Property[]
  notes        LeadNote[]
  statusChanges LeadStatusHistory[]

  @@index([accountId])
}

model Session {
  id        String   @id // SHA-256 do token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model Property {
  id             String          @id @default(cuid())
  accountId      String
  account        Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)
  agentId        String
  agent          User            @relation(fields: [agentId], references: [id], onDelete: Restrict)
  slug           String          @unique
  title          String
  type           PropertyType
  purpose        PropertyPurpose
  price          Int
  condoFee       Int?
  iptu           Int?
  city           String
  neighborhood   String
  address        String?
  showAddress    Boolean         @default(false)
  bedrooms       Int?
  suites         Int?
  bathrooms      Int?
  parkingSpots   Int?
  builtArea      Float?
  landArea       Float?
  description    String
  highlights     String[]
  financingInfo  String?
  status         PropertyStatus  @default(DRAFT)
  publishedAt    DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  images         PropertyImage[]
  questionnaires Questionnaire[]
  leads          Lead[]
  events         AnalyticsEvent[]

  @@index([accountId, status])
}

model PropertyImage {
  id         String   @id @default(cuid())
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  url        String
  storageKey String
  position   Int
  createdAt  DateTime @default(now())

  @@index([propertyId, position])
}

model Questionnaire {
  id         String     @id @default(cuid())
  accountId  String
  account    Account    @relation(fields: [accountId], references: [id], onDelete: Cascade)
  propertyId String? // nulo = padrão da conta
  property   Property?  @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  name       String
  isDefault  Boolean    @default(false)
  createdAt  DateTime   @default(now())
  questions  Question[]

  @@index([accountId])
}

model Question {
  id              String           @id @default(cuid())
  questionnaireId String
  questionnaire   Questionnaire    @relation(fields: [questionnaireId], references: [id], onDelete: Cascade)
  label           String
  type            QuestionType
  required        Boolean          @default(true)
  isVisitIntent   Boolean          @default(false)
  position        Int
  showIf          Json? // { questionId, optionIds[] } — reservado p/ perguntas condicionais
  options         QuestionOption[]
  answers         LeadAnswer[]

  @@index([questionnaireId, position])
}

model QuestionOption {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  label      String
  weight     Int      @default(0)
  position   Int
}

model Lead {
  id                String              @id @default(cuid())
  accountId         String
  account           Account             @relation(fields: [accountId], references: [id], onDelete: Cascade)
  propertyId        String
  property          Property            @relation(fields: [propertyId], references: [id], onDelete: Restrict)
  publicToken       String              @unique
  name              String
  phone             String
  email             String?
  consentAt         DateTime
  consentText       String
  score             Int                 @default(0)
  maxScore          Int                 @default(0)
  classification    LeadClassification  @default(UNRATED)
  status            LeadStatus          @default(NEW)
  isComplete        Boolean             @default(false)
  completedAt       DateTime?
  wantsVisit        Boolean             @default(false)
  channel           Channel             @default(DIRECT)
  utmSource         String?
  utmMedium         String?
  utmCampaign       String?
  utmContent        String?
  utmTerm           String?
  referrer          String?
  landingUrl        String?
  visitorId         String?
  whatsappClickedAt DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  answers           LeadAnswer[]
  notes             LeadNote[]
  history           LeadStatusHistory[]

  @@index([accountId, createdAt])
  @@index([propertyId, phone])
}

model LeadAnswer {
  id            String    @id @default(cuid())
  leadId        String
  lead          Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  questionId    String?
  question      Question? @relation(fields: [questionId], references: [id], onDelete: SetNull)
  questionLabel String
  position      Int
  value         Json
  displayValue  String
  points        Int       @default(0)

  @@index([leadId])
}

model LeadNote {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  authorId  String?
  author    User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)
  body      String
  createdAt DateTime @default(now())

  @@index([leadId])
}

model LeadStatusHistory {
  id          String      @id @default(cuid())
  leadId      String
  lead        Lead        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  fromStatus  LeadStatus?
  toStatus    LeadStatus
  changedById String?
  changedBy   User?       @relation(fields: [changedById], references: [id], onDelete: SetNull)
  createdAt   DateTime    @default(now())

  @@index([leadId])
}

model AnalyticsEvent {
  id         String             @id @default(cuid())
  accountId  String
  account    Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  propertyId String
  property   Property           @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  type       AnalyticsEventType
  visitorId  String?
  channel    Channel            @default(DIRECT)
  utmSource  String?
  utmCampaign String?
  createdAt  DateTime           @default(now())

  @@index([accountId, type, createdAt])
  @@index([propertyId, type])
}
```

- [ ] **Step 3: Generate client and first migration**

```bash
npm pkg set scripts.postinstall="prisma generate"
npx prisma migrate dev --name init
```
Expected: migration folder `prisma/migrations/<ts>_init` created, client generated in `src/generated/prisma`.

- [ ] **Step 4: Server basics**

`src/server/db.ts`:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;
```

`src/server/context.ts`:
```ts
/** Contexto de autorização: sempre vem da sessão, nunca do cliente. */
export type Ctx = { accountId: string; userId: string };
```

`src/server/errors.ts`:
```ts
export class AppError extends Error {}

export class NotFoundError extends AppError {
  constructor(what = "Registro") {
    super(`${what} não encontrado`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(
    public readonly fieldErrors: Record<string, string>,
    message = "Verifique os campos destacados",
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    this.name = "RateLimitError";
  }
}
```

`src/lib/validation/parse.ts`:
```ts
import type { z } from "zod";
import { ValidationError } from "@/server/errors";

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] ??= issue.message;
  }
  throw new ValidationError(fieldErrors);
}

/** Converte "" em undefined (campos opcionais vindos de FormData). */
export const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;
```

- [ ] **Step 5: Test harness**

`tests/integration/global-setup.ts`:
```ts
import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não configurada");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
```

`tests/integration/helpers.ts`:
```ts
import { db } from "@/server/db";

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "AnalyticsEvent","LeadStatusHistory","LeadNote","LeadAnswer","Lead","QuestionOption","Question","Questionnaire","PropertyImage","Property","Session","User","Account" CASCADE`,
  );
}
```

`tests/integration/setup.ts`:
```ts
import { afterAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.$disconnect();
});
```

- [ ] **Step 6: Smoke test** `tests/integration/db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

describe("banco de teste", () => {
  it("grava e limpa registros", async () => {
    await db.account.create({ data: { name: "Teste" } });
    expect(await db.account.count()).toBe(1);
    await resetDb();
    expect(await db.account.count()).toBe(0);
  });
});
```

- [ ] **Step 7: Run** `npx vitest run --project integration` → PASS (requires `docker compose up -d db`).

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(db): schema Prisma, cliente e harness de testes de integração"`

---

### Task 6: Accounts, sessions and profile

**Files:**
- Create: `src/lib/validation/auth.ts`, `src/lib/validation/profile.ts`, `src/server/auth/password.ts`, `src/server/auth/session.ts`, `src/server/auth/current.ts`, `src/server/services/accounts.ts`, `src/server/services/profile.ts`, `src/server/services/questionnaires.ts` (only `createDefaultQuestionnaire` for now), `src/server/storage/{index,local,memory,supabase,sniff}.ts`
- Modify: `tests/integration/helpers.ts` (add `makeAgent`)
- Test: `tests/integration/auth.test.ts`, `tests/integration/profile.test.ts`, `tests/unit/sniff.test.ts`

**Interfaces:**
- Consumes: `db`, `Tx`, `Ctx`, `parseOrThrow`, `ValidationError`, `DEFAULT_QUESTIONNAIRE`, `normalizeBrPhone`
- Produces:
  - `signup(input: unknown): Promise<Ctx>`; `authenticate(input: unknown): Promise<Ctx | null>`
  - `createSession(userId): Promise<{ token: string; expiresAt: Date }>`, `getSessionUser(token?: string): Promise<SessionUser | null>` (`SessionUser = Ctx & { name: string; email: string }`), `deleteSession(token)`
  - `current.ts` (Next-only): `SESSION_COOKIE`, `getCurrentUser()`, `requireUser(): Promise<SessionUser>`, `setSessionCookie(token, expiresAt)`, `clearSessionCookie()`
  - `createDefaultQuestionnaire(tx: Tx, accountId: string)`
  - `getProfile(ctx)`, `updateProfile(ctx, input: unknown)`, `updateProfilePhoto(ctx, file: { data: Buffer })`
  - `StorageProvider { put(key, data: Buffer, contentType): Promise<{ url: string }>; delete(key): Promise<void> }`, `getStorage(): StorageProvider`
  - `sniffImageType(data: Buffer): { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | null`
  - test helper `makeAgent(opts?: { name?: string; whatsapp?: string | null }): Promise<Ctx>`

- [ ] **Step 1: Failing tests**

`tests/unit/sniff.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/server/storage/sniff";
import { PNG_1PX } from "../fixtures/images";

describe("sniffImageType", () => {
  it("detecta PNG, JPEG e WebP pelos bytes", () => {
    expect(sniffImageType(PNG_1PX)?.ext).toBe("png");
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe("jpg");
    expect(sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))?.ext).toBe("webp");
  });
  it("rejeita outros formatos", () => {
    expect(sniffImageType(Buffer.from("<svg></svg>"))).toBeNull();
  });
});
```

`tests/integration/auth.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createSession, deleteSession, getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { authenticate, signup } from "@/server/services/accounts";

const valid = { name: "Ana Martins", email: "Ana@Exemplo.com", password: "senha-segura-123" };

describe("signup", () => {
  it("cria conta, usuário e questionário padrão", async () => {
    const ctx = await signup(valid);
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    expect(user.email).toBe("ana@exemplo.com");
    expect(user.passwordHash).not.toContain("senha");
    const qn = await db.questionnaire.findFirstOrThrow({
      where: { accountId: ctx.accountId, isDefault: true },
      include: { questions: { orderBy: { position: "asc" }, include: { options: true } } },
    });
    expect(qn.questions).toHaveLength(5);
    expect(qn.questions[4].isVisitIntent).toBe(true);
  });

  it("recusa e-mail duplicado", async () => {
    await signup(valid);
    await expect(signup({ ...valid, email: "ana@exemplo.com" })).rejects.toMatchObject({
      fieldErrors: { email: "Este e-mail já está cadastrado" },
    });
  });

  it("recusa senha curta", async () => {
    await expect(signup({ ...valid, password: "123" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("authenticate", () => {
  it("aceita credenciais corretas sem diferenciar maiúsculas no e-mail", async () => {
    const ctx = await signup(valid);
    expect(await authenticate({ email: "ANA@exemplo.com", password: valid.password })).toEqual(ctx);
  });
  it("recusa senha errada e e-mail desconhecido", async () => {
    await signup(valid);
    expect(await authenticate({ email: valid.email, password: "errada-123" })).toBeNull();
    expect(await authenticate({ email: "x@y.com", password: "qualquer-123" })).toBeNull();
  });
});

describe("sessões", () => {
  it("cria, lê e remove sessão", async () => {
    const ctx = await signup(valid);
    const { token } = await createSession(ctx.userId);
    expect(await getSessionUser(token)).toMatchObject({ ...ctx, name: "Ana Martins" });
    const stored = await db.session.findFirstOrThrow();
    expect(stored.id).not.toBe(token);
    await deleteSession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
  it("ignora sessão expirada ou token inválido", async () => {
    const ctx = await signup(valid);
    const { token } = await createSession(ctx.userId);
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getSessionUser(token)).toBeNull();
    expect(await getSessionUser("inexistente")).toBeNull();
    expect(await getSessionUser(undefined)).toBeNull();
  });
});
```

`tests/integration/profile.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { getProfile, updateProfile, updateProfilePhoto } from "@/server/services/profile";
import { PNG_1PX } from "../fixtures/images";
import { makeAgent } from "./helpers";

describe("perfil", () => {
  it("normaliza WhatsApp e Instagram", async () => {
    const ctx = await makeAgent({ whatsapp: null });
    await updateProfile(ctx, { name: "Ana", whatsapp: "(67) 99999-1234", instagramUrl: "@ana.imoveis", creci: "12345-F" });
    const p = await getProfile(ctx);
    expect(p.whatsapp).toBe("5567999991234");
    expect(p.instagramUrl).toBe("https://instagram.com/ana.imoveis");
  });
  it("recusa WhatsApp inválido", async () => {
    const ctx = await makeAgent();
    await expect(updateProfile(ctx, { name: "Ana", whatsapp: "123" })).rejects.toMatchObject({
      fieldErrors: { whatsapp: expect.any(String) },
    });
  });
  it("salva foto", async () => {
    const ctx = await makeAgent();
    await updateProfilePhoto(ctx, { data: PNG_1PX });
    expect((await getProfile(ctx)).photoUrl).toMatch(/^memory:\/\//);
  });
});
```
`tests/fixtures/images.ts` (shared by unit and integration tests):
```ts
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
```

- [ ] **Step 2: Run** `npx vitest run` → FAIL.

- [ ] **Step 3: Implement validation**

`src/lib/validation/auth.ts`:
```ts
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
```

`src/lib/validation/profile.ts`:
```ts
import { z } from "zod";
import { normalizeBrPhone } from "@/domain/phone";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeBrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Número inválido. Use DDD + número" });
      return z.NEVER;
    }
    return n;
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  creci: optionalText(30),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  bio: optionalText(600),
  agencyName: optionalText(100),
  instagramUrl: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => {
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return v;
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    }),
});
```

- [ ] **Step 4: Implement storage**

`src/server/storage/sniff.ts`:
```ts
export type SniffedImage =
  | { contentType: "image/jpeg"; ext: "jpg" }
  | { contentType: "image/png"; ext: "png" }
  | { contentType: "image/webp"; ext: "webp" };

export function sniffImageType(data: Buffer): SniffedImage | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: "image/png", ext: "png" };
  if (data.length >= 12 && data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") return { contentType: "image/webp", ext: "webp" };
  return null;
}
```

`src/server/storage/index.ts`:
```ts
import { LocalStorage } from "./local";
import { MemoryStorage } from "./memory";
import { SupabaseStorage } from "./supabase";

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "memory") instance = new MemoryStorage();
  else if (driver === "supabase") instance = new SupabaseStorage();
  else instance = new LocalStorage();
  return instance;
}
```

`src/server/storage/memory.ts`:
```ts
import type { StorageProvider } from "./index";

export class MemoryStorage implements StorageProvider {
  readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.files.set(key, data);
    return { url: `memory://${key}` };
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}
```

`src/server/storage/local.ts`:
```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./index";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/** Apenas para desenvolvimento: grava em disco e é servido por /uploads/[...key]. */
export class LocalStorage implements StorageProvider {
  async put(key: string, data: Buffer) {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { url: `/uploads/${key}` };
  }
  async delete(key: string) {
    await rm(path.join(LOCAL_UPLOAD_DIR, key), { force: true });
  }
}
```

`src/server/storage/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import type { StorageProvider } from "./index";

export class SupabaseStorage implements StorageProvider {
  private readonly bucket = process.env.SUPABASE_BUCKET ?? "property-images";
  private readonly client = (() => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias com STORAGE_DRIVER=supabase");
    return createClient(url, key, { auth: { persistSession: false } });
  })();

  async put(key: string, data: Buffer, contentType: string) {
    const bucket = this.client.storage.from(this.bucket);
    const { error } = await bucket.upload(key, data, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);
    return { url: bucket.getPublicUrl(key).data.publicUrl };
  }

  async delete(key: string) {
    await this.client.storage.from(this.bucket).remove([key]);
  }
}
```

- [ ] **Step 5: Implement auth + accounts + profile + default questionnaire**

`src/server/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
```

`src/server/auth/session.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import type { Ctx } from "@/server/context";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = Ctx & { name: string; email: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const { user } = session;
  return { userId: user.id, accountId: user.accountId, name: user.name, email: user.email };
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
```

`src/server/auth/current.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser, type SessionUser } from "./session";

export const SESSION_COOKIE = "sc_session";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
```

`src/server/services/questionnaires.ts` (initial content):
```ts
import { DEFAULT_QUESTIONNAIRE } from "@/domain/default-questionnaire";
import type { Tx } from "@/server/db";

export async function createDefaultQuestionnaire(tx: Tx, accountId: string) {
  return tx.questionnaire.create({
    data: {
      accountId,
      name: "Questionário padrão",
      isDefault: true,
      questions: {
        create: DEFAULT_QUESTIONNAIRE.map((q, i) => ({
          label: q.label,
          type: q.type,
          required: q.required,
          isVisitIntent: q.isVisitIntent,
          position: i,
          options: { create: q.options.map((o, j) => ({ label: o.label, weight: o.weight, position: j })) },
        })),
      },
    },
  });
}
```

`src/server/services/accounts.ts`:
```ts
import { loginSchema, signupSchema } from "@/lib/validation/auth";
import { parseOrThrow } from "@/lib/validation/parse";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { createDefaultQuestionnaire } from "./questionnaires";

const EMAIL_TAKEN = { email: "Este e-mail já está cadastrado" };
let dummyHash: Promise<string> | null = null;

export async function signup(input: unknown): Promise<Ctx> {
  const data = parseOrThrow(signupSchema, input);
  if (await db.user.findUnique({ where: { email: data.email } })) throw new ValidationError(EMAIL_TAKEN);
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { name: data.name } });
      const user = await tx.user.create({
        data: { accountId: account.id, name: data.name, email: data.email, passwordHash },
      });
      await createDefaultQuestionnaire(tx, account.id);
      return { accountId: account.id, userId: user.id };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ValidationError(EMAIL_TAKEN);
    throw e;
  }
}

export async function authenticate(input: unknown): Promise<Ctx | null> {
  const data = parseOrThrow(loginSchema, input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user) {
    // mantém tempo de resposta semelhante para não revelar e-mails cadastrados
    await verifyPassword(data.password, await (dummyHash ??= hashPassword("dummy-password")));
    return null;
  }
  if (!(await verifyPassword(data.password, user.passwordHash))) return null;
  return { accountId: user.accountId, userId: user.id };
}
```

`src/server/services/profile.ts`:
```ts
import { randomUUID } from "node:crypto";
import { parseOrThrow } from "@/lib/validation/parse";
import { profileSchema } from "@/lib/validation/profile";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getStorage } from "@/server/storage";
import { sniffImageType } from "@/server/storage/sniff";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function getProfile(ctx: Ctx) {
  const user = await db.user.findFirst({ where: { id: ctx.userId, accountId: ctx.accountId } });
  if (!user) throw new NotFoundError("Usuário");
  const { passwordHash: _omit, ...profile } = user;
  return profile;
}

export async function updateProfile(ctx: Ctx, input: unknown) {
  const data = parseOrThrow(profileSchema, input);
  await getProfile(ctx);
  await db.user.update({ where: { id: ctx.userId }, data });
}

export async function updateProfilePhoto(ctx: Ctx, file: { data: Buffer }) {
  const current = await getProfile(ctx);
  const type = sniffImageType(file.data);
  if (!type) throw new ValidationError({ photo: "Envie uma imagem JPG, PNG ou WebP" });
  if (file.data.byteLength > MAX_IMAGE_BYTES) throw new ValidationError({ photo: "Imagem muito grande (máx. 5 MB)" });
  const key = `${ctx.accountId}/profile/${randomUUID()}.${type.ext}`;
  const { url } = await getStorage().put(key, file.data, type.contentType);
  await db.user.update({ where: { id: ctx.userId }, data: { photoUrl: url, photoKey: key } });
  if (current.photoKey) await getStorage().delete(current.photoKey).catch(() => {});
}
```

Append to `tests/integration/helpers.ts` (move the new imports to the top of the file):
```ts
import type { Ctx } from "@/server/context";
import { signup } from "@/server/services/accounts";

let counter = 0;

export async function makeAgent(opts: { name?: string; whatsapp?: string | null } = {}): Promise<Ctx> {
  counter++;
  const ctx = await signup({
    name: opts.name ?? `Corretor ${counter}`,
    email: `corretor${counter}-${Date.now()}@teste.com`,
    password: "senha-segura-123",
  });
  if (opts.whatsapp !== null) {
    await db.user.update({ where: { id: ctx.userId }, data: { whatsapp: opts.whatsapp ?? "5567999990000" } });
  }
  return ctx;
}
```

- [ ] **Step 6: Run** `npx vitest run` → PASS.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(auth): cadastro, login com sessão, perfil e storage de imagens"`

---

### Task 7: Properties service

**Files:**
- Create: `src/lib/validation/property.ts`, `src/server/services/properties.ts`
- Modify: `tests/integration/helpers.ts` (add `propertyInput`, `makePublishedProperty`)
- Test: `tests/integration/properties.test.ts`

**Interfaces:**
- Consumes: `slugify`, `uniqueSlug`, `getStorage`, `sniffImageType`, `MAX_IMAGE_BYTES`, errors.
- Produces:
  - `propertySchema` (zod; accepts FormData strings)
  - `listProperties(ctx)` → properties with `images` (first only) and `_count.leads`
  - `getProperty(ctx, id)` → property with all `images` ordered
  - `createProperty(ctx, input: unknown)`, `updateProperty(ctx, id, input: unknown)`
  - `setPropertyStatus(ctx, id, status: PropertyStatus)`
  - `deleteProperty(ctx, id)`
  - `addPropertyImage(ctx, propertyId, file: { data: Buffer })`, `removePropertyImage(ctx, imageId)`, `reorderPropertyImages(ctx, propertyId, orderedIds: string[])`
  - `getPublicPropertyBySlug(slug)` → property + images + `agent { name, photoUrl, creci, whatsapp, agencyName, bio, instagramUrl }` or `null`
  - helpers: `propertyInput(overrides?)`, `makePublishedProperty(ctx, overrides?)`

- [ ] **Step 1: Failing tests** `tests/integration/properties.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  addPropertyImage, createProperty, deleteProperty, getProperty, getPublicPropertyBySlug, listProperties,
  removePropertyImage, reorderPropertyImages, setPropertyStatus, updateProperty,
} from "@/server/services/properties";
import { PNG_1PX } from "../fixtures/images";
import { makeAgent, makePublishedProperty, propertyInput } from "./helpers";

describe("createProperty", () => {
  it("cria rascunho com slug a partir do título", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    expect(p).toMatchObject({ status: "DRAFT", slug: "casa-no-jardim-dos-estados", agentId: ctx.userId, price: 850000 });
    const p2 = await createProperty(ctx, propertyInput());
    expect(p2.slug).toBe("casa-no-jardim-dos-estados-2");
  });

  it("interpreta valores em formato brasileiro e listas", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput({ price: "1.250.000,00", condoFee: "", builtArea: "180,5", highlights: "Piscina\n\nChurrasqueira\n", showAddress: "on" }));
    expect(p).toMatchObject({ price: 1250000, condoFee: null, builtArea: 180.5, highlights: ["Piscina", "Churrasqueira"], showAddress: true });
  });

  it("valida campos obrigatórios", async () => {
    const ctx = await makeAgent();
    const err = await createProperty(ctx, propertyInput({ title: "", price: "" })).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.fieldErrors)).toEqual(expect.arrayContaining(["title", "price"]));
  });
});

describe("publicação", () => {
  it("exige foto e WhatsApp do corretor", async () => {
    const noWhats = await makeAgent({ whatsapp: null });
    const p = await createProperty(noWhats, propertyInput());
    await addPropertyImage(noWhats, p.id, { data: PNG_1PX });
    await expect(setPropertyStatus(noWhats, p.id, "PUBLISHED")).rejects.toThrow(/WhatsApp/);

    const ctx = await makeAgent();
    const p2 = await createProperty(ctx, propertyInput());
    await expect(setPropertyStatus(ctx, p2.id, "PUBLISHED")).rejects.toThrow(/foto/);
  });

  it("publica, registra data e aparece na página pública", async () => {
    const ctx = await makeAgent({ name: "Ana Martins" });
    const p = await makePublishedProperty(ctx);
    expect(p.publishedAt).toBeInstanceOf(Date);
    const pub = await getPublicPropertyBySlug(p.slug);
    expect(pub?.agent.name).toBe("Ana Martins");
    expect(pub?.images).toHaveLength(1);
  });

  it("não expõe rascunho nem pausado; vendido continua visível", async () => {
    const ctx = await makeAgent();
    const draft = await createProperty(ctx, propertyInput({ title: "Rascunho qualquer" }));
    expect(await getPublicPropertyBySlug(draft.slug)).toBeNull();
    const p = await makePublishedProperty(ctx);
    await setPropertyStatus(ctx, p.id, "PAUSED");
    expect(await getPublicPropertyBySlug(p.slug)).toBeNull();
    await setPropertyStatus(ctx, p.id, "SOLD");
    expect((await getPublicPropertyBySlug(p.slug))?.status).toBe("SOLD");
  });
});

describe("fotos", () => {
  it("rejeita arquivo que não é imagem", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    await expect(addPropertyImage(ctx, p.id, { data: Buffer.from("<svg/>") })).rejects.toBeInstanceOf(ValidationError);
  });

  it("adiciona, reordena e remove renumerando posições", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    const a = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    const b = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    const c = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    await reorderPropertyImages(ctx, p.id, [c.id, a.id, b.id]);
    expect((await getProperty(ctx, p.id)).images.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    await removePropertyImage(ctx, c.id);
    const imgs = (await getProperty(ctx, p.id)).images;
    expect(imgs.map((i) => [i.id, i.position])).toEqual([[a.id, 0], [b.id, 1]]);
    await expect(reorderPropertyImages(ctx, p.id, [a.id])).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("exclusão", () => {
  it("bloqueia exclusão de imóvel com contatos", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    await db.lead.create({
      data: { accountId: ctx.accountId, propertyId: p.id, publicToken: "t1", name: "X", phone: "5567999991111", consentAt: new Date(), consentText: "ok" },
    });
    await expect(deleteProperty(ctx, p.id)).rejects.toThrow(/contatos/);
  });
  it("exclui imóvel sem contatos", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    await deleteProperty(ctx, p.id);
    await expect(getProperty(ctx, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("isolamento entre corretores", () => {
  it("corretor B não vê nem altera imóveis de A", async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    const p = await createProperty(a, propertyInput());
    expect(await listProperties(b)).toHaveLength(0);
    await expect(getProperty(b, p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProperty(b, p.id, propertyInput({ title: "Invadido" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(setPropertyStatus(b, p.id, "PAUSED")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProperty(b, p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addPropertyImage(b, p.id, { data: PNG_1PX })).rejects.toBeInstanceOf(NotFoundError);
    const img = await addPropertyImage(a, p.id, { data: PNG_1PX });
    await expect(removePropertyImage(b, img.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getProperty(a, p.id)).title).toBe("Casa no Jardim dos Estados");
  });
});
```

(`tests/fixtures/images.ts` was created in Task 6.)

Append to `tests/integration/helpers.ts`:
```ts
import { addPropertyImage, createProperty, setPropertyStatus } from "@/server/services/properties";
import { PNG_1PX } from "../fixtures/images";

export function propertyInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Casa no Jardim dos Estados",
    type: "HOUSE",
    purpose: "SALE",
    price: "850.000",
    city: "Campo Grande",
    neighborhood: "Jardim dos Estados",
    bedrooms: "3",
    suites: "1",
    bathrooms: "2",
    parkingSpots: "2",
    description: "Casa térrea ampla, com quintal, área gourmet e ótima iluminação natural.",
    highlights: "Área gourmet\nQuintal",
    ...overrides,
  };
}

export async function makePublishedProperty(ctx: Ctx, overrides: Record<string, unknown> = {}) {
  const p = await createProperty(ctx, propertyInput(overrides));
  await addPropertyImage(ctx, p.id, { data: PNG_1PX });
  return setPropertyStatus(ctx, p.id, "PUBLISHED");
}
```

- [ ] **Step 2: Run** `npx vitest run --project integration` → FAIL.

- [ ] **Step 3: Implement validation** `src/lib/validation/property.ts`:

```ts
import { z } from "zod";
import { PROPERTY_PURPOSES, PROPERTY_TYPES } from "@/domain/types";
import { emptyToUndefined } from "./parse";

/** "1.250.000,00" → 1250000 ; "450000" → 450000 */
export function parseMoney(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const digits = v.replace(/,\d{1,2}$/, "").replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

/** "180,5" → 180.5 */
function parseDecimal(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? v : n;
}

const optionalMoney = z.preprocess(parseMoney, z.number().int().min(0).max(1_000_000_000).optional()).transform((v) => v ?? null);
const optionalCount = z.preprocess(emptyToUndefined, z.coerce.number().int("Use um número inteiro").min(0).max(99).optional()).transform((v) => v ?? null);
const optionalArea = z.preprocess(parseDecimal, z.number("Área inválida").min(0).max(10_000_000).optional()).transform((v) => v ?? null);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const propertySchema = z.object({
  title: z.string().trim().min(5, "Título muito curto (mín. 5 caracteres)").max(120),
  type: z.enum(PROPERTY_TYPES, "Escolha o tipo"),
  purpose: z.enum(PROPERTY_PURPOSES, "Escolha a finalidade"),
  price: z.preprocess(parseMoney, z.number("Informe o preço").int().positive("Informe o preço").max(1_000_000_000)),
  condoFee: optionalMoney,
  iptu: optionalMoney,
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  neighborhood: z.string().trim().min(2, "Informe o bairro").max(80),
  address: optionalText(200),
  showAddress: checkbox,
  bedrooms: optionalCount,
  suites: optionalCount,
  bathrooms: optionalCount,
  parkingSpots: optionalCount,
  builtArea: optionalArea,
  landArea: optionalArea,
  description: z.string().trim().min(20, "Descreva o imóvel (mín. 20 caracteres)").max(5000),
  highlights: z
    .preprocess((v) => (typeof v === "string" ? v.split("\n") : (v ?? [])), z.array(z.string()))
    .transform((a) => a.map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(120, "Diferencial muito longo")).max(20, "Máximo de 20 diferenciais")),
  financingInfo: optionalText(1000),
});

export type PropertyInput = z.infer<typeof propertySchema>;
```

- [ ] **Step 4: Implement service** `src/server/services/properties.ts`:

```ts
import { randomUUID } from "node:crypto";
import { slugify, uniqueSlug } from "@/domain/slug";
import type { PropertyStatus } from "@/domain/types";
import { parseOrThrow } from "@/lib/validation/parse";
import { propertySchema } from "@/lib/validation/property";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { getStorage } from "@/server/storage";
import { sniffImageType } from "@/server/storage/sniff";
import { MAX_IMAGE_BYTES } from "./profile";

export const MAX_IMAGES = 20;
const imagesOrdered = { orderBy: { position: "asc" as const } };

export async function listProperties(ctx: Ctx) {
  return db.property.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { updatedAt: "desc" },
    include: { images: { ...imagesOrdered, take: 1 }, _count: { select: { leads: true } } },
  });
}

export async function getProperty(ctx: Ctx, id: string) {
  const property = await db.property.findFirst({
    where: { id, accountId: ctx.accountId },
    include: { images: imagesOrdered },
  });
  if (!property) throw new NotFoundError("Imóvel");
  return property;
}

export async function createProperty(ctx: Ctx, input: unknown) {
  const data = parseOrThrow(propertySchema, input);
  const slug = await uniqueSlug(slugify(data.title), async (s) =>
    Boolean(await db.property.findUnique({ where: { slug: s }, select: { id: true } })),
  );
  return db.property.create({ data: { ...data, slug, accountId: ctx.accountId, agentId: ctx.userId } });
}

/** O slug não muda na edição para não quebrar links e QR Codes já divulgados. */
export async function updateProperty(ctx: Ctx, id: string, input: unknown) {
  await getProperty(ctx, id);
  const data = parseOrThrow(propertySchema, input);
  return db.property.update({ where: { id }, data });
}

export async function setPropertyStatus(ctx: Ctx, id: string, status: PropertyStatus) {
  const property = await getProperty(ctx, id);
  if (status === "PUBLISHED") {
    const agent = await db.user.findUniqueOrThrow({ where: { id: property.agentId } });
    if (!agent.whatsapp) {
      const msg = "Cadastre seu WhatsApp no perfil antes de publicar.";
      throw new ValidationError({ _form: msg }, msg);
    }
    if (property.images.length === 0) {
      const msg = "Adicione pelo menos uma foto antes de publicar.";
      throw new ValidationError({ _form: msg }, msg);
    }
  }
  return db.property.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? (property.publishedAt ?? new Date()) : property.publishedAt },
  });
}

export async function deleteProperty(ctx: Ctx, id: string) {
  const property = await getProperty(ctx, id);
  if (await db.lead.count({ where: { propertyId: id } })) {
    throw new ConflictError("Este imóvel possui contatos. Marque como vendido, alugado ou pausado em vez de excluir.");
  }
  await db.property.delete({ where: { id } });
  await Promise.all(property.images.map((img) => getStorage().delete(img.storageKey).catch(() => {})));
}

export async function addPropertyImage(ctx: Ctx, propertyId: string, file: { data: Buffer }) {
  const property = await getProperty(ctx, propertyId);
  const type = sniffImageType(file.data);
  if (!type) throw new ValidationError({ file: "Envie imagens JPG, PNG ou WebP" });
  if (file.data.byteLength > MAX_IMAGE_BYTES) throw new ValidationError({ file: "Imagem muito grande (máx. 5 MB)" });
  if (property.images.length >= MAX_IMAGES) throw new ValidationError({ file: `Limite de ${MAX_IMAGES} fotos por imóvel` });
  const key = `${ctx.accountId}/${propertyId}/${randomUUID()}.${type.ext}`;
  const { url } = await getStorage().put(key, file.data, type.contentType);
  const last = property.images.at(-1);
  return db.propertyImage.create({
    data: { propertyId, url, storageKey: key, position: last ? last.position + 1 : 0 },
  });
}

export async function removePropertyImage(ctx: Ctx, imageId: string) {
  const image = await db.propertyImage.findFirst({ where: { id: imageId, property: { accountId: ctx.accountId } } });
  if (!image) throw new NotFoundError("Foto");
  await db.propertyImage.delete({ where: { id: imageId } });
  const remaining = await db.propertyImage.findMany({ where: { propertyId: image.propertyId }, ...imagesOrdered });
  await db.$transaction(remaining.map((img, i) => db.propertyImage.update({ where: { id: img.id }, data: { position: i } })));
  await getStorage().delete(image.storageKey).catch(() => {});
}

export async function reorderPropertyImages(ctx: Ctx, propertyId: string, orderedIds: string[]) {
  const property = await getProperty(ctx, propertyId);
  const current = new Set(property.images.map((i) => i.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id))) {
    throw new ValidationError({ images: "Lista de fotos desatualizada. Recarregue a página." });
  }
  await db.$transaction(orderedIds.map((id, i) => db.propertyImage.update({ where: { id }, data: { position: i } })));
}

export async function getPublicPropertyBySlug(slug: string) {
  return db.property.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "SOLD", "RENTED"] }, publishedAt: { not: null } },
    include: {
      images: imagesOrdered,
      agent: { select: { name: true, photoUrl: true, creci: true, whatsapp: true, agencyName: true, bio: true, instagramUrl: true } },
    },
  });
}
```

- [ ] **Step 5: Run** `npx vitest run --project integration` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(imoveis): serviço de imóveis, fotos, publicação e isolamento"`

---

### Task 8: Questionnaire service

**Files:**
- Create: `src/lib/validation/question.ts`
- Modify: `src/server/services/questionnaires.ts`
- Test: `tests/integration/questionnaires.test.ts`

**Interfaces:**
- Produces:
  - `getDefaultQuestionnaire(ctx)` → questionnaire with `questions[]` (ordered, with ordered `options`)
  - `createQuestion(ctx, input: unknown)`, `updateQuestion(ctx, id, input: unknown)`, `deleteQuestion(ctx, id)`, `moveQuestion(ctx, id, direction: "up" | "down")`
  - `getQuestionDefsForProperty(propertyId: string, accountId: string): Promise<QuestionDef[]>` (property-specific questionnaire if any, else account default)
  - `MAX_QUESTIONS = 10`
  - `questionSchema` input shape: `{ label: string; type: QuestionType; required: boolean; isVisitIntent?: boolean; options: { id?: string; label: string; weight: number }[] }`

- [ ] **Step 1: Failing tests** `tests/integration/questionnaires.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  createQuestion, deleteQuestion, getDefaultQuestionnaire, getQuestionDefsForProperty, moveQuestion, updateQuestion,
} from "@/server/services/questionnaires";
import { makeAgent, makePublishedProperty } from "./helpers";

const choice = {
  label: "Quantos quartos procura?",
  type: "SINGLE_CHOICE",
  required: false,
  options: [{ label: "1 ou 2", weight: 5 }, { label: "3 ou mais", weight: 10 }],
};

describe("questionário padrão", () => {
  it("vem com 5 perguntas ordenadas", async () => {
    const ctx = await makeAgent();
    const qn = await getDefaultQuestionnaire(ctx);
    expect(qn.questions.map((q) => q.position)).toEqual([0, 1, 2, 3, 4]);
    expect(qn.questions[1].options[0]).toMatchObject({ label: "Imediatamente", weight: 30 });
  });

  it("imóvel usa o questionário padrão da conta", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const defs = await getQuestionDefsForProperty(p.id, ctx.accountId);
    expect(defs).toHaveLength(5);
    expect(defs[0]).toMatchObject({ type: "SINGLE_CHOICE", showIf: null });
  });
});

describe("edição de perguntas", () => {
  it("cria pergunta no final", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    expect(q.position).toBe(5);
    expect(q.options.map((o) => o.label)).toEqual(["1 ou 2", "3 ou mais"]);
  });

  it("exige 2 opções em escolha e normaliza sim/não", async () => {
    const ctx = await makeAgent();
    await expect(createQuestion(ctx, { ...choice, options: [{ label: "só uma", weight: 0 }] })).rejects.toBeInstanceOf(ValidationError);
    const yn = await createQuestion(ctx, { label: "Tem pets?", type: "YES_NO", required: true, options: [{ label: "x", weight: 7 }] });
    expect(yn.options.map((o) => [o.label, o.weight])).toEqual([["Sim", 7], ["Não", 0]]);
  });

  it("atualiza opções mantendo, criando e removendo", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    const updated = await updateQuestion(ctx, q.id, {
      ...choice,
      label: "Quartos?",
      options: [{ id: q.options[1].id, label: "3+", weight: 12 }, { label: "Studio", weight: 0 }],
    });
    expect(updated.label).toBe("Quartos?");
    expect(updated.options.map((o) => [o.label, o.weight])).toEqual([["3+", 12], ["Studio", 0]]);
    expect(updated.options[0].id).toBe(q.options[1].id);
  });

  it("mudar para texto remove as opções", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    const updated = await updateQuestion(ctx, q.id, { ...choice, type: "TEXT", options: [] });
    expect(updated.options).toHaveLength(0);
  });

  it("move e exclui renumerando", async () => {
    const ctx = await makeAgent();
    const before = (await getDefaultQuestionnaire(ctx)).questions;
    await moveQuestion(ctx, before[1].id, "up");
    let after = (await getDefaultQuestionnaire(ctx)).questions;
    expect(after.slice(0, 2).map((q) => q.id)).toEqual([before[1].id, before[0].id]);
    await moveQuestion(ctx, after[0].id, "up"); // já é a primeira: sem efeito
    await deleteQuestion(ctx, after[0].id);
    after = (await getDefaultQuestionnaire(ctx)).questions;
    expect(after.map((q) => q.position)).toEqual([0, 1, 2, 3]);
  });

  it("limita a 10 perguntas", async () => {
    const ctx = await makeAgent();
    for (let i = 0; i < 5; i++) await createQuestion(ctx, choice);
    await expect(createQuestion(ctx, choice)).rejects.toThrow(/10 perguntas/);
  });

  it("corretor B não altera perguntas de A", async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    const q = (await getDefaultQuestionnaire(a)).questions[0];
    await expect(updateQuestion(b, q.id, choice)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteQuestion(b, q.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveQuestion(b, q.id, "down")).rejects.toBeInstanceOf(NotFoundError);
    expect((await getDefaultQuestionnaire(b)).questions.map((x) => x.id)).not.toContain(q.id);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Validation** `src/lib/validation/question.ts`:

```ts
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
```

- [ ] **Step 4: Service** — append to `src/server/services/questionnaires.ts`:

```ts
import { YES_NO_LABELS } from "@/domain/default-questionnaire";
import { parseShowIf } from "@/domain/questionnaire";
import type { QuestionDef } from "@/domain/types";
import { parseOrThrow } from "@/lib/validation/parse";
import { type QuestionInput, questionSchema } from "@/lib/validation/question";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";

export const MAX_QUESTIONS = 10;

const questionsInclude = {
  questions: {
    orderBy: { position: "asc" as const },
    include: { options: { orderBy: { position: "asc" as const } } },
  },
};

function normalize(q: QuestionInput): QuestionInput {
  if (q.type === "TEXT" || q.type === "NUMBER") return { ...q, options: [] };
  if (q.type === "YES_NO") {
    return {
      ...q,
      options: YES_NO_LABELS.map((label, i) => ({ id: q.options[i]?.id, label, weight: q.options[i]?.weight ?? 0 })),
    };
  }
  return q;
}

export async function getDefaultQuestionnaire(ctx: Ctx) {
  const qn = await db.questionnaire.findFirst({
    where: { accountId: ctx.accountId, isDefault: true, propertyId: null },
    include: questionsInclude,
  });
  if (!qn) throw new NotFoundError("Questionário");
  return qn;
}

async function getOwnedQuestion(ctx: Ctx, id: string) {
  const q = await db.question.findFirst({
    where: { id, questionnaire: { accountId: ctx.accountId } },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!q) throw new NotFoundError("Pergunta");
  return q;
}

export async function createQuestion(ctx: Ctx, input: unknown) {
  const data = normalize(parseOrThrow(questionSchema, input));
  const qn = await getDefaultQuestionnaire(ctx);
  if (qn.questions.length >= MAX_QUESTIONS) {
    const msg = `Máximo de ${MAX_QUESTIONS} perguntas — questionários curtos convertem mais.`;
    throw new ValidationError({ _form: msg }, msg);
  }
  return db.question.create({
    data: {
      questionnaireId: qn.id,
      label: data.label,
      type: data.type,
      required: data.required,
      isVisitIntent: data.isVisitIntent,
      position: qn.questions.length,
      options: { create: data.options.map((o, i) => ({ label: o.label, weight: o.weight, position: i })) },
    },
    include: { options: { orderBy: { position: "asc" } } },
  });
}

export async function updateQuestion(ctx: Ctx, id: string, input: unknown) {
  const existing = await getOwnedQuestion(ctx, id);
  const data = normalize(parseOrThrow(questionSchema, input));
  const existingIds = new Set(existing.options.map((o) => o.id));
  const keepIds = data.options.map((o) => o.id).filter((oid): oid is string => !!oid && existingIds.has(oid));
  return db.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId: id, id: { notIn: keepIds } } });
    for (const [i, o] of data.options.entries()) {
      if (o.id && existingIds.has(o.id)) {
        await tx.questionOption.update({ where: { id: o.id }, data: { label: o.label, weight: o.weight, position: i } });
      } else {
        await tx.questionOption.create({ data: { questionId: id, label: o.label, weight: o.weight, position: i } });
      }
    }
    return tx.question.update({
      where: { id },
      data: { label: data.label, type: data.type, required: data.required, isVisitIntent: data.isVisitIntent },
      include: { options: { orderBy: { position: "asc" } } },
    });
  });
}

export async function deleteQuestion(ctx: Ctx, id: string) {
  const q = await getOwnedQuestion(ctx, id);
  await db.question.delete({ where: { id } });
  const rest = await db.question.findMany({ where: { questionnaireId: q.questionnaireId }, orderBy: { position: "asc" } });
  await db.$transaction(rest.map((r, i) => db.question.update({ where: { id: r.id }, data: { position: i } })));
}

export async function moveQuestion(ctx: Ctx, id: string, direction: "up" | "down") {
  const q = await getOwnedQuestion(ctx, id);
  const siblings = await db.question.findMany({ where: { questionnaireId: q.questionnaireId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((s) => s.id === id);
  const target = siblings[direction === "up" ? index - 1 : index + 1];
  if (!target) return;
  await db.$transaction([
    db.question.update({ where: { id: q.id }, data: { position: target.position } }),
    db.question.update({ where: { id: target.id }, data: { position: q.position } }),
  ]);
}

export async function getQuestionDefsForProperty(propertyId: string, accountId: string): Promise<QuestionDef[]> {
  const qn =
    (await db.questionnaire.findFirst({ where: { accountId, propertyId }, include: questionsInclude })) ??
    (await db.questionnaire.findFirst({ where: { accountId, isDefault: true, propertyId: null }, include: questionsInclude }));
  if (!qn) return [];
  return qn.questions.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    isVisitIntent: q.isVisitIntent,
    showIf: parseShowIf(q.showIf),
    options: q.options.map((o) => ({ id: o.id, label: o.label, weight: o.weight })),
  }));
}
```
(Merge imports with the existing ones at the top of the file.)

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(questionario): editor do questionário padrão"`

---

### Task 9: Public lead flow service

**Files:**
- Create: `src/lib/validation/lead.ts`, `src/server/services/public-leads.ts`
- Test: `tests/integration/public-leads.test.ts`

**Interfaces:**
- Consumes: `resolveAttribution`, `scoreAnswers`, `validateAnswers`, `visibleQuestions`, `isAnswered`, `formatAnswer`, `detectVisitIntent`, `buildLeadMessage`, `waMeChannel`, `CONSENT_TEXT`, `getQuestionDefsForProperty`.
- Produces:
  - `startLead(input: unknown, opts?: { ownHost?: string }): Promise<{ leadId: string; token: string }>`
    - input: `{ propertyId, name, phone, email?, consent: true, visitorId?, landingUrl?, attribution?: { utmSource?, utmMedium?, utmCampaign?, utmContent?, utmTerm?, referrer?, gclid?, fbclid? } }`
  - `submitAnswers(leadId, token, input: unknown, opts: { appUrl: string }): Promise<Handoff>` — input `{ answers: AnswerMap }`
  - `getHandoff(leadId, token, opts: { appUrl: string }): Promise<Handoff>`; `Handoff = { whatsappUrl: string; message: string; lines: { label: string; value: string }[] }`
  - `registerWhatsappClick(leadId, token): Promise<void>`
  - `recordPublicEvent(input: unknown, opts?: { ownHost?: string }): Promise<void>` — input `{ propertyId, type: "PAGE_VIEW" | "QUESTIONNAIRE_START", visitorId?, attribution? }`
  - `getPublicQuestions(propertyId)` → `{ id, label, type, required, showIf, options: { id, label }[] }[]` (weights stripped)

- [ ] **Step 1: Failing tests** `tests/integration/public-leads.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createProperty } from "@/server/services/properties";
import {
  getPublicQuestions, recordPublicEvent, registerWhatsappClick, startLead, submitAnswers,
} from "@/server/services/public-leads";
import { getQuestionDefsForProperty } from "@/server/services/questionnaires";
import { makeAgent, makePublishedProperty, propertyInput } from "./helpers";

const appUrl = "https://app.teste";

async function setup() {
  const ctx = await makeAgent();
  const property = await makePublishedProperty(ctx);
  const questions = await getQuestionDefsForProperty(property.id, ctx.accountId);
  const answer = (qIndex: number, optIndex: number) => ({ [questions[qIndex].id]: { optionIds: [questions[qIndex].options[optIndex].id] } });
  const best = { ...answer(0, 0), ...answer(1, 0), ...answer(2, 0), ...answer(3, 0), ...answer(4, 0) };
  return { ctx, property, questions, answer, best };
}

const contact = (propertyId: string, extra: Record<string, unknown> = {}) => ({
  propertyId, name: "João Silva", phone: "(67) 98888-7777", consent: true, visitorId: "v1", ...extra,
});

describe("startLead", () => {
  it("cria lead incompleto com origem e telefone normalizado", async () => {
    const { ctx, property } = await setup();
    const { leadId, token } = await startLead(contact(property.id, { attribution: { utmSource: "instagram", utmCampaign: "casa" } }));
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead).toMatchObject({
      accountId: ctx.accountId, phone: "5567988887777", isComplete: false, classification: "UNRATED",
      channel: "INSTAGRAM", utmCampaign: "casa", status: "NEW", publicToken: token,
    });
    expect(lead.consentText).toMatch(/Política de Privacidade/);
  });

  it("recusa imóvel não publicado, sem consentimento ou telefone inválido", async () => {
    const ctx = await makeAgent();
    const draft = await createProperty(ctx, propertyInput());
    await expect(startLead(contact(draft.id))).rejects.toBeInstanceOf(NotFoundError);
    const { property } = await setup();
    await expect(startLead(contact(property.id, { consent: false }))).rejects.toMatchObject({ fieldErrors: { consent: expect.any(String) } });
    await expect(startLead(contact(property.id, { phone: "123" }))).rejects.toMatchObject({ fieldErrors: { phone: expect.any(String) } });
  });

  it("reaproveita lead incompleto do mesmo telefone no mesmo imóvel", async () => {
    const { property } = await setup();
    const first = await startLead(contact(property.id));
    const second = await startLead(contact(property.id, { name: "João S." }));
    expect(second.leadId).toBe(first.leadId);
    expect(await db.lead.count()).toBe(1);
  });
});

describe("submitAnswers", () => {
  it("pontua, salva respostas e gera link do WhatsApp", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    const handoff = await submitAnswers(leadId, token, { answers: best }, { appUrl });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { answers: { orderBy: { position: "asc" } } } });
    expect(lead).toMatchObject({ isComplete: true, score: 100, maxScore: 100, classification: "HIGH", wantsVisit: true });
    expect(lead.answers).toHaveLength(5);
    expect(lead.answers[1]).toMatchObject({ questionLabel: "Quando pretende fechar negócio?", displayValue: "Imediatamente", points: 30 });
    expect(handoff.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5567999990000\?text=/);
    expect(handoff.message).toContain("Olá, sou João Silva.");
    expect(handoff.message).toContain(`${appUrl}/imovel/${property.slug}`);
    expect(await db.analyticsEvent.count({ where: { type: "QUESTIONNAIRE_COMPLETE" } })).toBe(1);
  });

  it("valida obrigatórias e opções de outra pergunta", async () => {
    const { property, questions, answer } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await expect(submitAnswers(leadId, token, { answers: answer(0, 0) }, { appUrl })).rejects.toBeInstanceOf(ValidationError);
    const wrong = { [questions[1].id]: { optionIds: [questions[2].options[0].id] } };
    await expect(submitAnswers(leadId, token, { answers: wrong }, { appUrl })).rejects.toBeInstanceOf(ValidationError);
  });

  it("exige o token do próprio lead", async () => {
    const { property, best } = await setup();
    const { leadId } = await startLead(contact(property.id));
    await expect(submitAnswers(leadId, "token-errado", { answers: best }, { appUrl })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reenvio após concluir devolve o mesmo resultado sem duplicar", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    expect(await db.leadAnswer.count()).toBe(5);
    expect(await db.analyticsEvent.count({ where: { type: "QUESTIONNAIRE_COMPLETE" } })).toBe(1);
  });
});

describe("registerWhatsappClick", () => {
  it("registra uma única vez", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    await registerWhatsappClick(leadId, token);
    await registerWhatsappClick(leadId, token);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).whatsappClickedAt).toBeInstanceOf(Date);
    expect(await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK" } })).toBe(1);
  });
});

describe("recordPublicEvent e getPublicQuestions", () => {
  it("registra visualização com canal e ignora imóvel não publicado", async () => {
    const { ctx, property } = await setup();
    await recordPublicEvent({ propertyId: property.id, type: "PAGE_VIEW", visitorId: "v1", attribution: { utmSource: "qrcode" } });
    const ev = await db.analyticsEvent.findFirstOrThrow();
    expect(ev).toMatchObject({ accountId: ctx.accountId, channel: "QR_CODE", type: "PAGE_VIEW" });
    const draft = await createProperty(ctx, propertyInput({ title: "Outro imóvel" }));
    await expect(recordPublicEvent({ propertyId: draft.id, type: "PAGE_VIEW" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("não expõe pesos ao visitante", async () => {
    const { property } = await setup();
    const qs = await getPublicQuestions(property.id);
    expect(qs).toHaveLength(5);
    expect(JSON.stringify(qs)).not.toContain("weight");
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Validation** `src/lib/validation/lead.ts`:

```ts
import { z } from "zod";
import { normalizeBrPhone } from "@/domain/phone";

const attributionSchema = z
  .object({
    utmSource: z.string().max(1000).nullish(),
    utmMedium: z.string().max(1000).nullish(),
    utmCampaign: z.string().max(1000).nullish(),
    utmContent: z.string().max(1000).nullish(),
    utmTerm: z.string().max(1000).nullish(),
    referrer: z.string().max(2000).nullish(),
    gclid: z.string().max(1000).nullish(),
    fbclid: z.string().max(1000).nullish(),
  })
  .default({});

export const startLeadSchema = z.object({
  propertyId: z.string().min(1).max(50),
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone: z.string().trim().transform((v, ctx) => {
    const n = normalizeBrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número" });
      return z.NEVER;
    }
    return n;
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .transform((v) => v || null)
    .pipe(z.union([z.null(), z.email("E-mail inválido")])),
  consent: z.literal(true, "É preciso concordar para continuar"),
  visitorId: z.string().max(64).optional(),
  landingUrl: z.string().max(1000).optional(),
  attribution: attributionSchema,
});

export const answersSchema = z.object({
  answers: z.record(
    z.string(),
    z.object({
      optionIds: z.array(z.string().max(50)).max(20).optional(),
      text: z.string().max(2000).optional(),
      number: z.number().optional(),
    }),
  ),
});

export const publicEventSchema = z.object({
  propertyId: z.string().min(1).max(50),
  type: z.enum(["PAGE_VIEW", "QUESTIONNAIRE_START"]),
  visitorId: z.string().max(64).optional(),
  attribution: attributionSchema,
});
```

- [ ] **Step 4: Service** `src/server/services/public-leads.ts`:

```ts
import { randomBytes, timingSafeEqual } from "node:crypto";
import { type Attribution, resolveAttribution } from "@/domain/attribution";
import { CONSENT_TEXT } from "@/domain/consent";
import { detectVisitIntent, formatAnswer, isAnswered, validateAnswers, visibleQuestions } from "@/domain/questionnaire";
import { scoreAnswers } from "@/domain/scoring";
import { buildLeadMessage, waMeChannel } from "@/domain/whatsapp";
import { answersSchema, publicEventSchema, startLeadSchema } from "@/lib/validation/lead";
import { parseOrThrow } from "@/lib/validation/parse";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getQuestionDefsForProperty } from "./questionnaires";

const REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type Handoff = { whatsappUrl: string; message: string; lines: { label: string; value: string }[] };

async function getPublishedProperty(propertyId: string) {
  const property = await db.property.findFirst({ where: { id: propertyId, status: "PUBLISHED" } });
  if (!property) throw new NotFoundError("Imóvel");
  return property;
}

const attributionFields = (a: Attribution) => ({
  channel: a.channel, utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign,
  utmContent: a.utmContent, utmTerm: a.utmTerm, referrer: a.referrer,
});

function tokensMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function loadLead(leadId: string, token: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { property: { include: { agent: true } }, answers: { orderBy: { position: "asc" } } },
  });
  if (!lead || typeof token !== "string" || !tokensMatch(lead.publicToken, token)) throw new NotFoundError("Contato");
  return lead;
}

export async function startLead(input: unknown, opts: { ownHost?: string } = {}) {
  const data = parseOrThrow(startLeadSchema, input);
  const property = await getPublishedProperty(data.propertyId);
  const attribution = resolveAttribution({ ...data.attribution, ownHost: opts.ownHost });

  const existing = await db.lead.findFirst({
    where: {
      propertyId: property.id, phone: data.phone, isComplete: false,
      createdAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) },
    },
  });
  if (existing) {
    await db.lead.update({ where: { id: existing.id }, data: { name: data.name, email: data.email } });
    return { leadId: existing.id, token: existing.publicToken };
  }

  const lead = await db.lead.create({
    data: {
      accountId: property.accountId,
      propertyId: property.id,
      publicToken: randomBytes(24).toString("base64url"),
      name: data.name,
      phone: data.phone,
      email: data.email,
      consentAt: new Date(),
      consentText: CONSENT_TEXT,
      visitorId: data.visitorId,
      landingUrl: data.landingUrl,
      ...attributionFields(attribution),
      history: { create: { toStatus: "NEW" } },
    },
  });
  return { leadId: lead.id, token: lead.publicToken };
}

export async function submitAnswers(leadId: string, token: string, input: unknown, opts: { appUrl: string }) {
  const lead = await loadLead(leadId, token);
  if (lead.isComplete) return getHandoff(leadId, token, opts);
  if (lead.property.status !== "PUBLISHED") throw new NotFoundError("Imóvel");

  const { answers } = parseOrThrow(answersSchema, input);
  const questions = await getQuestionDefsForProperty(lead.propertyId, lead.accountId);
  const errors = validateAnswers(questions, answers);
  if (Object.keys(errors).length > 0) throw new ValidationError(errors, "Responda as perguntas obrigatórias");

  const answered = visibleQuestions(questions, answers).filter((q) => isAnswered(q, answers[q.id]));
  const result = scoreAnswers(questions, answers);

  await db.$transaction([
    db.leadAnswer.createMany({
      data: answered.map((q, i) => ({
        leadId,
        questionId: q.id,
        questionLabel: q.label,
        position: i,
        value: answers[q.id],
        displayValue: formatAnswer(q, answers[q.id]),
        points: result.pointsByQuestion[q.id] ?? 0,
      })),
    }),
    db.lead.update({
      where: { id: leadId },
      data: {
        isComplete: true,
        completedAt: new Date(),
        score: result.score,
        maxScore: result.maxScore,
        classification: result.classification,
        wantsVisit: detectVisitIntent(questions, answers),
      },
    }),
    db.analyticsEvent.create({
      data: {
        accountId: lead.accountId, propertyId: lead.propertyId, type: "QUESTIONNAIRE_COMPLETE",
        visitorId: lead.visitorId, channel: lead.channel, utmSource: lead.utmSource, utmCampaign: lead.utmCampaign,
      },
    }),
  ]);
  return getHandoff(leadId, token, opts);
}

export async function getHandoff(leadId: string, token: string, opts: { appUrl: string }): Promise<Handoff> {
  const lead = await loadLead(leadId, token);
  const phone = lead.property.agent.whatsapp;
  if (!phone) throw new NotFoundError("WhatsApp do corretor");
  const lines = lead.answers.map((a) => ({ label: a.questionLabel, value: a.displayValue }));
  const message = buildLeadMessage({
    leadName: lead.name,
    propertyTitle: lead.property.title,
    propertyUrl: `${opts.appUrl}/imovel/${lead.property.slug}`,
    lines,
  });
  return { whatsappUrl: waMeChannel.buildHandoffUrl({ phone, message }), message, lines };
}

export async function registerWhatsappClick(leadId: string, token: string) {
  const lead = await loadLead(leadId, token);
  if (lead.whatsappClickedAt) return;
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { whatsappClickedAt: new Date() } }),
    db.analyticsEvent.create({
      data: {
        accountId: lead.accountId, propertyId: lead.propertyId, type: "WHATSAPP_CLICK",
        visitorId: lead.visitorId, channel: lead.channel, utmSource: lead.utmSource, utmCampaign: lead.utmCampaign,
      },
    }),
  ]);
}

export async function recordPublicEvent(input: unknown, opts: { ownHost?: string } = {}) {
  const data = parseOrThrow(publicEventSchema, input);
  const property = await getPublishedProperty(data.propertyId);
  const a = resolveAttribution({ ...data.attribution, ownHost: opts.ownHost });
  await db.analyticsEvent.create({
    data: {
      accountId: property.accountId, propertyId: property.id, type: data.type, visitorId: data.visitorId,
      channel: a.channel, utmSource: a.utmSource, utmCampaign: a.utmCampaign,
    },
  });
}

export async function getPublicQuestions(propertyId: string) {
  const property = await getPublishedProperty(propertyId);
  const defs = await getQuestionDefsForProperty(property.id, property.accountId);
  return defs.map(({ options, isVisitIntent: _v, ...q }) => ({
    ...q,
    options: options.map(({ id, label }) => ({ id, label })),
  }));
}

export type PublicQuestion = Awaited<ReturnType<typeof getPublicQuestions>>[number];
```

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(leads): fluxo público de qualificação, pontuação e WhatsApp"`

---

### Task 10: Lead management and dashboard metrics

**Files:**
- Create: `src/server/services/leads.ts`, `src/server/services/analytics.ts`
- Test: `tests/integration/leads.test.ts`, `tests/integration/analytics.test.ts`
- Modify: `tests/integration/helpers.ts` (add `makeLead`)

**Interfaces:**
- Produces:
  - `listLeads(ctx, filters: unknown)` → `{ items, total, page, pageSize }`; filters `{ propertyId?, classification?, status?, channel?, complete?: "yes"|"no", q?, days?, page? }` (strings from searchParams accepted; `""` ignored)
  - `getLead(ctx, id)` → lead + `property`, `answers` (ordered), `notes` (desc, with `author.name`), `history` (asc)
  - `updateLeadStatus(ctx, id, status: LeadStatus)`, `addLeadNote(ctx, id, body: string)`, `deleteLead(ctx, id)`
  - `getDashboard(ctx, days = 30)` → `Dashboard` (see code)
  - helper `makeLead(ctx, propertyId, overrides?)` creating a lead via DB for fixture purposes.

- [ ] **Step 1: Helper** — append to `tests/integration/helpers.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

export async function makeLead(ctx: Ctx, propertyId: string, overrides: Partial<Prisma.LeadUncheckedCreateInput> = {}) {
  return db.lead.create({
    data: {
      accountId: ctx.accountId, propertyId, publicToken: randomUUID(), name: "Lead Teste",
      phone: "5567911112222", consentAt: new Date(), consentText: "ok", isComplete: true,
      classification: "MEDIUM", channel: "DIRECT", ...overrides,
    },
  });
}
```

- [ ] **Step 2: Failing tests**

`tests/integration/leads.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { addLeadNote, deleteLead, getLead, listLeads, updateLeadStatus } from "@/server/services/leads";
import { makeAgent, makeLead, makePublishedProperty } from "./helpers";

async function fixture() {
  const ctx = await makeAgent();
  const p1 = await makePublishedProperty(ctx);
  const p2 = await makePublishedProperty(ctx, { title: "Apartamento no Centro" });
  await makeLead(ctx, p1.id, { name: "Maria Souza", classification: "HIGH", channel: "INSTAGRAM", phone: "5567900001111" });
  await makeLead(ctx, p1.id, { name: "Carlos Lima", classification: "LOW", channel: "GOOGLE", status: "CONTACTED" });
  await makeLead(ctx, p2.id, { name: "Beatriz", classification: "HIGH", channel: "QR_CODE", isComplete: false });
  return { ctx, p1, p2 };
}

describe("listLeads", () => {
  it("filtra por imóvel, classificação, status, origem e completude", async () => {
    const { ctx, p1, p2 } = await fixture();
    expect((await listLeads(ctx, {})).total).toBe(3);
    expect((await listLeads(ctx, { propertyId: p2.id })).items.map((l) => l.name)).toEqual(["Beatriz"]);
    expect((await listLeads(ctx, { classification: "HIGH" })).total).toBe(2);
    expect((await listLeads(ctx, { status: "CONTACTED" })).items[0].name).toBe("Carlos Lima");
    expect((await listLeads(ctx, { channel: "INSTAGRAM", propertyId: p1.id })).total).toBe(1);
    expect((await listLeads(ctx, { complete: "no" })).items[0].name).toBe("Beatriz");
    expect((await listLeads(ctx, { classification: "", status: "" })).total).toBe(3);
  });

  it("busca por nome e telefone", async () => {
    const { ctx } = await fixture();
    expect((await listLeads(ctx, { q: "maria" })).items[0].name).toBe("Maria Souza");
    expect((await listLeads(ctx, { q: "0000-1111" })).items[0].name).toBe("Maria Souza");
  });

  it("filtra por período", async () => {
    const { ctx, p1 } = await fixture();
    await makeLead(ctx, p1.id, { name: "Antigo", createdAt: new Date(Date.now() - 40 * 864e5) });
    expect((await listLeads(ctx, { days: "30" })).total).toBe(3);
  });
});

describe("gestão do lead", () => {
  it("altera status com histórico e adiciona observação", async () => {
    const { ctx, p1 } = await fixture();
    const lead = await makeLead(ctx, p1.id);
    await updateLeadStatus(ctx, lead.id, "VISIT_SCHEDULED");
    await addLeadNote(ctx, lead.id, "Visita sábado às 10h");
    const full = await getLead(ctx, lead.id);
    expect(full.status).toBe("VISIT_SCHEDULED");
    expect(full.history.at(-1)).toMatchObject({ fromStatus: "NEW", toStatus: "VISIT_SCHEDULED", changedById: ctx.userId });
    expect(full.notes[0].body).toBe("Visita sábado às 10h");
    await expect(addLeadNote(ctx, lead.id, "   ")).rejects.toBeInstanceOf(ValidationError);
    await expect(updateLeadStatus(ctx, lead.id, "XYZ" as never)).rejects.toBeInstanceOf(ValidationError);
  });

  it("exclui lead e dados relacionados", async () => {
    const { ctx, p1 } = await fixture();
    const lead = await makeLead(ctx, p1.id);
    await addLeadNote(ctx, lead.id, "nota");
    await deleteLead(ctx, lead.id);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.leadNote.count({ where: { leadId: lead.id } })).toBe(0);
  });
});

describe("isolamento", () => {
  it("corretor B não acessa leads de A", async () => {
    const { ctx: a, p1 } = await fixture();
    const b = await makeAgent();
    const lead = await makeLead(a, p1.id);
    expect((await listLeads(b, {})).total).toBe(0);
    expect((await listLeads(b, { propertyId: p1.id })).total).toBe(0);
    await expect(getLead(b, lead.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateLeadStatus(b, lead.id, "LOST")).rejects.toBeInstanceOf(NotFoundError);
    await expect(addLeadNote(b, lead.id, "x")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteLead(b, lead.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

`tests/integration/analytics.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getDashboard } from "@/server/services/analytics";
import { makeAgent, makeLead, makePublishedProperty } from "./helpers";

describe("getDashboard", () => {
  it("calcula totais, taxas e origens apenas da própria conta", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const view = (visitorId: string) => ({ accountId: ctx.accountId, propertyId: p.id, type: "PAGE_VIEW" as const, visitorId });
    await db.analyticsEvent.createMany({ data: [view("v1"), view("v1"), view("v2"), view("v3"), view("v4")] });
    await db.analyticsEvent.create({ data: { accountId: ctx.accountId, propertyId: p.id, type: "QUESTIONNAIRE_START", visitorId: "v1" } });
    await makeLead(ctx, p.id, { classification: "HIGH", channel: "INSTAGRAM", wantsVisit: true, whatsappClickedAt: new Date() });
    await makeLead(ctx, p.id, { classification: "LOW", channel: "INSTAGRAM", status: "CONTACTED" });
    await makeLead(ctx, p.id, { classification: "UNRATED", channel: "GOOGLE", isComplete: false });
    await makeLead(ctx, p.id, { name: "Antigo", createdAt: new Date(Date.now() - 60 * 864e5) });

    const other = await makeAgent();
    const op = await makePublishedProperty(other);
    await makeLead(other, op.id, { classification: "HIGH" });

    const d = await getDashboard(ctx, 30);
    expect(d.properties).toEqual({ total: 1, published: 1 });
    expect(d.views).toBe(5);
    expect(d.uniqueVisitors).toBe(4);
    expect(d.questionnaireStarts).toBe(1);
    expect(d.leads).toBe(3);
    expect(d.completeLeads).toBe(2);
    expect(d.highIntent).toBe(1);
    expect(d.pendingNew).toBe(3); // status NEW em qualquer período (inclui o antigo)
    expect(d.wantsVisit).toBe(1);
    expect(d.whatsappClicks).toBe(1);
    expect(d.rates.visitorToLead).toBe(0.75);
    expect(d.rates.completion).toBeCloseTo(2 / 3);
    expect(d.rates.leadToWhatsapp).toBe(0.5);
    expect(d.byChannel).toEqual([{ channel: "INSTAGRAM", count: 2 }, { channel: "GOOGLE", count: 1 }]);
    expect(d.recentHighIntent).toHaveLength(1);
  });

  it("retorna zeros e taxas nulas sem dados", async () => {
    const ctx = await makeAgent();
    const d = await getDashboard(ctx, 7);
    expect(d.leads).toBe(0);
    expect(d.rates.visitorToLead).toBeNull();
    expect(d.byChannel).toEqual([]);
  });
});
```

- [ ] **Step 3: Run** → FAIL.

- [ ] **Step 4: Implement** `src/server/services/leads.ts`:

```ts
import { z } from "zod";
import { CHANNELS, CLASSIFICATIONS, LEAD_STATUSES, type LeadStatus } from "@/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { emptyToUndefined, parseOrThrow } from "@/lib/validation/parse";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const LEADS_PAGE_SIZE = 25;
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const filtersSchema = z.object({
  propertyId: opt(z.string().max(50)),
  classification: opt(z.enum(CLASSIFICATIONS)),
  status: opt(z.enum(LEAD_STATUSES)),
  channel: opt(z.enum(CHANNELS)),
  complete: opt(z.enum(["yes", "no"])),
  q: opt(z.string().trim().max(100)),
  days: opt(z.coerce.number().int().positive().max(3650)),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
});

export type LeadFilters = z.input<typeof filtersSchema>;

export async function listLeads(ctx: Ctx, input: unknown) {
  const f = parseOrThrow(filtersSchema, input);
  const where: Prisma.LeadWhereInput = {
    accountId: ctx.accountId,
    propertyId: f.propertyId,
    classification: f.classification,
    status: f.status,
    channel: f.channel,
    isComplete: f.complete === undefined ? undefined : f.complete === "yes",
    createdAt: f.days ? { gte: new Date(Date.now() - f.days * 864e5) } : undefined,
  };
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ];
  }
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * LEADS_PAGE_SIZE,
      take: LEADS_PAGE_SIZE,
      include: { property: { select: { id: true, title: true, slug: true } } },
    }),
    db.lead.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: LEADS_PAGE_SIZE };
}

export async function getLead(ctx: Ctx, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, accountId: ctx.accountId },
    include: {
      property: { select: { id: true, title: true, slug: true } },
      answers: { orderBy: { position: "asc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!lead) throw new NotFoundError("Contato");
  return lead;
}

async function assertOwned(ctx: Ctx, id: string) {
  const lead = await db.lead.findFirst({ where: { id, accountId: ctx.accountId }, select: { id: true, status: true } });
  if (!lead) throw new NotFoundError("Contato");
  return lead;
}

export async function updateLeadStatus(ctx: Ctx, id: string, status: LeadStatus) {
  const next = parseOrThrow(z.enum(LEAD_STATUSES, "Status inválido"), status);
  const lead = await assertOwned(ctx, id);
  if (lead.status === next) return;
  await db.$transaction([
    db.lead.update({ where: { id }, data: { status: next } }),
    db.leadStatusHistory.create({ data: { leadId: id, fromStatus: lead.status, toStatus: next, changedById: ctx.userId } }),
  ]);
}

export async function addLeadNote(ctx: Ctx, id: string, body: string) {
  const text = parseOrThrow(z.string().trim().min(1, "Escreva a observação").max(2000), body);
  await assertOwned(ctx, id);
  await db.leadNote.create({ data: { leadId: id, authorId: ctx.userId, body: text } });
}

export async function deleteLead(ctx: Ctx, id: string) {
  await assertOwned(ctx, id);
  await db.lead.delete({ where: { id } });
}
```

`src/server/services/analytics.ts`:
```ts
import { rate } from "@/domain/format";
import type { Channel } from "@/domain/types";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";

export async function getDashboard(ctx: Ctx, days = 30) {
  const { accountId } = ctx;
  const since = new Date(Date.now() - days * 864e5);
  const period = { accountId, createdAt: { gte: since } };

  const [total, published, views, visitors, starts, leads, completeLeads, highIntent, pendingNew, wantsVisit, whatsappClicks, byChannel, recentHighIntent] =
    await Promise.all([
      db.property.count({ where: { accountId } }),
      db.property.count({ where: { accountId, status: "PUBLISHED" } }),
      db.analyticsEvent.count({ where: { ...period, type: "PAGE_VIEW" } }),
      db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT "visitorId")::int AS count FROM "AnalyticsEvent"
        WHERE "accountId" = ${accountId} AND "type" = 'PAGE_VIEW' AND "createdAt" >= ${since}`,
      db.analyticsEvent.count({ where: { ...period, type: "QUESTIONNAIRE_START" } }),
      db.lead.count({ where: period }),
      db.lead.count({ where: { ...period, isComplete: true } }),
      db.lead.count({ where: { ...period, classification: "HIGH" } }),
      db.lead.count({ where: { accountId, status: "NEW" } }),
      db.lead.count({ where: { ...period, wantsVisit: true } }),
      db.lead.count({ where: { ...period, whatsappClickedAt: { not: null } } }),
      db.lead.groupBy({ by: ["channel"], where: period, _count: { _all: true } }),
      db.lead.findMany({
        where: { accountId, classification: "HIGH" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { property: { select: { title: true } } },
      }),
    ]);

  const uniqueVisitors = visitors[0]?.count ?? 0;
  return {
    days,
    properties: { total, published },
    views,
    uniqueVisitors,
    questionnaireStarts: starts,
    leads,
    completeLeads,
    highIntent,
    pendingNew,
    wantsVisit,
    whatsappClicks,
    rates: {
      visitorToLead: rate(leads, uniqueVisitors),
      completion: rate(completeLeads, leads),
      leadToWhatsapp: rate(whatsappClicks, completeLeads),
    },
    byChannel: byChannel
      .map((c) => ({ channel: c.channel as Channel, count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    recentHighIntent,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
```

- [ ] **Step 5: Run** `npx vitest run` → all PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(leads): gestão de contatos e métricas do painel"`

---

### Task 11: UI foundation — design system, auth pages, panel shell

**REQUIRED SUB-SKILL:** invoke `frontend-design:frontend-design` before writing UI code in this task and apply its guidance consistently in Tasks 12–15.

**Files:**
- Create: `src/app/globals.css` (replace), `src/app/layout.tsx` (replace), `src/app/page.tsx` (replace), `src/components/ui/*`, `src/lib/form-state.ts`, `src/server/action.ts`, `src/app/(auth)/{login,cadastro}/page.tsx`, `src/app/(auth)/actions.ts`, `src/components/painel/{Shell,SidebarNav,BottomNav}.tsx`, `src/app/painel/layout.tsx`, `src/app/painel/page.tsx` (placeholder heading replaced in Task 14), `src/proxy.ts`

**Interfaces:**
- Consumes: `signup`, `authenticate`, `createSession`, `deleteSession`, `setSessionCookie`, `clearSessionCookie`, `requireUser`, `SESSION_COOKIE`, errors.
- Produces:
  - `FormState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string> }`, `initialFormState`
  - `runAction(fn: () => Promise<string | void>): Promise<FormState>` (server-only helper mapping `ValidationError`/`NotFoundError`/`ConflictError` to `FormState`; logs and returns generic message otherwise)
  - UI kit components: `Button` (variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`), `SubmitButton` (uses `useFormStatus`, shows spinner), `Field` (label + hint + error), `Input`, `Textarea`, `Select`, `Checkbox`, `Card`, `Badge` (tones `neutral | success | warning | danger | info`), `EmptyState` (icon, title, text, action), `FormMessage` (renders `FormState.message`), `ClassificationBadge` (uses `CLASSIFICATION_LABELS`, tooltip/title = `CLASSIFICATION_DISCLAIMER`)
  - `Shell` layout: sidebar ≥ 1024px (Início, Imóveis, Contatos, Questionário, Perfil, Sair), bottom nav < 1024px with the same 5 destinations (Sair inside Perfil page on mobile)

**Design direction (to refine with frontend-design):**
- Panel: calm, dense-but-airy work tool. Neutral warm stone background, white cards, one strong brand color (deep teal/petrol) for primary actions; WhatsApp green **only** for WhatsApp actions; classification tones: HIGH emerald, MEDIUM amber, LOW slate, UNRATED neutral.
- Public page: editorial real-estate feel — large imagery, serif display font for titles/prices, generous spacing.
- Fonts via `next/font/google` (a sans for UI + a serif display for public titles). Define colors as CSS variables in `@theme` (Tailwind 4) so a future per-agent brand color can override `--color-brand`.

- [ ] **Step 1: `src/lib/form-state.ts`**

```ts
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};
export const initialFormState: FormState = { status: "idle" };
```

- [ ] **Step 2: `src/server/action.ts`**

```ts
import "server-only";
import type { FormState } from "@/lib/form-state";
import { AppError, ValidationError } from "./errors";

/** Executa a regra de negócio e converte erros conhecidos em estado de formulário. Não chamar redirect() dentro de fn. */
export async function runAction(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const message = await fn();
    return { status: "success", message: message || undefined };
  } catch (e) {
    if (e instanceof ValidationError) return { status: "error", message: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AppError) return { status: "error", message: e.message };
    console.error(e);
    return { status: "error", message: "Algo deu errado. Tente novamente em instantes." };
  }
}
```

- [ ] **Step 3: Auth actions** `src/app/(auth)/actions.ts`:

```ts
"use server";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { clearSessionCookie, getCurrentUser, SESSION_COOKIE, setSessionCookie } from "@/server/auth/current";
import { createSession, deleteSession } from "@/server/auth/session";
import { authenticate, signup } from "@/server/services/accounts";
import { cookies } from "next/headers";

export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  let ok = false;
  const state = await runAction(async () => {
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
  const state = await runAction(async () => {
    const ctx = await authenticate(Object.fromEntries(formData));
    if (!ctx) return;
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
```

- [ ] **Step 4: Pages**
  - `src/app/(auth)/login/page.tsx` and `cadastro/page.tsx`: server components calling `redirectIfLoggedIn()`, rendering a client form component using `useActionState(loginAction, initialFormState)`; fields `email`, `password` (+ `name` on cadastro); errors from `state.fieldErrors`; links between the two pages; short value proposition beside the form on desktop ("Transforme cliques em contatos qualificados").
  - `src/app/page.tsx`: `redirect(user ? "/painel" : "/login")` using `getCurrentUser()`.
  - `src/app/layout.tsx`: `lang="pt-BR"`, fonts, `metadata` (`title.template: "%s · Corretor Leads"`, `applicationName`), `viewport.themeColor`.
  - `src/app/painel/layout.tsx`: `const user = await requireUser();` → `<Shell user={user}>{children}</Shell>`. Registers `/sw.js` via a tiny client component (Task 15 adds the file).
  - `src/app/painel/page.tsx`: temporary `<h1>Olá, {user.name}</h1>`.

- [ ] **Step 5: Proxy** `src/proxy.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";

/** Barreira leve: sem cookie de sessão não entra no painel. A validação real acontece no servidor (requireUser). */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sc_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*"] };
```

- [ ] **Step 6: Verify manually**

```bash
npm run dev
```
Visit `http://localhost:3000` → redirected to `/login`; create account on `/cadastro` → lands on `/painel/perfil?boas-vindas=1` (404 until Task 14 is fine, shell must render); `/painel` shows greeting; logout returns to `/login`; visiting `/painel` logged out redirects. Check at 360px and 1366px widths (DevTools). Then `npx next build` succeeds and `npm run lint` passes.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): design system, login/cadastro e layout do painel"`

---

### Task 12: Panel — properties (list, form, photos, status, share, QR)

**Files:**
- Create: `src/app/painel/imoveis/{page.tsx, actions.ts}`, `src/app/painel/imoveis/novo/page.tsx`, `src/app/painel/imoveis/[id]/page.tsx`, `src/app/painel/imoveis/[id]/qrcode/route.ts`, `src/components/painel/{PropertyForm,PhotoManager,StatusControl,SharePanel}.tsx`, `src/lib/image-resize.ts`, `src/app/uploads/[...key]/route.ts`, `src/lib/app-url.ts`

**Interfaces:**
- Consumes: properties service (Task 7), `PROPERTY_*_LABELS`, `formatBRL`, `runAction`, `FormState`.
- Produces server actions (all start with `const user = await requireUser()`):
  - `createPropertyAction(_: FormState, fd: FormData)` → redirect to `/painel/imoveis/{id}?novo=1`
  - `updatePropertyAction(id: string, _: FormState, fd: FormData)` (bound with `.bind(null, id)`)
  - `setStatusAction(id: string, status: PropertyStatus)` → `FormState`
  - `deletePropertyAction(id: string)` → `FormState` or redirect to `/painel/imoveis`
  - `uploadImageAction(propertyId: string, fd: FormData)` (field `file`) → `FormState`
  - `removeImageAction(imageId: string)`, `reorderImagesAction(propertyId: string, ids: string[])`
  - each calls `revalidatePath("/painel/imoveis")` / `revalidatePath(\`/painel/imoveis/${id}\`)` and, when status/content changes on a published property, `revalidatePath(\`/imovel/${slug}\`)`.
  - `getAppUrl(): Promise<string>` in `src/lib/app-url.ts` → `process.env.APP_URL` or `https://${host}` from `headers()`.

- [ ] **Step 1: Client-side resize** `src/lib/image-resize.ts`:

```ts
/** Reduz fotos do celular (5–12 MB) para ~300–600 KB antes do envio. */
export async function resizeImage(file: File, maxSize = 1920, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao processar imagem"))), "image/jpeg", quality),
  );
}
```

- [ ] **Step 2: Upload action pattern** (in `src/app/painel/imoveis/actions.ts`):

```ts
export async function uploadImageAction(propertyId: string, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError({ file: "Selecione uma imagem" });
    await addPropertyImage(user, propertyId, { data: Buffer.from(await file.arrayBuffer()) });
    revalidatePath(`/painel/imoveis/${propertyId}`);
  });
}
```
`PhotoManager` (client): multi-file `<input type="file" accept="image/*" multiple>`; for each file sequentially: `resizeImage` → `FormData` → `uploadImageAction`, showing per-file progress/errors; grid of thumbnails with "Capa" badge on first, buttons ◀ ▶ (reorder by computing the new id list and calling `reorderImagesAction`), "Tornar capa", "Remover" (confirm). Use `useTransition` for pending state.

- [ ] **Step 3: Local uploads route** `src/app/uploads/[...key]/route.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR } from "@/server/storage/local";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") return new Response(null, { status: 404 });
  const { key } = await params;
  const file = path.resolve(LOCAL_UPLOAD_DIR, ...key);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new Response(null, { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(data, {
      headers: { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
```

- [ ] **Step 4: QR route** `src/app/painel/imoveis/[id]/qrcode/route.ts`:

```ts
import QRCode from "qrcode";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { getProperty } from "@/server/services/properties";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  try {
    const property = await getProperty(user, id);
    const url = `${await getAppUrl()}/imovel/${property.slug}?utm_source=qrcode&utm_medium=offline`;
    const png = await QRCode.toBuffer(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    const download = new URL(request.url).searchParams.has("download");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        ...(download ? { "Content-Disposition": `attachment; filename="qrcode-${property.slug}.png"` } : {}),
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response(null, { status: 404 });
    throw e;
  }
}
```

`src/lib/app-url.ts`:
```ts
import "server-only";
import { headers } from "next/headers";

export async function getAppUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
```

- [ ] **Step 5: Pages and components**
  - `/painel/imoveis`: header with "Novo imóvel" button; cards (cover photo, title, neighborhood/city, `formatBRL(price)`, status badge, lead count, quick actions "Ver página" (published only) / "Editar"). Empty state: "Cadastre seu primeiro imóvel" + CTA.
  - `/painel/imoveis/novo`: `PropertyForm` bound to `createPropertyAction`.
  - `/painel/imoveis/[id]`: `notFound()` on `NotFoundError`. Sections: (1) **StatusControl** — current status badge + contextual buttons (Rascunho/Pausado → "Publicar"; Publicado → "Pausar", "Marcar como vendido/alugado" per purpose; Vendido/Alugado → "Republicar"), showing `FormState.message` errors like "Cadastre seu WhatsApp…" with a link to `/painel/perfil`; (2) **SharePanel** (only when published): public URL with copy button, link variants for Instagram/Facebook/Google (`?utm_source=instagram&utm_medium=social` etc.) each with copy, QR preview `<img src="/painel/imoveis/{id}/qrcode">` + "Baixar QR Code" (`?download=1`), "Abrir página"; (3) **PhotoManager**; (4) **PropertyForm** (edit); (5) danger zone "Excluir imóvel" (shows ConflictError message if it has leads).
  - `PropertyForm` (client, `useActionState`): grouped sections — Básico (título, tipo, finalidade, preço, condomínio, IPTU), Localização (cidade, bairro, endereço + checkbox "Mostrar endereço completo na página"), Características (quartos, suítes, banheiros, vagas, área construída, área do terreno), Descrição (descrição, diferenciais — textarea "um por linha", financiamento). Money inputs `inputMode="numeric"`; counts `inputMode="numeric"`; field errors from `state.fieldErrors[name]`; keep typed values on error (use `defaultValue` from last submitted `FormData` echoed in state or keep inputs uncontrolled and don't reset: pass `key` stable). Sticky save bar on mobile.

- [ ] **Step 6: Verify manually** — create property, upload 3 photos from disk (check resize: network payload < 1 MB), reorder, set cover, try publishing without WhatsApp (error + link), set WhatsApp directly in DB or wait for Task 14 (`docker compose exec db psql -U corretor -c "update \"User\" set whatsapp='5567999990000'"`), publish, copy link, download QR, scan QR with phone camera shows URL. `npx next build` + `npm run lint` pass.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): gestão de imóveis, fotos, publicação e QR Code"`

---

### Task 13: Public property page, visitor flow, public API, tracking

**Files:**
- Create: `src/app/imovel/[slug]/page.tsx`, `src/app/imovel/[slug]/interesse/page.tsx`, `src/components/publico/{Gallery,PropertyFacts,AgentCard,StickyCta,TrackPageView,InterestFlow}.tsx`, `src/lib/tracking.ts`, `src/server/http.ts`, `src/app/api/public/events/route.ts`, `src/app/api/public/leads/route.ts`, `src/app/api/public/leads/[id]/answers/route.ts`, `src/app/api/public/leads/[id]/whatsapp/route.ts`

**Interfaces:**
- Consumes: `getPublicPropertyBySlug`, `getPublicQuestions`, `PublicQuestion`, `startLead`, `submitAnswers`, `registerWhatsappClick`, `recordPublicEvent`, `checkRateLimit`, `visibleQuestions`, `isAnswered`, `CONSENT_TEXT`, labels, `formatBRL`, `formatBrPhone`, `getAppUrl`.
- Produces HTTP API:
  - `POST /api/public/events` `{ propertyId, type, visitorId?, attribution? }` → `204`
  - `POST /api/public/leads` `{ propertyId, name, phone, email?, consent, visitorId?, landingUrl?, attribution? }` → `201 { leadId, token }`
  - `POST /api/public/leads/:id/answers` `{ token, answers }` → `200 Handoff`
  - `POST /api/public/leads/:id/whatsapp` `{ token }` (body may be `text/plain` from `sendBeacon`) → `204`
  - Errors: `422 { message, fieldErrors }`, `404 { message }`, `429 { message }`, `500 { message }`
  - `tracking.ts` (client): `getVisitorId(): string`, `captureAttribution(): AttributionPayload` (first-touch per session in `sessionStorage["sc_attr"]`, overwritten when the URL carries new UTMs / click ids), `getAttribution(): AttributionPayload`

- [ ] **Step 1: HTTP helper** `src/server/http.ts`:

```ts
import "server-only";
import { NotFoundError, RateLimitError, ValidationError } from "./errors";
import { checkRateLimit } from "./rate-limit";

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export function enforceRateLimit(request: Request, bucket: string, limit: number, windowMs: number) {
  if (!checkRateLimit(`${bucket}:${clientIp(request)}`, limit, windowMs)) throw new RateLimitError();
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text());
  } catch {
    throw new ValidationError({ _form: "Requisição inválida" }, "Requisição inválida");
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ValidationError) return Response.json({ message: e.message, fieldErrors: e.fieldErrors }, { status: 422 });
  if (e instanceof NotFoundError) return Response.json({ message: e.message }, { status: 404 });
  if (e instanceof RateLimitError) return Response.json({ message: e.message }, { status: 429 });
  console.error(e);
  return Response.json({ message: "Algo deu errado. Tente novamente." }, { status: 500 });
}
```

- [ ] **Step 2: Route handlers**

`src/app/api/public/leads/route.ts`:
```ts
import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { startLead } from "@/server/services/public-leads";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "lead", 5, 10 * 60 * 1000);
    const result = await startLead(await readJson(request), { ownHost: new URL(request.url).host });
    return Response.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/api/public/leads/[id]/answers/route.ts`:
```ts
import { getAppUrl } from "@/lib/app-url";
import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { submitAnswers } from "@/server/services/public-leads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request, "answers", 20, 10 * 60 * 1000);
    const { id } = await params;
    const body = (await readJson(request)) as { token?: unknown; answers?: unknown };
    const handoff = await submitAnswers(id, String(body?.token ?? ""), { answers: body?.answers }, { appUrl: await getAppUrl() });
    return Response.json(handoff);
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/api/public/leads/[id]/whatsapp/route.ts`:
```ts
import { errorResponse, readJson } from "@/server/http";
import { registerWhatsappClick } from "@/server/services/public-leads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await readJson(request)) as { token?: unknown };
    await registerWhatsappClick(id, String(body?.token ?? ""));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/api/public/events/route.ts`:
```ts
import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { recordPublicEvent } from "@/server/services/public-leads";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "events", 60, 60 * 1000);
    await recordPublicEvent(await readJson(request), { ownHost: new URL(request.url).host });
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 3: Client tracking** `src/lib/tracking.ts`:

```ts
export type AttributionPayload = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string;
  referrer?: string; gclid?: string; fbclid?: string;
};

const VISITOR_KEY = "sc_vid";
const ATTR_KEY = "sc_attr";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getVisitorId(): string {
  return safe(() => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }, "anon");
}

/** Primeiro toque da sessão: campanha/clique na URL ou referrer externo sobrescrevem; senão mantém o que já existe. */
export function captureAttribution(): AttributionPayload {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k) ?? undefined;
  const referrer =
    document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined;
  const fromUrl: AttributionPayload = {
    utmSource: get("utm_source"), utmMedium: get("utm_medium"), utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"), utmTerm: get("utm_term"), gclid: get("gclid"), fbclid: get("fbclid"), referrer,
  };
  const hasSignal = Boolean(fromUrl.utmSource || fromUrl.gclid || fromUrl.fbclid || referrer);
  const stored = safe(() => sessionStorage.getItem(ATTR_KEY), null);
  if (hasSignal || stored === null) {
    safe(() => sessionStorage.setItem(ATTR_KEY, JSON.stringify(fromUrl)), undefined);
    return fromUrl;
  }
  return getAttribution();
}

export function getAttribution(): AttributionPayload {
  return safe(() => JSON.parse(sessionStorage.getItem(ATTR_KEY) ?? "{}") as AttributionPayload, {});
}

export function sendEvent(propertyId: string, type: "PAGE_VIEW" | "QUESTIONNAIRE_START") {
  const body = JSON.stringify({ propertyId, type, visitorId: getVisitorId(), attribution: getAttribution() });
  fetch("/api/public/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
```

`TrackPageView` (client): `useEffect(() => { captureAttribution(); sendEvent(propertyId, "PAGE_VIEW"); }, [propertyId])` — guard against React StrictMode double-run with a `useRef` flag.

- [ ] **Step 4: Public page** `src/app/imovel/[slug]/page.tsx`:
  - `export const revalidate = 60;`
  - `generateMetadata({ params })`: title `"{title} — {formatBRL(price)} · {neighborhood}, {city}"`, description = first 155 chars of description, `openGraph: { type: "website", images: [{ url: absolute(cover), width: 1200, height: 630 }], locale: "pt_BR" }`, `twitter: { card: "summary_large_image" }`, `alternates.canonical`. Use `getAppUrl()` to make relative `/uploads/..` image URLs absolute.
  - Not found → `notFound()`.
  - JSON-LD `<script type="application/ld+json">` with `@type: "RealEstateListing"`, `name`, `description`, `url`, `image[]`, `offers: { @type: "Offer", price, priceCurrency: "BRL" }`, `address: { addressLocality: city, addressRegion?, streetAddress only if showAddress }`.
  - Layout: `Gallery` (mobile: horizontal scroll-snap with counter; desktop: 1 large + 4 grid, "Ver todas as fotos" lightbox using `<dialog>`), title (serif), price + purpose, condomínio/IPTU line, location (address only if `showAddress`), `PropertyFacts` (icons lucide: BedDouble, Bath, Car, Ruler…; hide nulls), description (preserve line breaks), diferenciais as chips, financing info card, `AgentCard` (photo, name, CRECI, agency, bio, Instagram link — **no direct WhatsApp link**), CTA section "Tenho interesse neste imóvel" + microcopy "Leva menos de 1 minuto. O corretor recebe suas respostas e fala com você no WhatsApp.", `StickyCta` fixed at bottom on mobile (≥ 56px tall).
  - SOLD/RENTED: banner "Este imóvel foi vendido/alugado" and CTA replaced by "Ver outros imóveis com {agent.name}" → not in MVP; show agent card only.
  - CTA links to `/imovel/{slug}/interesse` (preserve nothing in URL — attribution is in sessionStorage).
  - `<TrackPageView propertyId={p.id} />` only when `PUBLISHED`.

- [ ] **Step 5: Interest page** `src/app/imovel/[slug]/interesse/page.tsx`: server component; loads property (must be `PUBLISHED`, else `redirect(\`/imovel/${slug}\`)`), `getPublicQuestions(p.id)`; renders `metadata.robots = { index: false }` and `<InterestFlow property={{ id, title, slug, coverUrl, agentName, agentPhotoUrl }} questions={questions} consentText={CONSENT_TEXT} />`.

- [ ] **Step 6: `InterestFlow`** (client) — state machine:

```ts
type Step = { kind: "contact" } | { kind: "question"; index: number } | { kind: "sending" } | { kind: "done"; handoff: Handoff };
```
Behavior:
  1. On mount: `captureAttribution()` (in case of direct entry) and `sendEvent(property.id, "QUESTIONNAIRE_START")` once; restore `{ leadId, token, answers }` from `sessionStorage["sc_lead_" + property.id]` if present (resume after reload).
  2. **contact**: header with cover thumb + title + "Etapa 1 de N"; fields Nome, WhatsApp (`type="tel" inputMode="tel" autoComplete="tel"`, live mask `(67) 99999-1234`), E-mail (opcional), checkbox with `consentText` and link to `/privacidade` (opens new tab). Submit → `POST /api/public/leads` with `visitorId`, `landingUrl: location.href`, `attribution: getAttribution()`. On 422 show `fieldErrors` inline; on 429/500 show message with "Tentar novamente". On success persist `{ leadId, token }` and go to first visible question (or straight to submit if none).
  3. **question**: one per screen, `visibleQuestions(questions, answers)` recomputed each step; progress bar `(index+2)/(visible.length+1)`; choice options as full-width buttons ≥ 56px (single choice/YES_NO auto-advance after 150 ms; multi choice toggles + "Continuar"); TEXT → textarea + "Continuar"; NUMBER → `inputMode="numeric"`; optional questions show "Pular"; back button returns to previous step (answers kept).
  4. After last question → `POST /api/public/leads/{id}/answers` `{ token, answers }` (only answers for visible questions). On 422 jump to the first question with an error and show it. On success → **done**.
  5. **done**: check icon, "Pronto, {firstName}!", summary list of `handoff.lines`, primary green button "Continuar no WhatsApp" (`<a href={handoff.whatsappUrl} target="_blank" rel="noopener">`) with `onClick={() => navigator.sendBeacon(\`/api/public/leads/${leadId}/whatsapp\`, JSON.stringify({ token }))}`; secondary link "Voltar ao imóvel". Microcopy: "Sua mensagem já vai pronta — é só enviar." Clear the sessionStorage lead entry.
  - Accessibility: focus heading on each step change, `aria-live="polite"` for errors, buttons are real `<button>`s, respects `prefers-reduced-motion`.

- [ ] **Step 7: Verify manually** — with a published property: open `/imovel/{slug}?utm_source=instagram` in a mobile viewport (375px and 320px), complete the flow, confirm WhatsApp link opens `wa.me` with message, and in DB: `select name, channel, classification, score from "Lead";` shows INSTAGRAM/HIGH. Check Open Graph tags via `curl -s localhost:3000/imovel/{slug} | grep og:`. `npx next build` + lint pass.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(publico): página do imóvel, questionário mobile e encaminhamento ao WhatsApp"`

---

### Task 14: Panel — leads, questionnaire editor, profile, dashboard

**Files:**
- Create: `src/app/painel/leads/{page.tsx, actions.ts}`, `src/app/painel/leads/[id]/page.tsx`, `src/app/painel/questionario/{page.tsx, actions.ts}`, `src/app/painel/perfil/{page.tsx, actions.ts}`, `src/components/painel/{LeadFilters,LeadTable,LeadStatusSelect,NoteForm,QuestionEditor,ProfileForm,StatCard,ChannelBars}.tsx`
- Modify: `src/app/painel/page.tsx`

**Interfaces:**
- Consumes: leads/analytics/questionnaires/profile services; labels; `formatBrPhone`, `formatPercent`, `buildWhatsappUrl`; `ClassificationBadge`.
- Produces server actions: `updateLeadStatusAction(id, status)`, `addLeadNoteAction(id, _: FormState, fd)`, `deleteLeadAction(id)` (redirect to `/painel/leads`), `saveQuestionAction(id: string | null, input: QuestionInput)`, `deleteQuestionAction(id)`, `moveQuestionAction(id, dir)`, `updateProfileAction(_: FormState, fd)`, `uploadProfilePhotoAction(fd)`.

- [ ] **Step 1: Leads list** `/painel/leads?propertyId&classification&status&channel&complete&q&days&page`:
  - `LeadFilters` (client): search input (debounced 300 ms → `router.replace` with params), selects for imóvel, classificação, status, origem, período (7/30/90/todos), toggle "Incluir incompletos". Filters collapse into a "Filtros" sheet on mobile.
  - Desktop table columns: Nome (+ telefone formatado), Imóvel, Classificação (`ClassificationBadge` + score `65/100`), Visita (ícone se `wantsVisit`), Origem, Status, Data (`Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })`). Mobile: stacked cards. Incomplete leads show a muted "Incompleto" badge.
  - Pagination (Anterior/Próxima) using `total`/`pageSize`.
  - Empty states: no leads at all ("Compartilhe o link de um imóvel para receber os primeiros contatos" + link to imóveis) vs no results for filters ("Nenhum contato com esses filtros" + "Limpar filtros").
  - Disclaimer text `CLASSIFICATION_DISCLAIMER` shown once under the header.

- [ ] **Step 2: Lead detail** `/painel/leads/[id]`:
  - Header: name, classification badge + score + disclaimer, status select (`LeadStatusSelect` calls `updateLeadStatusAction` on change with optimistic UI), buttons "Abrir WhatsApp" (`buildWhatsappUrl(lead.phone, \`Olá, ${firstName}! Aqui é ${user.name}, sobre o imóvel ${lead.property.title}.\`)`) and "Ligar" (`tel:`).
  - Cards: Contato (telefone, e-mail, data, consentimento registrado em …), Imóvel (link to panel property + public page), Respostas (`questionLabel` → `displayValue`, points in muted text), Origem (canal, utm_*, referrer), Observações (`NoteForm` + list), Histórico (status timeline with who/when), "Excluir contato" (confirm dialog; text: "Remove permanentemente os dados desta pessoa (LGPD).").

- [ ] **Step 3: Questionnaire editor** `/painel/questionario`:
  - Intro: "Este questionário aparece em todos os seus imóveis. Mantenha curto: 4–6 perguntas convertem melhor." + counter `n/10`.
  - List of questions in cards: label, type label, "Obrigatória" badge, "Indica visita" badge, options with weights shown as small pills (`À vista · 25 pts`), max points per question; actions ↑ ↓ Editar Excluir.
  - `QuestionEditor` (client, inline expand or sheet on mobile): label input, type select (`QUESTION_TYPE_LABELS`), required toggle, "Esta pergunta indica interesse em visita" toggle, options editor (for choice types: rows label + weight number 0–100 + remove; "Adicionar opção"; YES_NO shows fixed Sim/Não rows with editable weights only). Save calls `saveQuestionAction` with a typed object (not FormData); display `fieldErrors` (keys like `options.1.label`).
  - Side panel "Como a pontuação funciona": sum of weights ÷ max possible; ≥ 60% Alta, ≥ 30% Média, abaixo Baixa; plus disclaimer. Live preview of max total points.

- [ ] **Step 4: Profile** `/painel/perfil`:
  - If `?boas-vindas=1`: welcome banner "Complete seu perfil — o WhatsApp é obrigatório para publicar imóveis."
  - `ProfileForm`: nome, WhatsApp (required hint), telefone, CRECI, imobiliária, Instagram, bio (counter 600); photo uploader (resize to 800px via `resizeImage(file, 800)` then `uploadProfilePhotoAction`); preview card "Como aparece na página do imóvel" (reuse `AgentCard`).
  - Mobile: "Sair" button at bottom (calls `logoutAction`).

- [ ] **Step 5: Dashboard** `/painel?dias=7|30|90` (default 30):
  - Period segmented control.
  - Row of `StatCard`s: Visitantes únicos, Contatos, Alta intenção, Querem visitar, Aguardando atendimento (`pendingNew`, links to `/painel/leads?status=NEW`), Imóveis publicados (`published/total`).
  - Funnel card: Visitantes → Contatos → Questionário concluído → WhatsApp, with counts and the three rates (`formatPercent`), horizontal bars proportional to the first step.
  - `ChannelBars`: leads by channel as horizontal bars with labels + counts (pure CSS widths; no chart library).
  - "Contatos de alta intenção recentes": list linking to lead detail.
  - First-run empty state (no properties): 3-step checklist — "Complete seu perfil" (done if whatsapp), "Cadastre um imóvel", "Publique e compartilhe o link" — each linking to the right page.

- [ ] **Step 6: Verify manually** — run through: edit questionnaire (add question, change weights, reorder), complete public flow again, see new lead in list with correct filters, open detail, change status (history shows), add note, open WhatsApp link, delete a lead. Dashboard numbers match DB. Test at 320/768/1366px. `npx next build` + lint pass; `npm test` still green.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): contatos, editor de questionário, perfil e dashboard"`

---

### Task 15: PWA, privacy page, seed data

**Files:**
- Create: `src/app/manifest.ts`, `src/app/pwa-icon/[size]/route.tsx`, `public/sw.js`, `src/components/painel/RegisterSW.tsx`, `src/app/privacidade/page.tsx`, `prisma/seed.ts`

**Interfaces:**
- Consumes: `signup`, `createProperty`, `setPropertyStatus`, `getQuestionDefsForProperty`, `scoreAnswers`, `formatAnswer`, `detectVisitIntent`, `db`.

- [ ] **Step 1: Manifest** `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corretor Leads",
    short_name: "Corretor",
    description: "Capte, qualifique e acompanhe contatos dos seus imóveis.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#0f3d3e",
    lang: "pt-BR",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```
(Use the brand color chosen in Task 11 for `theme_color`.)

`src/app/pwa-icon/[size]/route.tsx`:
```tsx
import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f3d3e", color: "#fff", fontSize: size * 0.42, fontWeight: 700 }}>
        CL
      </div>
    ),
    { width: size, height: size },
  );
}
```

`public/sw.js` (minimal, network-only; makes the app installable and is a hook for future offline support):
```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
```
`RegisterSW` (client, rendered in painel layout): `useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, [])`.

- [ ] **Step 2: Privacy page** `src/app/privacidade/page.tsx` — static page with a visible yellow notice at the top: "**Modelo pendente de revisão jurídica.** Este texto é um ponto de partida e deve ser revisado por um advogado antes do uso comercial." Sections: quem é o controlador (o corretor responsável pelo imóvel) e o operador (a plataforma); quais dados coletamos (nome, WhatsApp, e-mail opcional, respostas, origem da visita, identificador anônimo do navegador — sem IP); finalidade (contato sobre o imóvel e qualificação do atendimento); base legal (consentimento — **a validar**); compartilhamento (apenas com o corretor do imóvel); retenção (**a definir**); direitos do titular (acesso, correção, exclusão — contato com o corretor); contato do encarregado (**a definir**).

- [ ] **Step 3: Seed** `prisma/seed.ts`:
  - Idempotent: delete existing user `ana@exemplo.com` and its account (cascade; delete leads/properties first because of `Restrict`: `lead.deleteMany({ where: { accountId } })`, `property.deleteMany`, then `account.delete`).
  - `signup({ name: "Ana Martins", email: "ana@exemplo.com", password: "demo12345" })`; update profile: WhatsApp `5567999990000`, CRECI `12345-F/MS`, agencyName "Martins Imóveis", bio, Instagram.
  - 3 properties via `createProperty` (Campo Grande/MS): "Casa no Jardim dos Estados" (HOUSE, SALE, 850.000, 3 quartos, 1 suíte, 2 vagas, 180 m²), "Apartamento no Centro" (APARTMENT, RENT, 2.300, condomínio 450, 2 quartos), "Sobrado no Carandá Bosque" (TOWNHOUSE, SALE, 1.290.000, 4 quartos, 3 suítes, 4 vagas, 320 m²) with realistic descriptions and highlights.
  - Photos: insert `PropertyImage` rows directly with external URLs (`storageKey: "seed/<n>"`), 4 per property. Before committing, verify each URL returns 200 with `curl -sI <url> | head -1`; use Unsplash CDN image URLs of houses/apartments (`https://images.unsplash.com/photo-<id>?w=1600&q=80`) and replace any that fail. Add `images.unsplash.com` to nothing else (plain `<img>` is used, no `next/image` remotePatterns needed).
  - Publish all 3 (`setPropertyStatus`).
  - ~40 `AnalyticsEvent` PAGE_VIEWs per property spread over last 30 days with channels (Instagram 40%, Facebook 20%, Google 15%, QR Code 15%, Direct 10%), random visitorIds.
  - 14 leads spread over the last 30 days with varied answer combinations: for each, pick option indexes, compute with `scoreAnswers`/`formatAnswer`/`detectVisitIntent` from `getQuestionDefsForProperty`, create `Lead` + `LeadAnswer`s + `LeadStatusHistory`; mix of statuses (NEW, CONTACTED, VISIT_SCHEDULED, NEGOTIATING, LOST), 2 incomplete leads, some with `whatsappClickedAt`, 1–2 notes. Brazilian names (e.g. João Pereira, Mariana Costa, Rafael Oliveira, Beatriz Santos…), phones `55679xxxxxxxx`.
  - Print at the end: `Login: ana@exemplo.com / demo12345` and the 3 public URLs.

- [ ] **Step 4: Verify**

```bash
npm run db:seed && npm run db:seed   # idempotent
npm run dev
```
Log in as Ana → dashboard shows numbers, leads list has 14, public pages render photos. Chrome DevTools → Application → Manifest shows installable. Lighthouse (mobile) on a public page: check no major accessibility/SEO failures.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: PWA, política de privacidade (modelo) e dados de exemplo"`

---

### Task 16: End-to-end test, documentation, final verification

**Files:**
- Create: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/fluxo-completo.spec.ts`, `e2e/fixtures/casa.png` (any real photo ≥ 800px, e.g. downloaded from a seed URL), `README.md` (replace), `docs/arquitetura.md`, `docs/deploy.md`, `docs/lgpd-pendencias.md`

- [ ] **Step 1: Playwright config** `playwright.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      APP_URL: `http://localhost:${PORT}`,
      STORAGE_DRIVER: "local",
    },
  },
});
```
Note: `next dev` refuses a second dev server in the same directory in some versions; stop `npm run dev` before running e2e.

`e2e/global-setup.ts`:
```ts
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(
    `TRUNCATE TABLE "AnalyticsEvent","LeadStatusHistory","LeadNote","LeadAnswer","Lead","QuestionOption","Question","Questionnaire","PropertyImage","Property","Session","User","Account" CASCADE`,
  );
  await client.end();
}
```

- [ ] **Step 2: E2E spec** `e2e/fluxo-completo.spec.ts` (selectors use accessible roles/labels — adjust names to the final UI copy):

```ts
import path from "node:path";
import { devices, expect, test } from "@playwright/test";

test("corretor publica imóvel e recebe lead qualificado", async ({ page, browser }) => {
  // 1. Cadastro
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Ana Martins");
  await page.getByLabel("E-mail").fill(`ana+${Date.now()}@exemplo.com`);
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: /criar conta/i }).click();
  await expect(page).toHaveURL(/\/painel\/perfil/);

  // 2. Perfil com WhatsApp
  await page.getByLabel("WhatsApp").fill("(67) 99999-0000");
  await page.getByRole("button", { name: /salvar/i }).click();
  await expect(page.getByText(/perfil atualizado/i)).toBeVisible();

  // 3. Imóvel
  await page.goto("/painel/imoveis/novo");
  await page.getByLabel("Título").fill("Casa no Jardim dos Estados");
  await page.getByLabel("Tipo").selectOption("HOUSE");
  await page.getByLabel("Finalidade").selectOption("SALE");
  await page.getByLabel("Preço").fill("850.000");
  await page.getByLabel("Cidade").fill("Campo Grande");
  await page.getByLabel("Bairro").fill("Jardim dos Estados");
  await page.getByLabel("Descrição").fill("Casa térrea ampla, com quintal, área gourmet e ótima iluminação.");
  await page.getByRole("button", { name: /salvar/i }).click();
  await expect(page).toHaveURL(/\/painel\/imoveis\/[^/]+/);

  // 4. Foto + publicação
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "casa.png"));
  await expect(page.getByAltText(/foto 1/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^publicar$/i }).click();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  const publicUrl = await page.getByTestId("public-url").textContent();
  expect(publicUrl).toContain("/imovel/casa-no-jardim-dos-estados");

  // 5. Visitante no celular vindo do Instagram
  const visitor = await browser.newContext({ ...devices["iPhone 13"] });
  const v = await visitor.newPage();
  await v.goto(`/imovel/casa-no-jardim-dos-estados?utm_source=instagram&utm_campaign=teste`);
  await expect(v.getByRole("heading", { name: "Casa no Jardim dos Estados" })).toBeVisible();
  await v.getByRole("link", { name: /tenho interesse/i }).first().click();
  await v.getByLabel("Nome").fill("João Pereira");
  await v.getByLabel("WhatsApp").fill("67988887777");
  await v.getByRole("checkbox").check();
  await v.getByRole("button", { name: /continuar/i }).click();
  for (const option of ["Comprar", "Imediatamente", "À vista", "Sim", "Sim"]) {
    await v.getByRole("button", { name: option, exact: true }).click();
  }
  const whatsapp = v.getByRole("link", { name: /continuar no whatsapp/i });
  await expect(whatsapp).toBeVisible();
  const href = await whatsapp.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/5567999990000\?text=/);
  expect(decodeURIComponent(href!.split("text=")[1])).toContain("Olá, sou João Pereira.");
  await visitor.close();

  // 6. Corretor vê o lead
  await page.goto("/painel/leads");
  const row = page.getByRole("link", { name: /João Pereira/ });
  await expect(row).toBeVisible();
  await expect(page.getByText("Alta intenção").first()).toBeVisible();
  await expect(page.getByText("Instagram").first()).toBeVisible();
  await row.click();
  await expect(page.getByText("Imediatamente")).toBeVisible();
});
```
Add `data-testid="public-url"` to the public URL element in `SharePanel` and `alt={\`Foto ${i + 1}\`}` to photo thumbnails in `PhotoManager` if not already present.

- [ ] **Step 3: Run**

```bash
npx playwright install chromium
npm run test:e2e
```
Expected: 1 passed. Fix any UI/selector mismatch in the app (prefer fixing accessibility labels over loosening the test).

- [ ] **Step 4: Docs**
  - `README.md` (PT-BR): what it is (funil), screenshots placeholder list removed — instead a short feature list; requisitos (Node 20+, Docker); **Rodando localmente**: `npm install` → `cp .env.example .env` → `npm run db:up` → `npm run db:migrate` → `npm run db:seed` → `npm run dev` → login `ana@exemplo.com / demo12345`; criar usuário (via /cadastro); scripts table; testes (`npm run test:unit`, `npm run test:integration` — needs Docker DB, `npm run test:e2e`); estrutura de pastas; links to docs.
  - `docs/arquitetura.md`: layers (domain / services / app), multi-tenancy rule (`Ctx`), public flow sequence (page view → start lead → answers → handoff → click), scoring rules, data model summary, extension points (condicionais via `showIf`, questionário por imóvel via `Questionnaire.propertyId`, `LeadHandoffChannel`, `StorageProvider`, equipes via `Account`/`UserRole`).
  - `docs/deploy.md`: Supabase (create project; Database → connection strings: use **Transaction pooler** URL with `?pgbouncer=true&connection_limit=1` as `DATABASE_URL` in Vercel and the **direct/session** URL to run `DATABASE_URL=<direct> npx prisma migrate deploy` from your machine; Storage → create public bucket `property-images`; copy service role key), Vercel (import repo, env vars `DATABASE_URL`, `APP_URL=https://<domínio>`, `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`; build command default `npm run build`), post-deploy checklist (create account, publish test property, run the flow from a phone, check Open Graph with WhatsApp link preview), note that the in-memory rate limit is per instance (swap for Upstash later), custom domain.
  - `docs/lgpd-pendencias.md`: implemented technical measures (consent checkbox + text snapshot + timestamp, no IP storage, per-account isolation, hashed passwords/sessions, lead deletion, minimal data) and **items for legal review**: política de privacidade final, papéis controlador/operador entre plataforma e corretor, base legal, prazo de retenção e rotina de expurgo, termos de uso para corretores, contrato de tratamento de dados, canal do encarregado (DPO), resposta a solicitações de titulares, transferência internacional (Vercel/Supabase regions), cookies/armazenamento local.

- [ ] **Step 5: Final verification**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```
All must pass. Then manual smoke test at 320px, 768px, 1366px on: login, dashboard, imóveis list/edit, leads list/detail, questionário, perfil, public page, interest flow.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "test: fluxo E2E completo; docs: README, arquitetura, deploy e LGPD"`

- [ ] **Step 7: Delivery report to the user** (in chat, PT-BR): implementadas / parcialmente implementadas / pendências / próximos passos recomendados (ex.: recuperação de senha por e-mail, perguntas condicionais na UI, questionário por imóvel, personalização de cor/logo, notificação de novo lead por e-mail/push, integração WhatsApp Business API, pixel Meta/Google Ads para otimizar campanhas por lead qualificado, domínio próprio por corretor, planos/pagamento, equipes).
