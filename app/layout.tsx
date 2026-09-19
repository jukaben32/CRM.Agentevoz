import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VoiceOps — Recepcionista telefónico con IA + CRM",
  description: "Centralita inteligente y CRM para talleres mecánicos y centros de servicio del automóvil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="font-sans antialiased h-full flex flex-col">{children}</body>
    </html>
  );
}
