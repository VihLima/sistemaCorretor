import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

/** Fonte de interface (painel, formulários, textos corridos). */
const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

/** Serifa editorial para títulos de destaque, preços e a marca. Classe utilitária: `font-display`. */
const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "Corretor Leads", template: "%s · Corretor Leads" },
  applicationName: "Corretor Leads",
  description: "Páginas de imóveis que qualificam o interessado antes de chegar ao seu WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: "#0b5c5e",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${ui.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
