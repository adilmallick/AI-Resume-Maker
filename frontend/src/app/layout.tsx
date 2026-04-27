import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppContainer from "@/components/AppContainer";

export const metadata: Metadata = {
  title: "ResumeVault | AI Career AI",
  description: "AI-powered resume generator using your professional vault. Bypass ATS systems.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AppContainer>
              {children}
            </AppContainer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
