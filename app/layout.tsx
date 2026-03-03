import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getServerThemePreferences } from "@/lib/theme-preferences-server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fusion Cell",
  description: "Executive financial command center",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, density } = await getServerThemePreferences();
  const shouldLoadComfortFont = density === "comfort";

  return (
    <html lang="en" data-theme={theme} data-density={density} suppressHydrationWarning>
      <head>
        {shouldLoadComfortFont && (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&family=Atkinson+Hyperlegible+Mono:wght@400;500;600;700&display=swap"
          />
        )}
      </head>
      <body className={inter.className}>
        <ThemeProvider initialTheme={theme} initialDensity={density}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
