# LGPD — medidas técnicas e pendências

Este documento resume o que já foi implementado tecnicamente para reduzir riscos de privacidade
e o que ainda precisa de revisão jurídica antes de operar com dados reais de visitantes.

## Medidas técnicas já implementadas

- **Consentimento explícito**: o visitante marca uma caixa de consentimento antes de enviar o
  contato (não vem marcada por padrão). O sistema grava **o texto exato aceito** (não só um
  booleano) e o **horário** em que foi aceito (`Lead.consentText`, `Lead.consentAt`) — se o texto
  padrão mudar no futuro, contatos antigos continuam com prova do que foi de fato aceito.
- **Sem IP do visitante**: nenhum endereço IP é armazenado em nenhum momento do fluxo público
  (nem no `Lead`, nem no `AnalyticsEvent`, nem em log de aplicação). O identificador do visitante
  (`visitorId`) é um UUID aleatório gerado no navegador e guardado em `localStorage` (não em
  cookie), sem nenhum vínculo com IP ou dispositivo além do que o próprio navegador guarda.
  O IP é usado apenas em memória, como chave do limitador de tentativas (formulário público,
  login e cadastro), e nunca é gravado.
- **Logs da plataforma de hospedagem**: embora a aplicação não grave IPs, a infraestrutura
  (logs de requisição da Vercel, logs do Supabase/Postgres e do storage) pode registrar o IP e o
  user-agent de cada requisição por conta própria, com retenção definida pelo provedor. Isso deve
  constar da política de privacidade e do registro de operações de tratamento.
- **Isolamento por conta**: todo dado do painel é filtrado por `accountId` da sessão autenticada;
  tentar acessar um registro de outra conta retorna "não encontrado" (nunca confirma que o
  registro existe). Ver `docs/arquitetura.md` → "Multi-tenancy".
- **Senhas e sessões**: senhas nunca ficam em texto puro (hash com bcrypt); tokens de sessão são
  gerados aleatoriamente e guardados no banco apenas como hash (SHA-256) — um vazamento do banco
  não expõe os tokens em uso.
- **Exclusão de contato (direito ao apagamento)**: o corretor pode excluir permanentemente os
  dados de um contato pelo painel (`Card "Excluir contato"` na página do lead), removendo nome,
  telefone, e-mail, respostas e histórico associados.
- **Minimização de dados**: o formulário público pede só o necessário para o corretor retomar o
  contato (nome, WhatsApp, e-mail opcional) mais as respostas do questionário — nenhum dado
  sensível (CPF, endereço residencial do visitante, dados bancários) é coletado no fluxo público.

## Itens pendentes para revisão jurídica

Estes pontos exigem decisão de um advogado/DPO antes de operar em produção com usuários reais —
não são bloqueantes para o MVP técnico, mas são necessários para conformidade real:

- **Política de privacidade final**: `/privacidade` hoje tem um texto-modelo; precisa de revisão
  jurídica com os dados reais de operação (quem é o controlador, período de retenção real, etc.).
- **Papéis controlador/operador**: definir formalmente se a plataforma (dona do sistema) atua
  como operadora dos dados dos visitantes em nome de cada corretor (controlador), ou se há outro
  arranjo — isso muda obrigações contratuais e de resposta a incidentes.
- **Base legal do tratamento**: hoje o fluxo assume consentimento como base legal; avaliar se
  legítimo interesse se aplica a alguma parte (ex.: analytics agregado) e documentar formalmente.
- **Prazo de retenção e rotina de expurgo**: não há hoje um prazo automático de exclusão de leads
  antigos ou de contas inativas — decidir o prazo e implementar a rotina (ou processo manual).
- **Termos de uso para corretores**: contrato/termos que os corretores aceitam ao usar a
  plataforma (responsabilidades sobre os dados que coletam, uso aceitável do WhatsApp, etc.).
- **Contrato de tratamento de dados** entre a plataforma e os corretores (e, se aplicável, com o
  Supabase/Vercel como subcontratados).
- **Canal do encarregado (DPO)**: hoje não há um canal formal de contato do encarregado de dados
  publicado na política de privacidade.
- **Resposta a solicitações de titulares**: hoje a exclusão de um lead é uma ação manual do
  corretor no painel; não há um fluxo formal de atendimento a solicitações de titulares
  (confirmação de tratamento, portabilidade, correção) fora da exclusão direta.
- **Transferência internacional de dados**: Vercel e Supabase podem hospedar dados fora do
  Brasil dependendo da região escolhida — verificar a região dos serviços contratados e se isso
  exige cláusulas contratuais específicas ou aviso na política de privacidade.
- **Cookies / armazenamento local**: o sistema usa `localStorage` (visitorId) e `sessionStorage`
  (estado do questionário em andamento) no navegador do visitante — nenhum cookie de rastreamento
  de terceiros é usado hoje, mas isso deve ser confirmado e declarado explicitamente na política
  de privacidade e (se exigido) em um aviso de cookies.
