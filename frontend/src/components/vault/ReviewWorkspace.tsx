import { useState, useEffect, useRef } from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import { ATSResult } from '@/types/ats';
import { useAuth } from '@/contexts/AuthContext';

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
  // ATS
  targetJobInput: string;
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
  pdfPreviewUrl, isPreviewLoading, isDirty, genError, targetJobInput,
  onRecompile, onDownload, onClose,
}: ReviewWorkspaceProps) {

  const { token } = useAuth();
  const [atsStatus, setAtsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [isAtsDirty, setIsAtsDirty] = useState(false);
  const [openTitleIdx, setOpenTitleIdx] = useState<number | null>(null);
  const atsSnapshot = useRef<string>('');
  const atsInitialized = useRef(false);
  const [draggedItem, setDraggedItem] = useState<{ type: 'exp' | 'proj', parentIdx: number, bulletIdx: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'exp' | 'proj', parentIdx: number, bulletIdx: number } | null>(null);
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);

  // Build a snapshot of data that affects ATS score (skills, exp bullets, proj bullets, summary)
  const buildAtsSnapshot = () => JSON.stringify({
    summary: stagedProfile?.summary,
    skills: stagedSkills,
    expBullets: stagedExps.map(e => e.stagedBullets),
    projBullets: stagedProjs.map(p => p.stagedBullets),
  });

  // Watch ATS-relevant fields and mark dirty after first score load
  useEffect(() => {
    const current = buildAtsSnapshot();
    if (!atsInitialized.current) return; // wait until first score is loaded
    setIsAtsDirty(current !== atsSnapshot.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedProfile?.summary, stagedSkills, stagedExps, stagedProjs]);

  const handleCheckATS = async () => {
    if (!token) return;
    setAtsStatus('loading');
    try {
      const payload = {
        job_input: targetJobInput,
        resume_data: {
          profile: stagedProfile,
          experiences: stagedExps,
          projects: stagedProjs,
          educations: stagedEducations,
          skills: stagedSkills
        }
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/ats/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to calculate ATS score');
      }

      const data = await res.json();
      setAtsResult(data);
      setAtsStatus('idle');
      // Save snapshot and mark clean after a successful score
      atsSnapshot.current = buildAtsSnapshot();
      atsInitialized.current = true;
      setIsAtsDirty(false);
    } catch (err) {
      console.error(err);
      setAtsStatus('error');
    }
  };

  // Auto-run ATS score on mount
  useEffect(() => {
    if (targetJobInput) handleCheckATS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDragStart = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}-${parentIdx}-${bulletIdx}`);
    setDraggedItem({ type, parentIdx, bulletIdx });
  };

  const handleDragOver = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === type && draggedItem.parentIdx === parentIdx) {
      setDragOverItem({ type, parentIdx, bulletIdx });
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === type && draggedItem.parentIdx === parentIdx && draggedItem.bulletIdx !== bulletIdx) {
      if (type === 'exp') {
        const u = [...stagedExps];
        const items = [...u[parentIdx].stagedBullets];
        const [reorderedItem] = items.splice(draggedItem.bulletIdx, 1);
        items.splice(bulletIdx, 0, reorderedItem);
        u[parentIdx].stagedBullets = items;
        setStagedExps(u);
      } else {
        const u = [...stagedProjs];
        const items = [...u[parentIdx].stagedBullets];
        const [reorderedItem] = items.splice(draggedItem.bulletIdx, 1);
        items.splice(bulletIdx, 0, reorderedItem);
        u[parentIdx].stagedBullets = items;
        setStagedProjs(u);
      }
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setDragEnabledId(null);
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
            onClick={handleCheckATS}
            disabled={atsStatus === 'loading'}
            style={{ position: 'relative', padding: '6px 15px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isAtsDirty && atsStatus !== 'loading' && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.8)', display: 'block' }} />
            )}
            {atsStatus === 'loading' ? 'Scoring...' : '🎯 Check ATS Score'}
          </button>
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

          {/* ATS Score Panel */}
          {(atsStatus === 'loading' || atsResult || atsStatus === 'error') && (
            <div style={{ marginBottom: '20px', background: 'rgba(108, 93, 211, 0.08)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-light)' }}>ATS Match Score</h3>
                <button style={removeBtn} onClick={() => { setAtsResult(null); setAtsStatus('idle'); }}>✕ Close</button>
              </div>

              {atsStatus === 'loading' ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Analyzing resume against job description...</div>
              ) : atsStatus === 'error' ? (
                <div style={{ color: 'var(--error)', fontSize: '0.9rem' }}>Failed to calculate score. Check connection or job description.</div>
              ) : atsResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {/* Score Circle */}
                    <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="80" height="80" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke={atsResult.overall_score >= 80 ? 'var(--success)' : atsResult.overall_score >= 60 ? '#eab308' : 'var(--error)'} strokeWidth="8" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - atsResult.overall_score / 100)}`} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                      </svg>
                      <div style={{ position: 'absolute', fontSize: '1.4rem', fontWeight: 700 }}>{atsResult.overall_score}%</div>
                    </div>

                    {/* Dimension Bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { label: 'Keywords', score: atsResult.keyword_score, help: 'Percentage of job keywords found in your bullets and descriptions.' },
                        { label: 'Skills', score: atsResult.skill_score, help: 'Percentage of required skills found in your explicit Skills section.' },
                        { label: 'Title Match', score: atsResult.title_score, help: 'How well your past job titles match the target role.' },
                        { label: 'Completeness', score: atsResult.completeness_score, help: 'Presence of standard resume sections (Summary, Experience, Projects, etc.).' }
                      ].map((dim, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '110px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }} title={dim.help}>
                            {dim.label}
                            <span style={{ cursor: 'help', fontSize: '0.65rem', opacity: 0.6 }}>ⓘ</span>
                          </span>
                          <div style={{ flex: 1, height: '6px', background: 'var(--glass-border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${dim.score}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                          </div>
                          <span style={{ width: '30px', fontSize: '0.75rem', textAlign: 'right' }}>{dim.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Keywords */}
                  <div style={{ fontSize: '0.8rem' }}>
                    <div style={{ marginBottom: '6px', fontWeight: 600 }}>Matched Keywords & Skills:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {atsResult.matched_keywords.length > 0 ? atsResult.matched_keywords.map((k, i) => (
                        <span key={i} style={{ background: 'rgba(56, 226, 152, 0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>✓ {k}</span>
                      )) : <span style={{ color: 'var(--text-muted)' }}>None found</span>}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <div style={{ marginBottom: '6px', fontWeight: 600 }}>Missing Keywords & Skills:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {atsResult.missing_keywords.length > 0 ? atsResult.missing_keywords.map((k, i) => (
                        <span key={i} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>✕ {k}</span>
                      )) : <span style={{ color: 'var(--success)' }}>All keywords matched!</span>}
                    </div>
                  </div>

                  {/* Suggested Titles — Interactive */}
                  {atsResult.title_score < 100 && (
                    <div style={{ fontSize: '0.8rem', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#eab308', marginBottom: '4px' }}>💼 Suggested Job Titles</div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.75rem' }}>
                        Click a title to apply it to an experience entry to boost your Title Match score.
                      </div>
                      {(atsResult.suggested_titles?.length ?? 0) > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(atsResult.suggested_titles ?? []).map((title, i) => (
                            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                onClick={() => setOpenTitleIdx(openTitleIdx === i ? null : i)}
                                style={{
                                  background: 'rgba(234,179,8,0.15)', color: '#eab308',
                                  padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem',
                                  cursor: 'pointer', border: '1px solid rgba(234,179,8,0.4)'
                                }}
                              >
                                {title} ▾
                              </button>
                              {openTitleIdx === i && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, zIndex: 10,
                                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                  borderRadius: '8px', padding: '6px', minWidth: '220px',
                                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)', marginTop: '4px'
                                }}>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 6px', marginBottom: '4px' }}>Apply to:</div>

                                  <button
                                    style={{
                                      display: 'block', width: '100%', textAlign: 'left',
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      padding: '5px 8px', fontSize: '0.78rem', color: 'var(--text-main)',
                                      borderRadius: '4px', marginBottom: '4px'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,93,211,0.15)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    onClick={() => {
                                      const currentSummary = stagedProfile?.summary || '';
                                      if (!currentSummary.includes(title)) {
                                        setStagedProfile({ ...stagedProfile, summary: currentSummary ? `${title} | ${currentSummary}` : title });
                                      }
                                      setOpenTitleIdx(null); // close after selecting
                                    }}
                                  >
                                    📝 Professional Summary
                                  </button>

                                  <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />

                                  {stagedExps.length === 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 6px' }}>No experiences found.</div>
                                  )}
                                  {stagedExps.map((exp, expIdx) => (
                                    <button
                                      key={expIdx}
                                      style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        padding: '5px 8px', fontSize: '0.78rem', color: 'var(--text-main)',
                                        borderRadius: '4px'
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,93,211,0.15)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                      onClick={() => {
                                        const updated = [...stagedExps];
                                        updated[expIdx].job_title = title;
                                        setStagedExps(updated);
                                        setOpenTitleIdx(null); // close after selecting
                                      }}
                                    >
                                      💼 #{expIdx + 1} · {exp.company_name || 'Unnamed'} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({exp.job_title || 'No title'})</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          Update your experience job titles to more closely reflect the target role's language.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tips */}
                  {atsResult.tips.length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px' }}>
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: '#eab308', marginBottom: '6px' }}>💡 Tips to Improve</strong>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                        {atsResult.tips.map((tip, i) => <li key={i} style={{ marginBottom: '4px' }}>{tip}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                <div><label style={labelStyle}>Skills (comma-separated)</label><textarea className="form-input" style={{ ...inputStyle, minHeight: '50px' }} placeholder="JavaScript, Python, Java..." value={(sg as any)._rawString !== undefined ? (sg as any)._rawString : sg.skills.join(', ')} onChange={e => { const u = [...stagedSkills]; (u[idx] as any)._rawString = e.target.value; u[idx].skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean); setStagedSkills(u); }} /></div>
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
                  <div 
                    key={`b-${bIdx}`} 
                    draggable={dragEnabledId === `exp-${idx}-${bIdx}`}
                    onDragStart={(e) => handleDragStart(e, 'exp', idx, bIdx)}
                    onDragOver={(e) => handleDragOver(e, 'exp', idx, bIdx)}
                    onDrop={(e) => handleDrop(e, 'exp', idx, bIdx)}
                    onDragEnd={handleDragEnd}
                    style={{ 
                      display: 'flex', gap: '8px', alignItems: 'flex-start',
                      opacity: draggedItem?.type === 'exp' && draggedItem.parentIdx === idx && draggedItem.bulletIdx === bIdx ? 0.5 : 1,
                      borderTop: dragOverItem?.type === 'exp' && dragOverItem.parentIdx === idx && dragOverItem.bulletIdx === bIdx && draggedItem && draggedItem.bulletIdx > bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                      borderBottom: dragOverItem?.type === 'exp' && dragOverItem.parentIdx === idx && dragOverItem.bulletIdx === bIdx && draggedItem && draggedItem.bulletIdx < bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                      padding: '2px 0',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div 
                      onMouseEnter={() => setDragEnabledId(`exp-${idx}-${bIdx}`)}
                      onMouseLeave={() => setDragEnabledId(null)}
                      style={{ marginTop: '10px', color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} 
                      title="Drag to reorder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                    </div>
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
                  <div 
                    key={`proj-b-${bIdx}`} 
                    draggable={dragEnabledId === `proj-${idx}-${bIdx}`}
                    onDragStart={(e) => handleDragStart(e, 'proj', idx, bIdx)}
                    onDragOver={(e) => handleDragOver(e, 'proj', idx, bIdx)}
                    onDrop={(e) => handleDrop(e, 'proj', idx, bIdx)}
                    onDragEnd={handleDragEnd}
                    style={{ 
                      display: 'flex', gap: '8px', alignItems: 'flex-start',
                      opacity: draggedItem?.type === 'proj' && draggedItem.parentIdx === idx && draggedItem.bulletIdx === bIdx ? 0.5 : 1,
                      borderTop: dragOverItem?.type === 'proj' && dragOverItem.parentIdx === idx && dragOverItem.bulletIdx === bIdx && draggedItem && draggedItem.bulletIdx > bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                      borderBottom: dragOverItem?.type === 'proj' && dragOverItem.parentIdx === idx && dragOverItem.bulletIdx === bIdx && draggedItem && draggedItem.bulletIdx < bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                      padding: '2px 0',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div 
                      onMouseEnter={() => setDragEnabledId(`proj-${idx}-${bIdx}`)}
                      onMouseLeave={() => setDragEnabledId(null)}
                      style={{ marginTop: '10px', color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} 
                      title="Drag to reorder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                    </div>
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
