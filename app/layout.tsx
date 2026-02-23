import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AIAssistant } from "@/components/ai/AIAssistant";

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
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <AIAssistant />
      </body>
    </html>
  );
}
