import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TradesProvider } from "@/hooks/useTrades";
import { AppShell } from "@/components/nav/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AlpacaConnectionProvider } from "@/components/alpaca/AlpacaConnectionProvider";
import { WatchGroupsProvider } from "@/hooks/useWatchGroups";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGate } from "@/components/auth/AuthGate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Trader Otto",
  description: "Personal options trade journal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('trader-otto:theme');document.documentElement.dataset.theme=t==='warm-paper'?'warm-paper':'dark'}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate>
              <AlpacaConnectionProvider>
                <WatchGroupsProvider>
                  <TradesProvider>
                    <AppShell>{children}</AppShell>
                  </TradesProvider>
                </WatchGroupsProvider>
              </AlpacaConnectionProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
