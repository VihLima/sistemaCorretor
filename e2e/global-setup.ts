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
