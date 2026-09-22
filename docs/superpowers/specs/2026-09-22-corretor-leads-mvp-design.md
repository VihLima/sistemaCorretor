# Corretor Leads — MVP de validação (Design)

Data: 2026-09-22
Status: aprovado em conversa, aguardando revisão do documento

## 1. Objetivo

Ferramenta para corretores de imóveis **captarem, qualificarem, rastrearem e gerenciarem leads**.
Cada imóvel ganha uma página pública; para falar no WhatsApp, o visitante responde a um
questionário curto. O corretor recebe o lead já com respostas, pontuação e origem.

Funil: `ANÚNCIO/QR/LINK → PÁGINA DO IMÓVEL → QUESTIONÁRIO → LEAD (salvo + pontuado) → WHATSAPP → PAINEL`

Meta desta versão: **validar com um corretor real**, com imóveis reais, publicado online.
A arquitetura já é multi-tenant (SaaS), mas sem funcionalidades além do necessário para validar.

## 2. Stack e hospedagem

- Next.js (App Router, Server Actions, Route Handlers) + React + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth v5) com credenciais (e-mail + senha, hash bcrypt/argon2), sessão JWT
- Zod para validação de inputs (compartilhado entre client e server)
- Storage de fotos: Supabase Storage em produção; adaptador de storage local (disco em `public/uploads`) em desenvolvimento, atrás de uma interface `StorageProvider`
- PWA: manifest + service worker simples (instalável; sem modo offline completo)
- QR Code: biblioteca `qrcode` (geração de PNG no servidor)
- Testes: Vitest (unidade + integração com Postgres de teste), Playwright (E2E)
- Local: PostgreSQL 17 instalado nativamente no Windows (Docker indisponível nesta máquina)
- Produção: Vercel (app) + Supabase (Postgres + Storage)

## 3. Escopo do MVP

### Entra

1. Cadastro/login do corretor; perfil (nome, foto, CRECI, WhatsApp, e-mail, imobiliária, bio, Instagram).
2. Imóveis: CRUD com campos principais, upload/reordenação/remoção de fotos, status
   (`DRAFT`, `PUBLISHED`, `PAUSED`, `SOLD`, `RENTED`), slug amigável único.
3. Página pública `/imovel/[slug]`: galeria, preço, localização (bairro/cidade), características,
   descrição, diferenciais, financiamento, card do corretor, CTA "Tenho interesse".
   SEO: title/description dinâmicos, Open Graph com a foto de capa, JSON-LD básico.
   Só imóveis `PUBLISHED` são exibidos; `SOLD`/`RENTED` mostram aviso "indisponível" sem CTA;
   `DRAFT`/`PAUSED` retornam 404.
4. Questionário **padrão por conta**: criado automaticamente (≈5 perguntas com pesos) no cadastro.
   Editor: criar, editar, remover, reordenar perguntas; obrigatória; opções com peso.
   Tipos: `TEXT`, `NUMBER`, `SINGLE_CHOICE`, `MULTI_CHOICE`, `YES_NO`.
5. Fluxo do visitante (mobile-first, uma pergunta por tela, barra de progresso):
   1. Nome + WhatsApp + checkbox de consentimento (link para `/privacidade`) → **lead criado como incompleto**.
   2. Perguntas do questionário (respostas salvas ao final; lead marcado como completo).
   3. Tela final: resumo + botão "Continuar no WhatsApp".
