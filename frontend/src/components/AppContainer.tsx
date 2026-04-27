"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function AppContainer({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // If user is not logged in, show a simple top nav and standard container
  if (!user) {
    return (
      <div className="app-layout" style={{ flexDirection: "column" }}>
        <nav className="navbar" style={{ position: "static", padding: "0 24px" }}>
          <div className="container navbar-inner">
            <Link href="/" className="navbar-logo">
              Resume<span className="text-gradient">Vault</span>
            </Link>
            <div className="navbar-links">
              <Link href="/login" className="nav-item">Login</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: "8px 20px" }}>Sign Up</Link>
            </div>
          </div>
        </nav>
        <main className="container" style={{ flex: 1, padding: "40px 24px" }}>
          {children}
        </main>
      </div>
    );
  }

  // If user is logged in, show the sidebar layout
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/" className="navbar-logo">
            Resume<span className="text-gradient">Vault</span>
          </Link>
        </div>
        
        <nav className="sidebar-nav">
          <Link href="/dashboard" className={`sidebar-item ${pathname === '/dashboard' ? 'active' : ''}`}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/vault" className={`sidebar-item ${pathname?.startsWith('/vault') ? 'active' : ''}`}>
            <span>🗄️</span> Career Vault
          </Link>
          <Link href="/studio" className={`sidebar-item ${pathname?.startsWith('/studio') ? 'active' : ''}`}>
            <span>✨</span> Resume Studio
          </Link>
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <button onClick={logout} className="sidebar-item" style={{ width: "100%", color: "var(--danger)", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span style={{ fontWeight: 600 }}>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
