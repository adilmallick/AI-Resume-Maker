import React from 'react';

interface VaultHeaderProps {
  resumeUploadStatus: 'idle' | 'loading' | 'error';
  resumeUploadError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function VaultHeader({ resumeUploadStatus, resumeUploadError, fileInputRef, onFileChange }: VaultHeaderProps) {
  return (
    <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
      <div>
        <h1 className="title-main" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Career Vault</h1>
        <p className="title-sub">Manage the master copy of your professional journey here.</p>
      </div>
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={resumeUploadStatus === 'loading'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {resumeUploadStatus === 'loading' ? '⏳ Analyzing Resume...' : '📄 Upload Resume'}
        </button>
        {resumeUploadStatus === 'error' && resumeUploadError && (
          <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', textAlign: 'right' }}>{resumeUploadError}</p>
        )}
      </div>
    </div>
  );
}
