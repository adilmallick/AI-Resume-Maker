"use client";

import { JobInfo } from "@/types/job";
import ResumeGenerator from "./ResumeGenerator";

interface JobCardProps {
  job: JobInfo;
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="tag"
      style={{ "--tag-color": color } as React.CSSProperties}
    >
      {label}
    </span>
  );
}

export default function JobCard({ job }: JobCardProps) {
  return (
    <div className="job-card animate-in">
      {/* Header */}
      <div className="job-header">
        <div className="job-title-wrap">
          <h2 className="job-title">{job.title}</h2>
          <p className="job-company">{job.company}</p>
        </div>
        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="apply-btn"
          >
            Apply Now ↗
          </a>
        )}
      </div>

      {/* Tags Row */}
      <div className="tags-row">
        {job.location && <Tag label={`📍 ${job.location}`} color="#7c6af7" />}
        {job.job_type && <Tag label={`💼 ${job.job_type}`} color="#22c587" />}
        {job.salary && <Tag label={`💰 ${job.salary}`} color="#f59e0b" />}
        {job.experience && (
          <Tag label={`🧠 ${job.experience}`} color="#ec4899" />
        )}
        {job.posted_date && (
          <Tag label={`📅 ${job.posted_date}`} color="#64748b" />
        )}
      </div>

      {/* Description */}
      {job.description && (
        <div className="section">
          <h3 className="section-title">About the Role</h3>
          <p className="section-text">{job.description}</p>
        </div>
      )}

      {/* Requirements */}
      {job.requirements?.length > 0 && (
        <div className="section">
          <h3 className="section-title">Requirements</h3>
          <ul className="bullet-list">
            {job.requirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Benefits */}
      {job.benefits && job.benefits.length > 0 && (
        <div className="section">
          <h3 className="section-title">Benefits</h3>
          <ul className="bullet-list benefits">
            {job.benefits.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <ResumeGenerator jobUrl={job.source_url} />

      {/* Source */}
      <div className="source-row">
        <span>Source:</span>
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
        >
          {job.source_url}
        </a>
      </div>
    </div>
  );
}
