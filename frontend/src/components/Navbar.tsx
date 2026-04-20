"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="navbar-logo">
          Resume<span className="text-gradient">Vault</span>
        </Link>
        <div className="navbar-links">
          {user ? (
            <>
              <Link href="/dashboard" className="nav-item">
                Dashboard
              </Link>
              <button onClick={logout} className="btn-link nav-item" style={{ color: "var(--danger)" }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-item">
                Login
              </Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: "8px 20px", fontSize: "0.9rem" }}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