6. Pontuação e classificação (seção 6).
7. Link WhatsApp `https://wa.me/<numero>?text=<mensagem>` com resumo das respostas.
8. Origem: captura de `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, referrer;
   normalização em canal (`INSTAGRAM`, `FACEBOOK`, `GOOGLE`, `QR_CODE`, `DIRECT`, `OTHER`).
   QR Code aponta para `/imovel/[slug]?utm_source=qrcode`.
   Os parâmetros são guardados na sessão do navegador ao entrar na página e enviados na criação do lead.
9. Leads: lista com busca (nome/telefone) e filtros (imóvel, classificação, status, origem, completo/incompleto, período);
   detalhe com respostas, pontuação, origem, status, observações, histórico de status, botão abrir WhatsApp, excluir.
   Status: `NEW`, `CONTACTED`, `NEGOTIATING`, `VISIT_SCHEDULED`, `PROPOSAL`, `CONVERTED`, `LOST`.
10. Dashboard: totais (imóveis, publicados, visualizações, leads, alta intenção, leads novos não atendidos,
    visitas desejadas, cliques WhatsApp), taxas (visita→lead, conclusão do questionário, lead→WhatsApp),
    leads por origem, últimos leads de alta intenção. Filtro de período (7/30/90 dias).
11. QR Code por imóvel, visualizar e baixar PNG.
12. PWA instalável; layout responsivo (320px+, 768px+, 1366px+).
13. Seed (corretora Ana Martins, 3 imóveis, questionário, leads fictícios), testes, README e docs.
14. Página `/privacidade` com texto-modelo marcado como **pendente de revisão jurídica**.

### Fica para depois

Perguntas condicionais (lógica — o schema já suporta), questionário por imóvel (schema já suporta),
personalização de cores/logo, gráficos elaborados, equipes/imobiliárias/múltiplos usuários por conta,
API oficial do WhatsApp, vídeo, mapa, recuperação de senha por e-mail, login Google.

## 4. Arquitetura

Monolito Next.js modular. Camadas:

```
src/
  app/                    # rotas (UI fina: chama server actions/serviços)
    (auth)/login, cadastro
    (painel)/painel/...   # área autenticada
    imovel/[slug]/        # página pública + questionário
    api/                  # route handlers (eventos, lead público, qrcode, upload)
    privacidade/
  components/             # UI reutilizável (ui/, painel/, publico/)
  server/
    db.ts                 # Prisma client
    auth.ts               # Auth.js config + helper requireSession()
    tenant.ts             # helpers que sempre filtram por accountId
    services/             # regras de negócio com acesso a dados
      properties.ts, questionnaires.ts, leads.ts, analytics.ts, profile.ts
    storage/              # StorageProvider (local | supabase)
  domain/                 # lógica pura, sem I/O (100% testável)
    scoring.ts            # cálculo de pontuação e classificação
    whatsapp.ts           # montagem do link/mensagem (interface MessageChannel p/ futura API)
    attribution.ts        # normalização de UTM/referrer → canal
    slug.ts
    questionnaire.ts      # visibilidade de perguntas (hook para condicionais)
  lib/validation/         # schemas Zod
