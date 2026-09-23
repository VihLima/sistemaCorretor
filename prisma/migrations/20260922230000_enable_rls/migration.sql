-- No Supabase, o schema "public" é exposto pela Data API (PostgREST) aos papéis anon/authenticated.
-- A aplicação acessa o banco só pelo Prisma, como dona das tabelas (que ignora RLS), então ligar RLS
-- sem nenhuma policy bloqueia a Data API sem afetar a aplicação. Tabelas novas precisam do mesmo.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
