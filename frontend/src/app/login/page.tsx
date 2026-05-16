"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const { login } = useAuth();
  const searchParams = useSearchParams();

  // ── Admin impersonation: auto-login via token passed in URL ──────────────
  useEffect(() => {
    const impToken = searchParams.get('impersonate_token');
    const impUser  = searchParams.get('impersonate_user');
    if (!impToken || !impUser) return;

    setImpersonating(true);
    try {
      const userData = JSON.parse(decodeURIComponent(impUser));
      login(decodeURIComponent(impToken), userData);
    } catch (e) {
      setError('Impersonation failed — invalid token data.');
      setImpersonating(false);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email); // OAuth2 expects 'username'
      formData.append('password', password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid email or password');
      }

      const data = await res.json();
      
      const userRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();

      login(data.access_token, userData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Show a loading state while impersonation is in progress
  if (impersonating) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '12px' }}>⚡</p>
          <h1 className="title-main" style={{ fontSize: '1.6rem', marginBottom: '10px' }}>Signing in…</h1>
          <p className="title-sub">Admin impersonation in progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px' }}>
        <h1 className="title-main" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Welcome Back</h1>
        <p className="title-sub" style={{ marginBottom: '30px' }}>Sign in to access your Resume Vault.</p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} type="submit">
            Sign In
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Don't have an account? <a href="/signup" className="btn-link">Create one</a>
        </p>
      </div>
    </div>
  );
}
