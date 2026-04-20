import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import Navbar from "@/components/Navbar";

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
        <AuthProvider>
          <Navbar />
          <div className="page-wrapper">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