prisma/schema.prisma, seed.ts
tests/unit, tests/integration, e2e/
```

Regras:
- Componentes não acessam o Prisma diretamente; usam `server/services`.
- Todo serviço do painel recebe `accountId` vindo da sessão (nunca do cliente) e filtra por ele.
  Acesso a recurso de outra conta retorna "não encontrado" (não vaza existência).
- Endpoints públicos (criação de lead, eventos) só aceitam IDs de imóveis publicados e derivam
  `accountId` do imóvel no servidor.
- Rotas `/painel/*` protegidas por middleware + verificação no servidor.

## 5. Modelo de dados

- **Account**: id, name, createdAt
- **User**: id, accountId, name, email (único), passwordHash, role (`OWNER`), photoUrl, creci, phone,
  whatsapp, bio, agencyName, instagramUrl, createdAt
- **Property**: id, accountId, slug (único), title, type (`HOUSE`, `APARTMENT`, `TOWNHOUSE`, `LAND`, `COMMERCIAL`, `OTHER`),
  purpose (`SALE`, `RENT`), price, condoFee?, iptu?, city, neighborhood, address?, showAddress (bool),
  bedrooms?, suites?, bathrooms?, parkingSpots?, builtArea?, landArea?, description, highlights (string[]),
  financingInfo?, status, publishedAt?, createdAt, updatedAt
- **PropertyImage**: id, propertyId, url, storageKey, position
- **Questionnaire**: id, accountId, propertyId? (nulo = padrão da conta), name, isDefault
- **Question**: id, questionnaireId, label, type, required, position, showIf (Json?, reservado para condicionais)
- **QuestionOption**: id, questionId, label, weight (int), position
- **Lead**: id, accountId, propertyId, name, phone, email?, consentAt, consentText,
  score, maxScore, classification (`HIGH`, `MEDIUM`, `LOW`, `UNRATED`), status, isComplete,
  wantsVisit (bool, derivado de pergunta marcada), channel, utmSource?, utmMedium?, utmCampaign?,
  utmContent?, utmTerm?, referrer?, landingUrl?, visitorId?, whatsappClickedAt?, createdAt, updatedAt
- **LeadAnswer**: id, leadId, questionId? (nulo se a pergunta for apagada), questionLabel (snapshot),
  value (Json: texto/número/ids de opções + labels snapshot), points
- **LeadNote**: id, leadId, authorId, body, createdAt
- **LeadStatusHistory**: id, leadId, fromStatus?, toStatus, changedById?, createdAt
- **AnalyticsEvent**: id, accountId, propertyId, type (`PAGE_VIEW`, `QUESTIONNAIRE_START`,
  `QUESTIONNAIRE_COMPLETE`, `WHATSAPP_CLICK`), visitorId, channel, utmSource?, utmCampaign?, createdAt

`CampaignSource` da especificação original foi incorporado como campos no Lead/AnalyticsEvent
(sem tabela própria no MVP).

Pergunta "quer agendar visita": o seed/questionário padrão marca a pergunta com um flag `isVisitIntent`
(campo booleano em Question) para alimentar `wantsVisit` e a métrica "visitas desejadas".

Privacidade: não armazenar IP. `visitorId` é um UUID aleatório em cookie de primeira parte.
Exclusão de lead remove respostas, notas e histórico em cascata.

## 6. Pontuação

- Opção de escolha: pontos = peso da opção (múltipla escolha: soma dos pesos marcados).
- `YES_NO`: tratado como escolha com duas opções ("Sim"/"Não") e pesos editáveis.
- `TEXT`/`NUMBER`: 0 pontos no MVP.
- `maxScore` = soma do máximo possível de cada pergunta pontuável.
- Percentual = score / maxScore. `>= 60%` → HIGH, `>= 30%` → MEDIUM, senão LOW.
  Sem perguntas pontuáveis ou lead incompleto → `UNRATED`.
- UI sempre exibe: "Indicação baseada nas respostas — não é garantia de intenção."

Questionário padrão (seed e novas contas):
1. Pretende comprar ou alugar? (Comprar / Alugar / Ainda não sei)
2. Quando pretende fechar negócio? (Imediatamente 30 / Até 3 meses 25 / 3–6 meses 15 / Só pesquisando 5)
3. Como pretende pagar? (À vista 25 / Financiamento 15 / Consórcio 10 / Ainda não sei 0)
4. Possui valor de entrada? (Sim 20 / Não 0)
5. Gostaria de agendar uma visita? (Sim 25 / Não 0) — `isVisitIntent`

## 7. WhatsApp

`domain/whatsapp.ts` gera a mensagem:

```
Olá, sou {nome}.
Tenho interesse no imóvel: {título}
{link da página}

Minhas informações:
{pergunta}: {resposta}
...
```

Número normalizado para E.164 (padrão BR: prefixo 55). Clique registra `WHATSAPP_CLICK` e
`whatsappClickedAt`. Interface `MessageChannel` permite futura integração com a API do WhatsApp Business.

## 8. Tratamento de erros e UX

- Validação Zod com mensagens em português, exibidas por campo.
- Estados de loading (botões com pending), estados vazios com CTA (ex.: "Cadastre seu primeiro imóvel").
- Formulário público: botões grandes (≥ 48px), teclado numérico para telefone, máscara BR.
- Falha na criação do lead: mensagem clara e botão de tentar novamente; nunca enviar ao WhatsApp sem lead salvo.
- Rate limit simples em memória para o endpoint público de lead (proteção básica contra spam) — documentar
  que produção deve usar armazenamento compartilhado.

## 9. Testes

- Unidade (Vitest): scoring, whatsapp, attribution, slug, visibilidade de perguntas.
- Integração (Vitest + Postgres de teste): criação e publicação de imóvel, questionário padrão na criação da conta,
  submissão pública gera lead pontuado, **isolamento entre contas** (A não lê/edita/exclui dados de B),
  imóvel não publicado não aceita lead, tracking de UTM salvo.
- E2E (Playwright): cadastro → imóvel → publicar → visitante com UTM responde → WhatsApp link → lead no painel.

## 10. Documentação

README (visão geral, rodar local, variáveis de ambiente, migrations, seed, testes, deploy Vercel + Supabase)
e `docs/` com arquitetura e pendências jurídicas (LGPD: política de privacidade, base legal, retenção,
DPO/encarregado, termo de uso — **a revisar por advogado**).

## 11. Critério de pronto

Aplicação roda localmente com um comando de setup documentado; o fluxo de ponta a ponta funciona com
persistência real; testes passam; entrega inclui lista de implementado / parcial / pendente / próximos passos.
