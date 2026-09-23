import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { AppFrame } from "@/components/auth/AppFrame";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=document.cookie.match(/(?:^|; )trader-otto-theme=([^;]*)/);document.documentElement.dataset.theme=m&&m[1]==='warm-paper'?'warm-paper':'dark'}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <AuthProvider>
            <AppFrame>{children}</AppFrame>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
