/** Contexto de autorização: sempre vem da sessão, nunca do cliente. */
export type Ctx = { accountId: string; userId: string };
