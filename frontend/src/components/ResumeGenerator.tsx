"use client";

import { useState } from "react";
import { generateResume, downloadResumePdf } from "@/lib/api";

interface ResumeGeneratorProps {
  jobUrl: string;
}

export default function ResumeGenerator({ jobUrl }: ResumeGeneratorProps) {
  const [skillsStr, setSkillsStr] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [bullets, setBullets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!skillsStr.trim()) return;

    setStatus("loading");
    setBullets([]);
    setError(null);

    try {
      const skillsArray = skillsStr.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const result = await generateResume(jobUrl, skillsArray);
      
      if (result.experience && result.experience.length > 0) {
        setBullets(result.experience);
        setStatus("success");
      } else {
        setError("AI failed to generate valid experience bullet points.");
        setStatus("error");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error during generation.");
      setStatus("error");
    }
  }

  async function handleDownloadPdf() {
    setPdfStatus("loading");
    setPdfError(null);
    try {
      await downloadResumePdf(bullets);
      setPdfStatus("idle");
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : "Failed to generate PDF.");
      setPdfStatus("error");
    }
  }

  return (
    <div className="section resume-generator animate-in">
      <h3 className="section-title">✨ AI ATS-Optimized Resume Generator</h3>
      <p className="section-text" style={{ marginBottom: "1rem" }}>
        Enter your skills (comma separated) to generate ATS-friendly resume bullet points optimized specifically for this job description and your profile.
      </p>

      <form onSubmit={handleGenerate} className="skills-form">
        <label className="skills-label" htmlFor="skills-input">Candidate Skills</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="skills-input"
            type="text"
            className="skills-input"
            placeholder="e.g. React, Next.js, Node.js, PostgreSQL"
            value={skillsStr}
            onChange={(e) => setSkillsStr(e.target.value)}
            disabled={status === "loading"}
            required
          />
          <button
            type="submit"
            className={`generate-bullets-btn ${status === "loading" ? "loading" : ""}`}
            disabled={status === "loading" || !skillsStr.trim()}
          >
            {status === "loading" ? "Generating..." : "Generate ✨"}
          </button>
        </div>
      </form>

      {status === "error" && error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {status === "success" && bullets.length > 0 && (
        <div className="generated-bullets card-surface">
          <h4 className="generated-title">Generated Experience</h4>
          <ul className="bullet-list">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              id="download-pdf-btn"
              className={`generate-bullets-btn ${pdfStatus === "loading" ? "loading" : ""}`}
              onClick={handleDownloadPdf}
              disabled={pdfStatus === "loading"}
            >
              {pdfStatus === "loading" ? "Compiling PDF…" : "⬇️ Download Resume PDF"}
            </button>

            {pdfStatus === "error" && pdfError && (
              <div className="error-message" style={{ marginTop: "0.75rem" }}>
                ⚠️ {pdfError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
