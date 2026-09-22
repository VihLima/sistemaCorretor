import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Usamos um build de produção (`next build && next start`) em vez de `next dev` porque o Next 16
// recusa um segundo `next dev` no mesmo diretório do projeto, e o ambiente de desenvolvimento local
// já costuma ter um rodando na porta 3000. `NEXT_DIST_DIR` (ver next.config.ts) manda a saída do
// build para `.next-e2e`, isolada do `.next` do `next dev` — ver README ("Testes") e docs/deploy.md.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // NEXT_DIST_DIR e as demais variáveis vêm de `env` abaixo (Playwright injeta no processo do shell).
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      APP_URL: `http://localhost:${PORT}`,
      STORAGE_DRIVER: "local",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
