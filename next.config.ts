import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permite rodar um build de produção separado (ex.: servidor do Playwright) sem
  // colidir com o `.next` do `next dev` já em uso — ver docs/deploy.md e README (testes)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // fotos chegam redimensionadas no navegador (~300–600 KB), mas o serviço aceita até 5 MB por imagem
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
