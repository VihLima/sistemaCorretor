import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corretor Leads",
    short_name: "Corretor",
    description: "Capte, qualifique e acompanhe contatos dos seus imóveis.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#ecece6",
    theme_color: "#0b5c5e",
    lang: "pt-BR",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
