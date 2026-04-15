import { ScrapeResponse, GenerateResumeResponse } from "@/types/job";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function scrapeJob(url: string): Promise<ScrapeResponse> {
  const response = await fetch(`${API_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json();
}

export async function generateResume(job_url: string, skills: string[]): Promise<GenerateResumeResponse> {
  const response = await fetch(`${API_BASE}/generate-resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_url, skills }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json();
}

export async function downloadResumePdf(
  bullets: string[],
  filename: string = "resume.pdf"
): Promise<void> {
  const response = await fetch(`${API_BASE}/generate-resume-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bullets }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PDF generation failed (${response.status}): ${error}`);
  }

  // The API returns application/pdf — read as Blob, then trigger a download
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
