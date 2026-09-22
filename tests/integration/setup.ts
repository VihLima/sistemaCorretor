import { afterAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.$disconnect();
});
