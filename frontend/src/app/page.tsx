"use client";

import { useState } from "react";
import { scrapeJob } from "@/lib/api";
import { JobInfo } from "@/types/job";
import JobCard from "@/components/JobCard";

type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [job, setJob] = useState<JobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus("loading");
    setJob(null);
    setError(null);

    try {
      const result = await scrapeJob(url.trim());
      if (result.success && result.data) {
        setJob(result.data);
        setStatus("success");
      } else {
        setError(result.error || "Failed to extract job information.");
        setStatus("error");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  return (
    <main className="main">
      {/* Hero Header */}
      <header className="hero">
        <div className="hero-badge">AI-Powered</div>
        <h1 className="hero-title">
          Job Info <span className="gradient-text">Extractor</span>
        </h1>
        <p className="hero-sub">
          Paste any job listing URL and let{" "}
          <strong>deepseek-coder via Ollama</strong> extract structured
          information instantly.
        </p>
      </header>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="search-form glass-card">
        <div className="input-wrap">
          <span className="input-icon">🔗</span>
          <input
            type="url"
            className="url-input"
            placeholder="https://jobs.example.com/job-listing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={status === "loading"}
            id="url-input"
          />
        </div>
        <button
          type="submit"
          className={`extract-btn ${status === "loading" ? "loading" : ""}`}
          disabled={status === "loading" || !url.trim()}
          id="extract-btn"
        >
          {status === "loading" ? (
            <>
              <span className="spinner" /> Extracting…
            </>
          ) : (
            "Extract Job Info ⚡"
          )}
        </button>
      </form>

      {/* Status Info */}
      {status === "loading" && (
        <div className="status-pill">
          <span className="pulse-dot" />
          Running LangChain chain with llama3.1:8b via Ollama…
        </div>
      )}

      {/* Error State */}
      {status === "error" && error && (
        <div className="error-card glass-card" role="alert">
          <span className="error-icon">⚠️</span>
          <div>
            <strong>Extraction Failed</strong>
            <p>{error}</p>
            {(error.includes("bot protection") || error.includes("Akamai") || error.includes("blocked")) && (
              <p style={{ marginTop: "10px", fontSize: "0.85rem", color: "#a78bfa" }}>
                💡 <strong>Try these instead:</strong> Greenhouse, Lever, Workday, or Wellfound job URLs work great.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {status === "success" && job && <JobCard job={job} />}

      {/* Footer */}
      <footer className="footer">
        Built with LangChain + Ollama (llama3.1:8b) + Next.js
      </footer>
    </main>
  );
}
