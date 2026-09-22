# Arquitetura

## Camadas

```
src/domain/    regras puras (sem I/O): pontuação, questionário, formatação, tipos.
               Testadas isoladamente, sem banco. Não importam nada de src/server.
src/server/    services/  regras de negócio + acesso ao Prisma. Toda função de painel
                          recebe um `Ctx` e filtra por `ctx.accountId` (ver "Multi-tenancy").
               auth/      sessão (hash de senha, tokens de sessão).
               storage/   abstração de armazenamento de arquivos (local | supabase | memory).
src/app/       rotas do Next.js (App Router). Server Components e Server Actions chamam
               os services; não implementam regra de negócio.
src/components/ componentes React: ui/ (design system interno), painel/, publico/, auth/.
```

A regra geral: `domain` não sabe que existe banco de dados; `server/services` não sabe que
existe HTTP; `app` não implementa regra de negócio, só orquestra.

## Multi-tenancy (`Ctx`)

```ts
// src/server/context.ts
export type Ctx = { accountId: string; userId: string };
```

Toda função de serviço do painel (`src/server/services/*`) recebe um `Ctx` obtido da sessão
autenticada — nunca de um parâmetro vindo do cliente — e filtra toda consulta por
`ctx.accountId`. Tentar acessar um registro de outra conta lança `NotFoundError`, nunca revela
que o registro existe (evita enumeração de IDs de outras contas).

Os **endpoints públicos** (`src/app/api/public/*`, páginas em `src/app/imovel/[slug]`) não
recebem `accountId` do cliente: ele é derivado no servidor a partir do imóvel (`Property.accountId`)
e as consultas só operam sobre imóveis com `status = PUBLISHED`.

## Fluxo público (visitante → lead)

```
1. Visitante abre /imovel/[slug]?utm_source=...
   → TrackPageView dispara AnalyticsEvent PAGE_VIEW (com atribuição capturada da URL)
2. Visitante clica em "Tenho interesse" → /imovel/[slug]/interesse
   → InterestFlow dispara AnalyticsEvent QUESTIONNAIRE_START
3. Etapa de contato (nome, WhatsApp, e-mail opcional, consentimento)
   → POST /api/public/leads → cria Lead (status inicial), guarda o texto do consentimento
     aceito + timestamp (sem IP), devolve { leadId, token }
4. Uma pergunta por tela (questões visíveis, calculadas com visibleQuestions)
   → estado da sessão do navegador guardado em sessionStorage (retomar se recarregar a página)
5. Ao terminar → POST /api/public/leads/[id]/answers { token, answers }
   → grava LeadAnswer (com displayValue e position "congelados" no momento da resposta),
     calcula score/classificação (scoreAnswers), marca Lead.completedAt,
     dispara AnalyticsEvent QUESTIONNAIRE_COMPLETE, devolve o link wa.me pronto (Handoff)
6. Visitante clica em "Continuar no WhatsApp"
   → POST /api/public/leads/[id]/whatsapp (sendBeacon) registra AnalyticsEvent WHATSAPP_CLICK
```

O `visitorId` é um UUID aleatório gerado e guardado em `localStorage` no navegador do visitante —
nunca em cookie, nunca associado a IP (se o `localStorage` estiver bloqueado, o navegador usa um id
aleatório por carregamento de página; valores genéricos como `"anon"` são recusados pela API). O
`Lead.publicToken` permite ao próprio visitante retomar seu lead (recarregar a página, terminar
depois) sem poder acessar o lead de outra pessoa.

Se o mesmo navegador reenviar o contato (mesmo imóvel, mesmo telefone **e mesmo `visitorId`**)
dentro de 24 h enquanto o lead ainda está incompleto, a API devolve o lead existente (id + token)
em vez de criar um duplicado. Quem conhece apenas o telefone de outra pessoa, mas tem outro
`visitorId` (ou nenhum), sempre ganha um lead novo — nunca recebe o token nem altera o nome/e-mail
do lead original. A conclusão do questionário é idempotente: o lead é marcado como completo com
`updateMany({ where: { isComplete: false } })` dentro da transação, então envios concorrentes gravam
respostas e o evento `QUESTIONNAIRE_COMPLETE` uma única vez.

