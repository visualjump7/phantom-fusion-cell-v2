import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ActivePrincipalProvider } from "@/lib/use-active-principal";
import { getServerThemePreferences } from "@/lib/theme-preferences-server";
import { BottomNavBar } from "@/components/BottomNavBar";
import { MapModeProvider } from "@/lib/use-map-mode";
import { PreviewProvider } from "@/lib/preview-context";
import { PreviewBanner } from "@/components/admin/PreviewBanner";
import { PreviewRouteGuard } from "@/components/admin/PreviewRouteGuard";

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
      <body
        className={`${inter.className} pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0`}
      >
        <ThemeProvider initialTheme={theme} initialDensity={density}>
          <MapModeProvider>
            <ActivePrincipalProvider>
              <PreviewProvider>
                <PreviewBanner />
                <PreviewRouteGuard />
                {children}
                <BottomNavBar />
              </PreviewProvider>
            </ActivePrincipalProvider>
          </MapModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
