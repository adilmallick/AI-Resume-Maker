"use client";

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { token } = useAuth();

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)' }}>
      
      <div style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '40px' }}>
        <h1 className="title-main" style={{ fontSize: 'clamp(3rem, 5vw, 4.5rem)', marginBottom: '16px' }}>
          Next-Gen AI <span className="text-gradient">Resumes</span>
        </h1>
        <p className="title-sub" style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Stop tweaking templates. Input your vault once. Let our private AI pull exactly what matters and generate an ATS-bypassing PDF instantly.
        </p>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '32px', textAlign: 'center' }}>
          {!token ? (
              <div className="alert alert-error" style={{ justifyContent: 'center', gap: '8px' }}>
                  You must <Link href="/login" className="btn-link" style={{ fontWeight: 'bold' }}>Login</Link> or <Link href="/signup" className="btn-link" style={{ fontWeight: 'bold' }}>Sign Up</Link> to generate tailored resumes.
              </div>
          ) : (
              <div>
                  <h3 style={{ marginBottom: '16px' }}>Welcome back to your Vault</h3>
                  <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Manage your profile, experiences, and generate targeted PDFs directly from your Career Vault.</p>
                  <Link href="/vault" className="btn btn-primary" style={{ display: 'inline-block', width: '100%', fontSize: '1.2rem', padding: '16px' }}>
                      Go to Career Vault ⚡
                  </Link>
              </div>
          )}
      </div>

    </div>
  );
}
