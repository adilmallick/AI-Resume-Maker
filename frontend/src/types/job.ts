export interface JobInfo {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  job_type: string | null;
  experience: string | null;
  description: string;
  requirements: string[];
  benefits: string[] | null;
  apply_url: string | null;
  posted_date: string | null;
  source_url: string;
}

export interface ScrapeResponse {
  success: boolean;
  data: JobInfo | null;
  error: string | null;
}

export interface GenerateResumeResponse {
  experience: string[];
}
