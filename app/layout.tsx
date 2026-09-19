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
    <html lang="es" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/*
          Script que se ejecuta ANTES de pintar la página para aplicar el tema
          guardado (localStorage) al instante. Sin esto, la página se vería
          primero en claro y luego "parpadearía" a oscuro tras cargar React.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("voiceops-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
