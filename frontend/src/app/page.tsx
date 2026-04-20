"use client";

import { useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { token, user } = useAuth();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    if (!token) {
        setError("You must be logged in to generate a resume.");
        return;
    }

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/generate-resume", {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ job_url: url.trim() })
      });

      if (!res.ok) {
          throw new Error("Failed to generate resume.");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Resume_${user?.id?.slice(0,5)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setStatus("success");
    } catch (err: any) {
      setError(err.message || "Failed to generate resume.");
      setStatus("error");
    }
  }

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

      <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '32px' }}>
        <form onSubmit={handleGenerate}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '1rem', color: 'white' }}>Target Job Listing URL</label>
            <input
              type="url"
              className="form-input"
              style={{ fontSize: '1.1rem', padding: '16px 20px' }}
              placeholder="https://jobs.example.com/job-listing"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={status === "loading" || !token}
            />
          </div>
          
          {!token ? (
              <div className="alert alert-error" style={{ justifyContent: 'center', gap: '8px' }}>
                  You must <Link href="/login" className="btn-link" style={{ fontWeight: 'bold' }}>Login</Link> or <Link href="/signup" className="btn-link" style={{ fontWeight: 'bold' }}>Sign Up</Link> to generate tailored resumes.
              </div>
          ) : (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '1.1rem', padding: '16px' }}
                disabled={status === "loading" || !url.trim()}
              >
              {status === "loading" ? "Analyzing Vault & Synthesizing PDF..." : "Generate Masterpiece ⚡"}
              </button>
          )}
        </form>

        {status === "error" && error && (
          <div className="alert alert-error" style={{ marginTop: '20px', marginBottom: 0 }}>
            {error}
          </div>
        )}

        {status === "success" && (
          <div className="alert alert-success" style={{ marginTop: '20px', marginBottom: 0 }}>
            <strong>Success!</strong> Your PDF has been compiled and downloaded securely!
          </div>
        )}
      </div>

    </div>
  );
}
