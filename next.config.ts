import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // fotos chegam redimensionadas no navegador (~300–600 KB), mas o serviço aceita até 5 MB por imagem
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
