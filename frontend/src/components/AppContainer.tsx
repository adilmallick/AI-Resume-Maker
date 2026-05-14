"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function AppContainer({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="app-layout" style={{ flexDirection: "column" }}>
      <nav className="navbar" style={{ position: "static", padding: "0 24px" }}>
        <div className="container navbar-inner">
          <Link href="/" className="navbar-logo">
            Resume<span className="text-gradient">Vault</span>
          </Link>
          <div className="navbar-links">
            {user ? (
              <>
                <ThemeToggle />
                <button onClick={logout} className="btn btn-secondary" style={{ padding: "8px 20px" }}>Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-item">Login</Link>
                <Link href="/signup" className="btn btn-primary" style={{ padding: "8px 20px" }}>Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main style={{ flex: 1, width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