## Pontuação e classificação

`src/domain/scoring.ts`:

- Cada opção de pergunta de escolha (`SINGLE_CHOICE`, `MULTI_CHOICE`, `YES_NO`) tem um peso
  inteiro de 0 a 100 (`questionMaxPoints` soma os pesos positivos para `MULTI_CHOICE`, usa o
  maior peso para `SINGLE_CHOICE`/`YES_NO`). Perguntas `TEXT`/`NUMBER` não pontuam.
- `score / maxScore` vira uma classificação: **≥ 60% → alta**, **≥ 30% → média**, abaixo → baixa.
  Sem perguntas pontuáveis ou lead incompleto → **sem classificação**.
- A classificação é sempre mostrada com o aviso: **"Indicação baseada nas respostas — não é
  garantia de intenção."** (`CLASSIFICATION_DISCLAIMER`, em `src/domain/labels.ts`).
- Só perguntas **visíveis** no momento da resposta contam (`visibleQuestions`, que resolve
  condicionais via `showIf`).

## Modelo de dados (resumo)

```
Account (conta/imobiliária) ── User (OWNER | AGENT, login)
   └── Property (imóvel: status, preço, fotos)
         ├── PropertyImage
         ├── Questionnaire (opcional; um por Property, senão usa o padrão da conta)
         │     └── Question (SINGLE_CHOICE | MULTI_CHOICE | YES_NO | TEXT | NUMBER,
         │                   required, isVisitIntent, showIf)
         │           └── QuestionOption (label, weight)
         └── Lead (visitante qualificado: contato, consentimento, score, classificação,
                    status de atendimento, canal/UTMs de origem, publicToken)
               ├── LeadAnswer (displayValue + position "congelados" no momento da resposta)
               ├── LeadNote (observações do corretor)
               └── LeadStatusHistory (trilha de mudanças de status)
Session (tokens de sessão, hash SHA-256)
AnalyticsEvent (PAGE_VIEW | QUESTIONNAIRE_START | QUESTIONNAIRE_COMPLETE | WHATSAPP_CLICK)
```

Ver `prisma/schema.prisma` para os campos completos.

## Pontos de extensão

- **Perguntas condicionais**: já suportadas no modelo (`Question.showIf: { questionId, optionIds }`,
  resolvido por `visibleQuestions` em `src/domain/questionnaire.ts`) — falta apenas a interface
  de edição no painel (hoje o editor de questionário é sempre linear).
- **Questionário por imóvel**: `Questionnaire.propertyId` já existe no schema (nullable — quando
  nulo, usa o questionário padrão da conta); falta a tela para o corretor escolher/editar um
  questionário específico de um imóvel.
- **Canal de encaminhamento do lead**: `Handoff`/`buildHandoffUrl` (`src/domain/whatsapp.ts`) é o
  único canal hoje (`LeadHandoffChannel` = WhatsApp via `wa.me`). Para adicionar outro canal
  (ex.: WhatsApp Business API, e-mail), implementar um novo "channel" com a mesma interface
  (`buildHandoffUrl({ phone, message }) → string | HandoffAction`) e trocar a escolha no service
  `public-leads`.
- **Armazenamento de arquivos**: `StorageProvider` (`src/server/storage/index.ts`) tem três
  implementações (`local`, `supabase`, `memory` — usada nos testes). Trocar de provedor é
  implementar a interface `{ put, delete }` e adicionar a opção em `STORAGE_DRIVER`.
- **Equipes / múltiplos corretores por conta**: o modelo já tem `Account` 1:N `User` com
  `UserRole` (`OWNER` | `AGENT`) e `Property.agentId` (o WhatsApp que recebe os leads é o do
  agente responsável, não necessariamente o dono da conta) — falta a interface de convite/gestão
  de membros da equipe no painel.
