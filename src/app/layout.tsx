import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { AppFrame } from "@/components/auth/AppFrame";
import { ApiBridge } from "@/components/app/ApiBridge";
import { AndroidBridge } from "@/components/app/AndroidBridge";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Otto's World",
  description: "Trader, vault, books, journal, and life",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=document.cookie.match(/(?:^|; )trader-otto-theme=([^;]*)/);document.documentElement.dataset.theme=m&&m[1]==='dark'?'dark':'warm-paper'}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <ApiBridge>
            <AndroidBridge>
              <AuthProvider>
                <AppFrame>{children}</AppFrame>
              </AuthProvider>
            </AndroidBridge>
          </ApiBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
