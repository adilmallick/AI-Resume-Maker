import RichTextEditor from '@/components/RichTextEditor';
import ExtractedDataViewer from '@/components/ExtractedDataViewer';

interface ReviewWorkspaceProps {
  // Staged data
  stagedProfile: any;
  stagedExps: any[];
  stagedProjs: any[];
  stagedEducations: any[];
  stagedSkills: { category: string; skills: string[] }[];
  stagedSocials: any[];
  setStagedProfile: (v: any) => void;
  setStagedExps: (v: any[]) => void;
  setStagedProjs: (v: any[]) => void;
  setStagedEducations: (v: any[]) => void;
  setStagedSkills: (v: { category: string; skills: string[] }[]) => void;
  setStagedSocials: (v: any[]) => void;
  // PDF preview
  pdfPreviewUrl: string | null;
  isPreviewLoading: boolean;
  isDirty: boolean;
  genError: string | null;
  // Actions
  onRecompile: () => void;
  onDownload: () => void;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: '0.9rem' };
const sectionLabel: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'block' };
const subCard: React.CSSProperties = { background: 'rgba(108,93,211,0.06)', border: '1px solid rgba(108,93,211,0.25)', borderRadius: '10px', padding: '14px', marginBottom: '10px' };
const subCardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' };
const subCardLabel: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const removeBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.72rem', opacity: 0.8 };

