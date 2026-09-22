import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não configurada (veja .env.example).");
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL não pode ser igual a DATABASE_URL: o setup E2E apaga todas as tabelas.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(
    `TRUNCATE TABLE "AnalyticsEvent","LeadStatusHistory","LeadNote","LeadAnswer","Lead","QuestionOption","Question","Questionnaire","PropertyImage","Property","Session","User","Account" CASCADE`,
  );
  await client.end();
}
