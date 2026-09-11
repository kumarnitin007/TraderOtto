import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
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
