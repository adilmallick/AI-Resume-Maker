interface GenerateResumePanelProps {
  url: string;
  genStatus: 'idle' | 'loading' | 'success' | 'error';
  genError: string | null;
  onUrlChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function GenerateResumePanel({ url, genStatus, genError, onUrlChange, onSubmit }: GenerateResumePanelProps) {
  return (
    <div className="glass-panel" style={{ marginBottom: '30px', background: 'var(--bg-surface)', border: '1px solid var(--accent-glow)', padding: 0 }}>
      <div style={{ padding: '30px', background: 'rgba(108, 93, 211, 0.05)', borderColor: 'rgba(108, 93, 211, 0.2)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>AI Resume Generator ⚡</h2>
        <p className="title-sub" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
          Instantly compile your Vault experiences matching a target job description.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <textarea
            className="form-input"
            style={{ flex: 1, minHeight: '60px', maxHeight: '300px', resize: 'vertical' }}
            placeholder="Paste Target Job URL (e.g., https://...) OR raw Job Description text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            required
            disabled={genStatus === 'loading'}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={genStatus === 'loading' || !url.trim()}
            style={{ minWidth: '160px' }}
          >
            {genStatus === 'loading' ? 'Analyzing Vault...' : 'Analyze & Draft'}
          </button>
        </form>
        {genStatus === 'error' && genError && (
          <div className="alert alert-error" style={{ marginTop: '15px', marginBottom: 0, padding: '10px 15px' }}>{genError}</div>
        )}
        {genStatus === 'success' && (
          <div className="alert alert-success" style={{ marginTop: '15px', marginBottom: 0, padding: '10px 15px' }}>
            Success! Your ATS-Optimized PDF has been downloaded perfectly!
          </div>
        )}
      </div>
    </div>
  );
}
