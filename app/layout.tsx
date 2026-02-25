import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fusion Cell",
  description: "Executive financial command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <AIAssistant />
        </ThemeProvider>
      </body>
    </html>
  );
}
