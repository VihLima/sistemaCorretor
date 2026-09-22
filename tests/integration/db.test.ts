import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetDb } from "./helpers";

describe("banco de teste", () => {
  it("grava e limpa registros", async () => {
    await db.account.create({ data: { name: "Teste" } });
    expect(await db.account.count()).toBe(1);
    await resetDb();
    expect(await db.account.count()).toBe(0);
  });
});
