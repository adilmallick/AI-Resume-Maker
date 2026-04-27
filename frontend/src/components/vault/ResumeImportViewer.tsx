import ExtractedDataViewer from '@/components/ExtractedDataViewer';

interface ResumeImportViewerProps {
  extractedResumeData: any;
  resumeUploadStatus: 'idle' | 'loading' | 'error';
  resumeUploadError: string | null;
  resumeMergeStrategy: 'append' | 'overwrite';
  onStrategyChange: (s: 'append' | 'overwrite') => void;
  onSave: () => void;
  onClose: () => void;
}

export default function ResumeImportViewer({
  extractedResumeData, resumeUploadStatus, resumeUploadError,
  resumeMergeStrategy, onStrategyChange, onSave, onClose
}: ResumeImportViewerProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Review Extracted Data
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose how to save this data to your Vault.</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ padding: '6px 10px', width: 'auto', marginBottom: 0 }}
            value={resumeMergeStrategy}
            onChange={e => onStrategyChange(e.target.value as 'append' | 'overwrite')}
            disabled={resumeUploadStatus === 'loading'}
          >
            <option value="append">Append to existing Vault</option>
            <option value="overwrite">Overwrite existing Vault</option>
          </select>
          <button className="btn btn-secondary" onClick={onClose} disabled={resumeUploadStatus === 'loading'}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={resumeUploadStatus === 'loading'}>
            {resumeUploadStatus === 'loading' ? 'Saving...' : 'Save to Vault'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }} className="custom-scrollbar">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {resumeUploadStatus === 'error' && resumeUploadError && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>{resumeUploadError}</div>
          )}
          <ExtractedDataViewer data={extractedResumeData} />
        </div>
      </div>
    </div>
  );
}
