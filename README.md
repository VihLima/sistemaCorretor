# Corretor Leads

Ferramenta para corretores de imóveis publicarem páginas de imóveis com um funil de
qualificação: o visitante responde um questionário curto antes de ser encaminhado para o
WhatsApp do corretor, já com uma classificação de intenção (alta/média/baixa) e o resumo das
respostas. O corretor gerencia os contatos recebidos ("leads") em um painel (`/painel`).

## Funcionalidades

- Cadastro e login do corretor (sessão própria, sem depender de provedor externo).
- Perfil do corretor (nome, WhatsApp, CRECI, imobiliária, Instagram, bio, foto) exibido na página de cada imóvel.
- Cadastro de imóveis com fotos (até 20, otimizadas no navegador antes do envio), status (rascunho, publicado, pausado, vendido, alugado).
- Página pública do imóvel (SEO, Open Graph, JSON-LD) com link direto, variantes por canal (Instagram/Facebook/Google) e QR Code.
- Fluxo de interesse do visitante: contato (nome, WhatsApp, e-mail opcional, consentimento) → uma pergunta por tela → encaminhamento pronto para o WhatsApp do corretor.
- Questionário de qualificação editável, com pontuação por resposta e classificação automática (alta/média/baixa intenção).
- Painel de contatos ("leads"): filtros, classificação, canal de origem, status de atendimento, histórico, observações e exclusão (LGPD).
- Consentimento registrado com o texto exato aceito e o horário (sem guardar IP do visitante).
- PWA instalável e política de privacidade (modelo) publicada em `/privacidade`.

## Requisitos

- Node.js 20 ou superior.
- PostgreSQL 17.
  - **Instalação nativa** (recomendado para desenvolvimento no Windows):
    ```bash
    winget install PostgreSQL.PostgreSQL.17
    ```
    Depois, crie o role e os dois bancos (`corretor` para desenvolvimento, `corretor_test` para os
    testes de integração e end-to-end) com o `psql`:
    ```sql
    CREATE ROLE corretor WITH LOGIN PASSWORD 'corretor';
    ALTER ROLE corretor CREATEDB;
    CREATE DATABASE corretor OWNER corretor;
    CREATE DATABASE corretor_test OWNER corretor;
    ```
  - **Docker (opcional)**, se preferir não instalar o PostgreSQL na máquina:
    ```bash
    docker run --name corretor-postgres -e POSTGRES_USER=corretor -e POSTGRES_PASSWORD=corretor \
      -e POSTGRES_DB=corretor -p 5432:5432 -d postgres:17
    docker exec -it corretor-postgres psql -U corretor -c "CREATE DATABASE corretor_test OWNER corretor;"
    ```

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run db:migrate   # aplica as migrações no banco de desenvolvimento (DATABASE_URL)
npm run db:seed       # cria uma conta e imóveis de exemplo
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para entrar com a conta de exemplo (dados
do seed), use:

- **E-mail:** `ana@exemplo.com`
- **Senha:** `demo12345`

Para criar sua própria conta, acesse [http://localhost:3000/cadastro](http://localhost:3000/cadastro).

### Variáveis de ambiente

Veja `.env.example` — todas as variáveis lidas pela aplicação estão lá, com valores de exemplo.
Em resumo:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL de desenvolvimento. |
| `TEST_DATABASE_URL` | String de conexão do PostgreSQL usado pelos testes de integração e e2e (`corretor_test`). |
| `APP_URL` | URL pública da aplicação (usada para montar links absolutos, Open Graph etc.). |
| `STORAGE_DRIVER` | `local` (arquivos em disco, padrão em dev) ou `supabase` (produção — ver `docs/deploy.md`). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | Só necessárias com `STORAGE_DRIVER=supabase`. |

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento (`next dev`). |
| `npm run build` | Gera o cliente Prisma e cria o build de produção. |
| `npm run start` | Roda o build de produção (`next start`). |
| `npm run lint` | ESLint. |
| `npm test` / `npm run test:unit` | Testes unitários (Vitest, sem banco). |
| `npm run test:integration` | Testes de integração (Vitest — precisa do PostgreSQL local, usa `TEST_DATABASE_URL`). |
| `npm run test:e2e` | Teste end-to-end (Playwright — ver seção "Testes" abaixo). |
| `npm run db:migrate` | Aplica migrações em desenvolvimento (`prisma migrate dev`). |
| `npm run db:deploy` | Aplica migrações em produção/CI (`prisma migrate deploy`). |
| `npm run db:seed` | Popula o banco com uma conta e imóveis de exemplo. |
| `npm run db:reset` | Reseta o banco de desenvolvimento (`prisma migrate reset --force`). |

## Testes

```bash
npm run test:unit         # regras de domínio (scoring, questionário, formatação...), sem banco
npm run test:integration  # services do painel/público contra um PostgreSQL real (TEST_DATABASE_URL)
npm run test:e2e          # fluxo completo no navegador (Playwright)
```

O teste e2e (`e2e/fluxo-completo.spec.ts`) cobre o fluxo inteiro: cadastro do corretor → perfil →
cadastro e publicação de um imóvel com foto → visita de um "visitante" simulando um celular vindo
do Instagram → questionário → encaminhamento ao WhatsApp → o corretor vendo o contato classificado
no painel.

**Sobre o servidor usado pelo e2e:** o Next 16 recusa um segundo `next dev` no mesmo diretório do
projeto, e é comum já ter um `npm run dev` rodando localmente na porta 3000. Por isso
`playwright.config.ts` não usa `next dev` — ele roda um **build de produção separado**
(`next build && next start --port 3100`), com a variável `NEXT_DIST_DIR=.next-e2e`
(lida em `next.config.ts`) mandando a saída do build para `.next-e2e/`, uma pasta isolada do
`.next/` do `next dev`. Isso evita qualquer conflito entre os dois servidores. `.next-e2e/` está
no `.gitignore`. O `globalSetup` (`e2e/global-setup.ts`) aplica as migrações e limpa o
`TEST_DATABASE_URL` antes de rodar o teste.

Antes da primeira vez, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

## Estrutura de pastas

```
src/
  app/            # rotas do Next.js (App Router): (auth), painel/, imovel/[slug]/, api/public/
  components/      # componentes React: auth/, painel/, publico/, ui/ (design system interno)
  domain/          # regras puras (sem I/O): pontuação, questionário, formatação, tipos
  server/          # camada de servidor: services/ (regras de negócio), auth/, storage/
  lib/             # utilitários compartilhados (validação, tracking do lado do cliente etc.)
prisma/            # schema, migrações e seed
e2e/               # teste end-to-end (Playwright)
docs/              # arquitetura, deploy e pendências de LGPD (veja abaixo)
```

## Documentação

- [`docs/arquitetura.md`](docs/arquitetura.md) — camadas, multi-tenancy, fluxo público, pontuação, modelo de dados e pontos de extensão.
- [`docs/deploy.md`](docs/deploy.md) — publicar em produção (Supabase + Vercel).
- [`docs/lgpd-pendencias.md`](docs/lgpd-pendencias.md) — medidas técnicas já implementadas e itens que precisam de revisão jurídica.
