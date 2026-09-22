import { db } from "@/server/db";

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "AnalyticsEvent","LeadStatusHistory","LeadNote","LeadAnswer","Lead","QuestionOption","Question","Questionnaire","PropertyImage","Property","Session","User","Account" CASCADE`,
  );
}