export default function ReviewWorkspace({
  stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials,
  setStagedProfile, setStagedExps, setStagedProjs, setStagedEducations, setStagedSkills, setStagedSocials,
  pdfPreviewUrl, isPreviewLoading, isDirty, genError,
  onRecompile, onDownload, onClose,
}: ReviewWorkspaceProps) {

  const updateStagedExp = (idx: number, field: string, val: any) => {
    const updated = [...stagedExps]; updated[idx][field] = val; setStagedExps(updated);
  };
  const updateStagedExpBullet = (expIdx: number, bulletIdx: number, val: string) => {
    const updated = [...stagedExps]; updated[expIdx].stagedBullets[bulletIdx] = val; setStagedExps(updated);
  };
  const updateStagedProj = (idx: number, field: string, val: any) => {
    const updated = [...stagedProjs]; updated[idx][field] = val; setStagedProjs(updated);
  };
  const updateStagedProjBullet = (projIdx: number, bulletIdx: number, val: string) => {
    const updated = [...stagedProjs]; updated[projIdx].stagedBullets[bulletIdx] = val; setStagedProjs(updated);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>✨</span> Review PDF Outline
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Edits will NOT overwrite your master Vault.</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 15px', fontSize: '0.9rem' }}>Cancel</button>
          <button
            className="btn btn-secondary"
            onClick={onRecompile}
            disabled={isPreviewLoading}
            style={{ position: 'relative', padding: '6px 15px', fontSize: '0.9rem', background: 'rgba(108, 93, 211, 0.2)' }}
          >
            {isDirty && !isPreviewLoading && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.8)', display: 'block' }} />
            )}
            {isPreviewLoading ? 'Recompiling...' : 'Recompile'}
          </button>
          <button className="btn btn-primary" onClick={onDownload} disabled={!pdfPreviewUrl} style={{ padding: '6px 15px', fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)' }}>
            Download PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Editor Panel */}
        <div style={{ width: '55%', overflowY: 'auto', padding: '20px 24px' }} className="custom-scrollbar">

          {/* Header Block */}
          <div style={{ marginBottom: '20px' }}>
            <span style={sectionLabel}>Header Block</span>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>First Name</label><input className="form-input" style={inputStyle} placeholder="First Name" value={stagedProfile?.first_name || ''} onChange={e => setStagedProfile({ ...stagedProfile, first_name: e.target.value })} /></div>
                <div><label style={labelStyle}>Last Name</label><input className="form-input" style={inputStyle} placeholder="Last Name" value={stagedProfile?.last_name || ''} onChange={e => setStagedProfile({ ...stagedProfile, last_name: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><label style={labelStyle}>Location</label><input className="form-input" style={inputStyle} placeholder="e.g. Kolkata, India" value={stagedProfile?.location || ''} onChange={e => setStagedProfile({ ...stagedProfile, location: e.target.value })} /></div>
                <div><label style={labelStyle}>Email</label><input className="form-input" style={inputStyle} placeholder="email@example.com" value={stagedProfile?.email || ''} onChange={e => setStagedProfile({ ...stagedProfile, email: e.target.value })} /></div>
              </div>
              <div><label style={labelStyle}>Phone</label><input className="form-input" style={inputStyle} placeholder="+91 XXXXX XXXXX" value={stagedProfile?.phone || ''} onChange={e => setStagedProfile({ ...stagedProfile, phone: e.target.value })} /></div>
              <div><label style={labelStyle}>Professional Summary</label><RichTextEditor value={stagedProfile?.summary || ''} onChange={val => setStagedProfile({ ...stagedProfile, summary: val })} placeholder="Brief professional summary..." minHeight="70px" /></div>
            </div>
          </div>

          {/* Social Links */}
          <div style={{ marginBottom: '20px' }}>
            <span style={sectionLabel}>Social / Portfolio Links</span>
            {stagedSocials.map((soc, idx) => (
              <div key={`social-${idx}`} style={subCard}>
                <div style={subCardHeader}>
                  <span style={subCardLabel}>Link #{idx + 1}{soc.platform_name ? ` · ${soc.platform_name}` : ''}</span>
                  <button style={removeBtn} onClick={() => setStagedSocials(stagedSocials.filter((_, i) => i !== idx))}>✕ Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Platform</label><input className="form-input" style={inputStyle} placeholder="e.g. GitHub" value={soc.platform_name} onChange={e => { const u = [...stagedSocials]; u[idx].platform_name = e.target.value; setStagedSocials(u); }} /></div>
                  <div><label style={labelStyle}>Display Text</label><input className="form-input" style={inputStyle} placeholder="Optional label" value={soc.display_text || ''} onChange={e => { const u = [...stagedSocials]; u[idx].display_text = e.target.value; setStagedSocials(u); }} /></div>
                </div>
                <div><label style={labelStyle}>URL</label><input className="form-input" style={inputStyle} placeholder="https://..." value={soc.url} onChange={e => { const u = [...stagedSocials]; u[idx].url = e.target.value; setStagedSocials(u); }} /></div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setStagedSocials([...stagedSocials, { platform_name: '', display_text: '', url: '' }])}>+ Add Social Link</button>
          </div>

          {/* Education */}
          <div style={{ marginBottom: '20px' }}>
            <span style={sectionLabel}>Education</span>
            {stagedEducations.map((edu, idx) => (
              <div key={`edu-${idx}`} style={subCard}>
                <div style={subCardHeader}>
                  <span style={subCardLabel}>Education #{idx + 1}{edu.institution ? ` · ${edu.institution}` : ''}</span>
                  <button style={removeBtn} onClick={() => setStagedEducations(stagedEducations.filter((_, i) => i !== idx))}>✕ Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Institution</label><input className="form-input" style={inputStyle} placeholder="University Name" value={edu.institution} onChange={e => { const u = [...stagedEducations]; u[idx].institution = e.target.value; setStagedEducations(u); }} /></div>
                  <div><label style={labelStyle}>Degree</label><input className="form-input" style={inputStyle} placeholder="B.Tech in CS" value={edu.degree} onChange={e => { const u = [...stagedEducations]; u[idx].degree = e.target.value; setStagedEducations(u); }} /></div>
                </div>
                <div><label style={labelStyle}>Dates</label><input className="form-input" style={inputStyle} placeholder="Aug 2019 – Jun 2023" value={edu.dates} onChange={e => { const u = [...stagedEducations]; u[idx].dates = e.target.value; setStagedEducations(u); }} /></div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setStagedEducations([...stagedEducations, { institution: '', degree: '', dates: '' }])}>+ Add Education</button>
          </div>

          {/* Technical Skills */}
          <div style={{ marginBottom: '20px' }}>
            <span style={sectionLabel}>Technical Skills</span>
            {stagedSkills.map((sg, idx) => (
              <div key={`sg-${idx}`} style={subCard}>
                <div style={subCardHeader}>
                  <span style={subCardLabel}>Category #{idx + 1}{sg.category ? ` · ${sg.category}` : ''}</span>
                  <button style={removeBtn} onClick={() => setStagedSkills(stagedSkills.filter((_, i) => i !== idx))}>✕ Remove</button>
                </div>
                <div style={{ marginBottom: '8px' }}><label style={labelStyle}>Category Name</label><input className="form-input" style={inputStyle} placeholder="e.g. Languages" value={sg.category} onChange={e => { const u = [...stagedSkills]; u[idx].category = e.target.value; setStagedSkills(u); }} /></div>
                <div><label style={labelStyle}>Skills (comma-separated)</label><textarea className="form-input" style={{ ...inputStyle, minHeight: '50px' }} placeholder="JavaScript, Python, Java..." value={sg.skills.join(', ')} onChange={e => { const u = [...stagedSkills]; u[idx].skills = e.target.value.split(',').map(s => s.trim()); setStagedSkills(u); }} /></div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setStagedSkills([...stagedSkills, { category: '', skills: [] }])}>+ Add Skill Category</button>
          </div>

          {/* Experience */}
          {stagedExps.length > 0 && <span style={{ ...sectionLabel, display: 'block', marginTop: '4px' }}>Experience</span>}
          {stagedExps.map((exp, idx) => (
            <div key={`exp-${idx}`} style={{ ...subCard, border: `1px solid ${idx === 0 ? 'rgba(56,226,152,0.35)' : 'var(--glass-border)'}`, marginBottom: '10px' }}>
              <div style={subCardHeader}>
                <span style={{ ...subCardLabel, color: idx === 0 ? 'var(--success)' : 'var(--accent-light)' }}>Experience #{idx + 1}{idx === 0 ? ' · AI Targeted' : ''}</span>
                <button style={removeBtn} onClick={() => setStagedExps(stagedExps.filter((_, i) => i !== idx))}>✕ Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={labelStyle}>Job Title</label><input className="form-input" style={inputStyle} value={exp.job_title} onChange={e => updateStagedExp(idx, 'job_title', e.target.value)} placeholder="e.g. Software Engineer" /></div>
                <div><label style={labelStyle}>Company</label><input className="form-input" style={inputStyle} value={exp.company_name} onChange={e => updateStagedExp(idx, 'company_name', e.target.value)} placeholder="e.g. Google" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div><label style={labelStyle}>Start Date</label><input className="form-input" style={inputStyle} value={exp.start_date} onChange={e => updateStagedExp(idx, 'start_date', e.target.value)} placeholder="e.g. 2022-01" /></div>
                <div><label style={labelStyle}>End Date</label><input className="form-input" style={inputStyle} value={exp.end_date || ''} onChange={e => updateStagedExp(idx, 'end_date', e.target.value)} placeholder="Leave blank if current" /></div>
              </div>
              <label style={labelStyle}>Bullet Points</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {(exp.stagedBullets || []).map((b: string, bIdx: number) => (
                  <div key={`b-${bIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ marginTop: '10px', color: 'var(--accent)', flexShrink: 0 }}>•</span>
                    <div style={{ flex: 1 }}><RichTextEditor value={b} onChange={val => updateStagedExpBullet(idx, bIdx, val)} minHeight="46px" /></div>
                    <button style={{ ...removeBtn, marginTop: '8px', flexShrink: 0 }} onClick={() => { const u = [...stagedExps]; u[idx].stagedBullets.splice(bIdx, 1); setStagedExps(u); }}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.78rem', padding: '5px 12px', marginTop: '4px' }} onClick={() => { const u = [...stagedExps]; u[idx].stagedBullets.push(''); setStagedExps(u); }}>+ Add Bullet</button>
              </div>
            </div>
          ))}

          {/* Projects */}
          {stagedProjs.length > 0 && <span style={{ ...sectionLabel, display: 'block', marginTop: '8px' }}>Projects</span>}
          {stagedProjs.map((proj, idx) => (
            <div key={`proj-${idx}`} style={{ ...subCard, marginBottom: '10px' }}>
              <div style={subCardHeader}>
                <span style={subCardLabel}>Project #{idx + 1}{proj.title ? ` · ${proj.title}` : ''}</span>
                <button style={removeBtn} onClick={() => setStagedProjs(stagedProjs.filter((_, i) => i !== idx))}>✕ Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div><label style={labelStyle}>Project Title</label><input className="form-input" style={inputStyle} value={proj.title} onChange={e => updateStagedProj(idx, 'title', e.target.value)} placeholder="e.g. Book Store App" /></div>
                <div><label style={labelStyle}>Tech Stack</label><input className="form-input" style={inputStyle} value={proj.tech_stack || ''} onChange={e => updateStagedProj(idx, 'tech_stack', e.target.value)} placeholder="React, Node.js, MongoDB" /></div>
              </div>
              <label style={labelStyle}>Bullet Points</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {(proj.stagedBullets || []).map((b: string, bIdx: number) => (
                  <div key={`proj-b-${bIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ marginTop: '10px', color: 'var(--accent)', flexShrink: 0 }}>•</span>
                    <div style={{ flex: 1 }}><RichTextEditor value={b} onChange={val => updateStagedProjBullet(idx, bIdx, val)} minHeight="46px" /></div>
                    <button style={{ ...removeBtn, marginTop: '8px', flexShrink: 0 }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.splice(bIdx, 1); setStagedProjs(u); }}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.78rem', padding: '5px 12px', marginTop: '4px' }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.push(''); setStagedProjs(u); }}>+ Add Bullet</button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: PDF Preview */}
        <div style={{ width: '45%', background: '#525659', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', background: '#323639', borderBottom: '1px solid rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#ccc', margin: 0, fontWeight: 500 }}>PDF Preview</h3>
            {pdfPreviewUrl && <span style={{ fontSize: '0.7rem', color: '#6c6', background: 'rgba(0,200,100,0.1)', padding: '2px 8px', borderRadius: '20px' }}>● Live</span>}
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {isPreviewLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(50,54,57,0.85)', zIndex: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--success)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>Compiling LaTeX...</span>
                </div>
              </div>
            )}
            {pdfPreviewUrl ? (
              <iframe src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="Resume PDF Preview" scrolling="no" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888', gap: '10px' }}>
                <span style={{ fontSize: '2rem' }}>📄</span>
                <p style={{ fontSize: '0.9rem' }}>No preview yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
