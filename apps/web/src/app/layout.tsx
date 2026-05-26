import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DevModeProvider } from "@/components/dev-mode";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Targeting — Agente de prospecção em plataformas autenticadas",
  description:
    "Conecte qualquer sistema web autenticado. Extraia contatos, agendamentos e listas de leads por prompt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <DevModeProvider>{children}</DevModeProvider>
      </body>
    </html>
  );
}
