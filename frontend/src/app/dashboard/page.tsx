"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<any>({});
  const [experiences, setExperiences] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [educations, setEducations] = useState<any[]>([]);
  const [socials, setSocials] = useState<any[]>([]);

  // UI States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingExp, setIsAddingExp] = useState(false);
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [isAddingEdu, setIsAddingEdu] = useState(false);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [isAddingSocial, setIsAddingSocial] = useState(false);

  // Form States
  const [profForm, setProfForm] = useState({ first_name: '', last_name: '', location: '', phone: '', summary: '' });
  const [expForm, setExpForm] = useState({ company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' });
  const [projForm, setProjForm] = useState({ title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' });
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' });
  const [skillForm, setSkillForm] = useState({ skill_name: '', category: '' });
  const [socialForm, setSocialForm] = useState({ platform_name: '', url: '', display_text: '' });

  // Generation State
  const [url, setUrl] = useState('');
  const [genStatus, setGenStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [genError, setGenError] = useState<string | null>(null);
  
  // Review Staging Phase
  const [isReviewing, setIsReviewing] = useState(false);
  const [stagedProfile, setStagedProfile] = useState<any>(null);
  const [stagedExps, setStagedExps] = useState<any[]>([]);
  const [stagedProjs, setStagedProjs] = useState<any[]>([]);
  const [stagedEducations, setStagedEducations] = useState<any[]>([]);
  // We'll manage stagedSkills as a grouped format: [{category: "Languages", skills: ["JS", "TS"]}, ...]
  const [stagedSkills, setStagedSkills] = useState<{category: string, skills: string[]}[]>([]);
  const [stagedSocials, setStagedSocials] = useState<any[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const stagingInitialized = useRef(false);
  // Stores JSON of staged data at the time of last compile (or initial load)
  const compiledSnapshot = useRef<string>('');

  const buildSnapshot = (profile: any, exps: any[], projs: any[], edus: any[], skills: any[], socials: any[]) =>
    JSON.stringify({ profile, exps, projs, edus, skills, socials });

  // Reset when review workspace opens
  useEffect(() => {
    if (isReviewing) {
      stagingInitialized.current = false;
      setIsDirty(false);
    }
  }, [isReviewing]);

  // Compare current staged data to the last-compiled snapshot
  useEffect(() => {
    if (!isReviewing) return;
    const current = buildSnapshot(stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials);
    if (!stagingInitialized.current) {
      // Capture the baseline (initial AI-generated staging)
      compiledSnapshot.current = current;
      stagingInitialized.current = true;
      return;
    }
    setIsDirty(current !== compiledSnapshot.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials]);

  // ─── sessionStorage helpers ───────────────────────────
  const VAULT_CACHE_KEY = `vault_cache_${user?.id ?? 'anon'}`;

  const saveVaultCache = (data: {
    profile: any;
    experiences: any[];
    projects: any[];
    skills: any[];
    educations: any[];
    socials: any[];
  }) => {
    try {
      sessionStorage.setItem(VAULT_CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
  };

  const loadVaultCache = () => {
    try {
      const raw = sessionStorage.getItem(VAULT_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };

  const bustVaultCache = () => sessionStorage.removeItem(VAULT_CACHE_KEY);
  // ────────────────────────────────────────────────────────

  const fetchVault = async (forceRefresh = false) => {
    // Serve from cache unless a write operation just happened
    if (!forceRefresh) {
      const cached = loadVaultCache();
      if (cached) {
        setProfile(cached.profile ?? {});
        setProfForm({
          first_name: cached.profile?.first_name || '',
          last_name: cached.profile?.last_name || '',
          location: cached.profile?.location || '',
          phone: cached.profile?.phone || '',
          summary: cached.profile?.summary || ''
        });
        setExperiences(cached.experiences ?? []);
        setProjects(cached.projects ?? []);
        setSkills(cached.skills ?? []);
        setEducations(cached.educations ?? []);
        setSocials(cached.socials ?? []);
        return; // ← skip API calls
      }
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let p = {};
      const profRes = await fetch(`${API_URL}/api/vault/profile`, { headers });
      if (profRes.ok) {
        p = await profRes.json();
        setProfile(p);
        setProfForm({ first_name: (p as any).first_name || '', last_name: (p as any).last_name || '', location: (p as any).location || '', phone: (p as any).phone || '', summary: (p as any).summary || '' });
      }
      let exps: any[] = [], projs: any[] = [], skls: any[] = [], edus: any[] = [], socs: any[] = [];
      const expRes = await fetch(`${API_URL}/api/vault/experiences`, { headers });
      if (expRes.ok) { exps = await expRes.json(); setExperiences(exps); }
      const projsRes = await fetch(`${API_URL}/api/vault/projects`, { headers });
      if (projsRes.ok) { projs = await projsRes.json(); setProjects(projs); }
      const skillsRes = await fetch(`${API_URL}/api/vault/skills`, { headers });
      if (skillsRes.ok) { skls = await skillsRes.json(); setSkills(skls); }
      const eduRes = await fetch(`${API_URL}/api/vault/educations`, { headers });
      if (eduRes.ok) { edus = await eduRes.json(); setEducations(edus); }
      const socialRes = await fetch(`${API_URL}/api/vault/socials`, { headers });
      if (socialRes.ok) { socs = await socialRes.json(); setSocials(socs); }
      // Persist fresh data to sessionStorage
      saveVaultCache({ profile: p, experiences: exps, projects: projs, skills: skls, educations: edus, socials: socs });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchVault();
  }, [token, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/vault/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(profForm)
    });
    setIsEditingProfile(false);
    bustVaultCache();
    fetchVault(true);
  };

  const handleAddExp = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/vault/experiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...expForm,
        start_date: expForm.start_date || new Date().toISOString().split('T')[0],
        end_date: expForm.end_date || null
      })
    });
    setIsAddingExp(false);
    setExpForm({ company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' });
    bustVaultCache();
    fetchVault(true);
  };

  const handleAddProj = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/vault/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...projForm,
        start_date: projForm.start_date || null,
        end_date: projForm.end_date || null,
        tech_stack: projForm.tech_stack.split(',').map(s => s.trim()).filter(s => s)
      })
    });
    setIsAddingProj(false);
    setProjForm({ title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' });
    bustVaultCache();
    fetchVault(true);
  };

  const handleAddEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/vault/educations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...eduForm, end_date: eduForm.end_date || null })
    });
    setIsAddingEdu(false);
    setEduForm({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' });
    bustVaultCache();
    fetchVault(true);
  };

  const handleAddSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/vault/socials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(socialForm)
    });
    setIsAddingSocial(false);
    setSocialForm({ platform_name: '', url: '', display_text: '' });
    bustVaultCache();
    fetchVault(true);
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow comma separated skills addition for faster grouping
    const skillsToAdd = skillForm.skill_name.split(',').map(s => s.trim()).filter(s => s);
    for (const s of skillsToAdd) {
        await fetch(`${API_URL}/api/vault/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ skill_name: s, category: skillForm.category })
        });
    }
    setIsAddingSkill(false);
    setSkillForm({ skill_name: '', category: '' });
    bustVaultCache();
    fetchVault(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !token) return;

    const normalizedUrl = url.trim().toLowerCase();
    const GEN_CACHE_KEY = `gen_cache_${user?.id ?? 'anon'}_${normalizedUrl}`;

    // ─── Try to restore from session cache ───────────────
    const applyGeneratedData = (data: any) => {
      setStagedProfile({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        location: profile.location || '',
        email: user?.email || '',
        phone: profile.phone || '',
        summary: data.summary || profile.summary || '',
      });

      setStagedSocials([...socials]);

      if (data.technical_skills && data.technical_skills.length > 0) {
        setStagedSkills(data.technical_skills);
      } else {
        const grouped = skills.reduce((acc: any, skill: any) => {
          const cat = skill.category || "Other";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(skill.skill_name);
          return acc;
        }, {});
        setStagedSkills(Object.keys(grouped).map(cat => ({ category: cat, skills: grouped[cat] })));
      }

      setStagedEducations(educations.length > 0 ? educations.map((edu: any) => ({
        ...edu,
        dates: edu.dates || `${edu.start_date || ''} -- ${edu.end_date || 'Present'}`
      })) : [
        { institution: "University Name", degree: "Bachelor of Science", dates: "Aug. 2018 -- May 2022" }
      ]);

      const aiExpMap: Record<string, string[]> = {};
      (data.experiences || []).forEach((ae: any) => {
        if (ae.company) aiExpMap[ae.company.toLowerCase()] = ae.bullets || [];
      });
      const clonedExps = experiences.map((exp) => {
        const key = (exp.company_name || '').toLowerCase();
        const aiBullets = aiExpMap[key];
        return {
          ...exp,
          stagedBullets: aiBullets && aiBullets.length > 0
            ? aiBullets
            : (exp.raw_description ? exp.raw_description.split('\n').filter((s: string) => s.trim()) : [])
        };
      });
      setStagedExps(clonedExps);

      const aiProjMap: Record<string, string[]> = {};
      (data.projects || []).forEach((ap: any) => {
        if (ap.title) aiProjMap[ap.title.toLowerCase()] = ap.bullets || [];
      });
      const clonedProjs = projects.map(proj => {
        const key = (proj.title || '').toLowerCase();
        const aiBullets = aiProjMap[key];
        return {
          ...proj,
          tech_stack: proj.tech_stack ? proj.tech_stack.join(', ') : '',
          stagedBullets: aiBullets && aiBullets.length > 0
            ? aiBullets
            : (proj.raw_description ? proj.raw_description.split('\n').filter((s: string) => s.trim()) : [])
        };
      });
      setStagedProjs(clonedProjs);

      setIsReviewing(true);
      setGenStatus("idle");
    };

    // Check cache first — same URL = skip API
    try {
      const cached = sessionStorage.getItem(GEN_CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        applyGeneratedData(data);
        return; // ← served from cache, no API call
      }
    } catch { /* ignore parse errors */ }
    // ─────────────────────────────────────────────────────

    setGenStatus("loading");
    setGenError(null);

    try {
      const res = await fetch(`${API_URL}/generate-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ job_url: url.trim() })
      });

      if (!res.ok) throw new Error("Failed to generate AI outline.");

      const data = await res.json();

      // Persist to session cache
      try {
        sessionStorage.setItem(GEN_CACHE_KEY, JSON.stringify({ data, _ts: Date.now() }));
      } catch { /* quota exceeded */ }

      applyGeneratedData(data);
    } catch (err: any) {
      setGenError(err.message || "Failed to analyze target job.");
      setGenStatus("error");
    }
  };

  // Staged State Mutators
  const updateStagedExp = (idx: number, field: string, val: any) => {
      const updated = [...stagedExps];
      updated[idx][field] = val;
      setStagedExps(updated);
  };

  const updateStagedExpBullet = (expIdx: number, bulletIdx: number, val: string) => {
      const updated = [...stagedExps];
      updated[expIdx].stagedBullets[bulletIdx] = val;
      setStagedExps(updated);
  };

  const updateStagedProj = (idx: number, field: string, val: any) => {
      const updated = [...stagedProjs];
      updated[idx][field] = val;
      setStagedProjs(updated);
  };

  const updateStagedProjBullet = (projIdx: number, bulletIdx: number, val: string) => {
      const updated = [...stagedProjs];
      updated[projIdx].stagedBullets[bulletIdx] = val;
      setStagedProjs(updated);
  };

  const handleGeneratePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const formattedExps = stagedExps.map((exp) => ({
        company: exp.company_name || '',
        title: exp.job_title || '',
        dates: `${exp.start_date || ''} -- ${exp.end_date || 'Present'}`,
        location: exp.location || '', 
        bullets: (exp.stagedBullets || []).filter((s: string) => s.trim())
      }));

      const formattedProjs = stagedProjs.map((proj) => ({
        title: proj.title || '',
        role: proj.role || '',
        dates: proj.start_date ? `${proj.start_date} -- ${proj.end_date || 'Present'}` : '', 
        tech_stack: proj.tech_stack || '',
        repository_url: proj.repository_url || '',
        live_demo_url: proj.live_demo_url || '',
        bullets: (proj.stagedBullets || []).filter((s: string) => s.trim())
      }));

      const payload = {
        candidate_name: `${stagedProfile?.first_name || ''} ${stagedProfile?.last_name || ''}`.trim(),
        candidate_email: stagedProfile?.email || '',
        candidate_location: stagedProfile?.location || '',
        candidate_phone: stagedProfile?.phone || '',
        candidate_summary: stagedProfile?.summary || '',
        experiences: formattedExps,
        projects: formattedProjs,
        education_blocks: stagedEducations.filter(e => e.institution?.trim() !== "").map(e => ({
          institution: e.institution || '',
          degree: e.degree || '',
          dates: e.dates || `${e.start_date || ''} -- ${e.end_date || 'Present'}`
        })),
        grouped_skills: stagedSkills,
        social_links: stagedSocials
      };

      const res = await fetch(`${API_URL}/generate-resume-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to compile LaTeX PDF.");

      const blob = await res.blob();
      const newUrl = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(newUrl);
      // Update snapshot to reflect newly compiled state — further reverts compare against this
      compiledSnapshot.current = buildSnapshot(stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials);
      setIsDirty(false);
      setGenError(null);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (isReviewing && !pdfPreviewUrl) {
      handleGeneratePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewing]);

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    const a = document.createElement('a');
    a.href = pdfPreviewUrl;
    a.download = `Tailored_Resume_${profile.first_name || 'vault'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setGenStatus("success");
    setUrl('');
  };

  if (!token) return null;

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: '0.9rem' };
  const sectionLabel: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'block' };
  const subCard: React.CSSProperties = { background: 'rgba(108,93,211,0.06)', border: '1px solid rgba(108,93,211,0.25)', borderRadius: '10px', padding: '14px', marginBottom: '10px' };
  const subCardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const subCardLabel: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const removeBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.72rem', opacity: 0.8 };

  return (
    <>
      <div className="container" style={{ marginTop: '40px' }}>
        <div className="dashboard-header">
        <div>
          <h1 className="title-main" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Career Vault</h1>
          <p className="title-sub">Manage the master copy of your professional journey here.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        
        {/* Profile Column */}
        <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start' }}>
          <div className="glass-panel" style={{ padding: '30px' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--accent-light)' }}>Profile Core</h3>
            
            {isEditingProfile ? (
              <form onSubmit={handleUpdateProfile}>
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="First Name" value={profForm.first_name} onChange={e => setProfForm({...profForm, first_name: e.target.value})} required />
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Last Name" value={profForm.last_name} onChange={e => setProfForm({...profForm, last_name: e.target.value})} required />
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Location" value={profForm.location} onChange={e => setProfForm({...profForm, location: e.target.value})} />
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Phone" value={profForm.phone} onChange={e => setProfForm({...profForm, phone: e.target.value})} />
                <textarea className="form-input" style={{ width: '100%', marginBottom: '10px', minHeight: '100px' }} placeholder="Summary" value={profForm.summary} onChange={e => setProfForm({...profForm, summary: e.target.value})} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '10px' }}>Save</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsEditingProfile(false)} style={{ padding: '10px' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Name</span>
                  <p style={{ fontWeight: 500, fontSize: '1.05rem' }}>{profile.first_name || 'N/A'} {profile.last_name || ''}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Location</span>
                    <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', fontSize: '0.9rem' }}>{profile.location || 'Not Set'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone</span>
                    <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', fontSize: '0.9rem' }}>{profile.phone || 'Not Set'}</p>
                  </div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bio / Summary</span>
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>{profile.summary || 'No summary provided.'}</p>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setIsEditingProfile(true)}>Edit Profile</button>
              </>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '30px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <h3 style={{ color: 'var(--accent-light)' }}>Socials</h3>
               {!isAddingSocial && <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setIsAddingSocial(true)}>+</button>}
             </div>
             {isAddingSocial && (
               <form onSubmit={handleAddSocial} style={{ marginBottom: '15px' }}>
                 <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="Platform (e.g. GitHub)" value={socialForm.platform_name} onChange={e => setSocialForm({...socialForm, platform_name: e.target.value})} required />
                 <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="URL *" value={socialForm.url} onChange={e => setSocialForm({...socialForm, url: e.target.value})} required />
                 <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="Display Text (Optional)" value={socialForm.display_text} onChange={e => setSocialForm({...socialForm, display_text: e.target.value})} />
                 <div style={{ display: 'flex', gap: '8px' }}>
                     <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '4px' }}>Save</button>
                     <button className="btn btn-secondary" type="button" onClick={() => setIsAddingSocial(false)} style={{ flex: 1, padding: '4px' }}>Cancel</button>
                 </div>
               </form>
             )}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                 {socials.length === 0 && !isAddingSocial ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No socials listed.</p> : null}
                 {socials.map(soc => (
                    <div key={soc.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                       <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'white' }}>{soc.platform_name}</span>
                       <a href={soc.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', textDecoration: 'underline' }}>{soc.display_text || soc.url}</a>
                    </div>
                 ))}
             </div>
          </div>
        </div>

        {/* Data Column */}
        <div className="dashboard-list">
          
          {/* Quick PDF Generation Interface */}
          <div className="glass-panel" style={{ padding: '30px', background: 'rgba(108, 93, 211, 0.05)', borderColor: 'rgba(108, 93, 211, 0.2)' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>AI Resume Generator ⚡</h2>
            <p className="title-sub" style={{ marginBottom: '20px', fontSize: '0.9rem' }}>Instantly compile your Vault experiences matching a target job description.</p>
            
            <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="url"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Paste Target Job URL (e.g., https://jobs.workable.com/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={genStatus === "loading"}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={genStatus === "loading" || !url.trim()}
                style={{ minWidth: '160px' }}
              >
                {genStatus === "loading" ? "Analyzing Vault..." : "Analyze & Draft"}
              </button>
            </form>

            {genStatus === "error" && genError && (
              <div className="alert alert-error" style={{ marginTop: '15px', marginBottom: 0, padding: '10px 15px' }}>{genError}</div>
            )}

            {genStatus === "success" && (
              <div className="alert alert-success" style={{ marginTop: '15px', marginBottom: 0, padding: '10px 15px' }}>Success! Your ATS-Optimized PDF has been downloaded perfectly!</div>
            )}
          </div>

          {/* Experiences */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Experiences</h2>
              {!isAddingExp && <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setIsAddingExp(true)}>+ Add Exp</button>}
            </div>
            
            {isAddingExp && (
              <form onSubmit={handleAddExp} className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h4 style={{ marginBottom: '15px' }}>Add New Experience</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" placeholder="Job Title *" value={expForm.job_title} onChange={e => setExpForm({...expForm, job_title: e.target.value})} required />
                  <input className="form-input" placeholder="Company *" value={expForm.company_name} onChange={e => setExpForm({...expForm, company_name: e.target.value})} required />
                </div>
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Location" value={expForm.location} onChange={e => setExpForm({...expForm, location: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" type="date" placeholder="Start Date *" value={expForm.start_date} onChange={e => setExpForm({...expForm, start_date: e.target.value})} required />
                  <input className="form-input" type="date" placeholder="End Date (Leave blank if present)" value={expForm.end_date} onChange={e => setExpForm({...expForm, end_date: e.target.value})} />
                </div>
                <textarea className="form-input" style={{ width: '100%', minHeight: '100px', marginBottom: '15px' }} placeholder="Raw Bullet Points or Description" value={expForm.raw_description} onChange={e => setExpForm({...expForm, raw_description: e.target.value})} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" type="submit">Save Experience</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsAddingExp(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div className="dashboard-list">
              {experiences.length === 0 && !isAddingExp ? (
                <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No experiences logged.</div>
              ) : null}
              {experiences.map(exp => (
                <div key={exp.id} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: 'white' }}>{exp.job_title} <span style={{ color: 'var(--accent-light)', fontWeight: 400 }}>@ {exp.company_name}</span></h3>
                    <span className="badge">{exp.start_date} - {exp.end_date || 'Present'}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{exp.raw_description}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '30px' }}></div>

          {/* Projects */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Projects</h2>
              {!isAddingProj && <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setIsAddingProj(true)}>+ Add Project</button>}
            </div>

            {isAddingProj && (
              <form onSubmit={handleAddProj} className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h4 style={{ marginBottom: '15px' }}>Add New Project</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" placeholder="Project Title *" value={projForm.title} onChange={e => setProjForm({...projForm, title: e.target.value})} required />
                  <input className="form-input" placeholder="Your Role (Optional)" value={projForm.role} onChange={e => setProjForm({...projForm, role: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" type="date" placeholder="Start Date" value={projForm.start_date} onChange={e => setProjForm({...projForm, start_date: e.target.value})} />
                  <input className="form-input" type="date" placeholder="End Date" value={projForm.end_date} onChange={e => setProjForm({...projForm, end_date: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" placeholder="Repository URL (e.g. GitHub)" value={projForm.repository_url} onChange={e => setProjForm({...projForm, repository_url: e.target.value})} />
                  <input className="form-input" placeholder="Live Demo URL (Optional)" value={projForm.live_demo_url} onChange={e => setProjForm({...projForm, live_demo_url: e.target.value})} />
                </div>
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Tech Stack (comma separated: React, Node.js, NextJS)" value={projForm.tech_stack} onChange={e => setProjForm({...projForm, tech_stack: e.target.value})} />
                <textarea className="form-input" style={{ width: '100%', minHeight: '100px', marginBottom: '15px' }} placeholder="Project Description or Bullets" value={projForm.raw_description} onChange={e => setProjForm({...projForm, raw_description: e.target.value})} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" type="submit">Save Project</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsAddingProj(false)}>Cancel</button>
                </div>
              </form>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {projects.length === 0 && !isAddingProj ? (
                <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No projects logged.</div>
              ) : null}
              {projects.map(proj => (
                <div key={proj.id} className="glass-card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{proj.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>{proj.role}</p>
                  
                  {proj.tech_stack && proj.tech_stack.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {proj.tech_stack.map((tech: string) => (
                        <span key={tech} className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.1)' }}>{tech}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '30px' }}></div>

          {/* Education Vault Array */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Education</h2>
              {!isAddingEdu && <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setIsAddingEdu(true)}>+ Add Education</button>}
            </div>

            {isAddingEdu && (
              <form onSubmit={handleAddEdu} className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h4 style={{ marginBottom: '15px' }}>Add Education Route</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" placeholder="Institution *" value={eduForm.institution} onChange={e => setEduForm({...eduForm, institution: e.target.value})} required />
                  <input className="form-input" placeholder="Degree *" value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} required />
                </div>
                <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Field of Study *" value={eduForm.field_of_study} onChange={e => setEduForm({...eduForm, field_of_study: e.target.value})} required />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <input className="form-input" type="date" placeholder="Start Date *" value={eduForm.start_date} onChange={e => setEduForm({...eduForm, start_date: e.target.value})} required />
                  <input className="form-input" type="date" placeholder="End Date (Optional)" value={eduForm.end_date} onChange={e => setEduForm({...eduForm, end_date: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" type="submit">Save Education</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsAddingEdu(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {educations.length === 0 && !isAddingEdu ? <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No education logged.</div> : null}
                {educations.map(edu => (
                  <div key={edu.id} className="glass-card" style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                           <h4 style={{ fontSize: '1.05rem', margin: '0 0 5px 0' }}>{edu.degree} in {edu.field_of_study}</h4>
                           <p style={{ color: 'var(--accent-light)', margin: 0, fontSize: '0.9rem' }}>{edu.institution}</p>
                        </div>
                        <span className="badge">{edu.start_date} - {edu.end_date || 'Present'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ height: '30px' }}></div>

          {/* Categorized Skills Vault Array */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Technical Skills</h2>
              {!isAddingSkill && <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => setIsAddingSkill(true)}>+ Map Categories</button>}
            </div>

            {isAddingSkill && (
              <form onSubmit={handleAddSkill} className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h4 style={{ marginBottom: '15px' }}>Batch Add Technical Skills</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input className="form-input" style={{ width: '200px' }} placeholder="Category (e.g. Languages) *" value={skillForm.category} onChange={e => setSkillForm({...skillForm, category: e.target.value})} required />
                  <input className="form-input" style={{ flex: 1 }} placeholder="Comma Separated Skills *" value={skillForm.skill_name} onChange={e => setSkillForm({...skillForm, skill_name: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" type="submit">Append Skills</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsAddingSkill(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                {skills.length === 0 && !isAddingSkill ? <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No skills tracked.</div> : null}
                {Object.entries(
                    skills.reduce((acc: any, skill: any) => {
                      const cat = skill.category || "Other";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(skill.skill_name);
                      return acc;
                    }, {})
                ).map(([cat, sks]: [string, any]) => (
                   <div key={`v-skill-${cat}`} className="glass-card" style={{ padding: '15px' }}>
                      <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '5px' }}>{cat}</strong>
                      <p style={{ color: 'white', margin: 0, fontSize: '0.9rem' }}>{(sks as string[]).join(', ')}</p>
                   </div>
                ))}
            </div>
          </div>

        </div>
      </div>
      </div>

      {isReviewing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
           
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'var(--bg-card)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
             <div>
               <h2 style={{ fontSize: '1.2rem', color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{fontSize: '1.4rem'}}>✨</span> Review PDF Outline</h2>
               <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Edits will NOT overwrite your master Vault.</span>
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
                 <button className="btn btn-secondary" onClick={() => setIsReviewing(false)} style={{ padding: '6px 15px', fontSize: '0.9rem' }}>Cancel</button>
                 <button
                   className="btn btn-secondary"
                   onClick={handleGeneratePreview}
                   disabled={isPreviewLoading}
                   style={{ position: 'relative', padding: '6px 15px', fontSize: '0.9rem', background: 'rgba(108, 93, 211, 0.2)' }}
                 >
                   {isDirty && !isPreviewLoading && (
                     <span style={{
                       position: 'absolute', top: '-5px', right: '-5px',
                       width: '10px', height: '10px', borderRadius: '50%',
                       background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.8)',
                       display: 'block'
                     }} />
                   )}
                   {isPreviewLoading ? "Recompiling..." : "Recompile"}
                 </button>
                 <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={!pdfPreviewUrl} style={{ padding: '6px 15px', fontSize: '0.9rem', background: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)' }}>
                   Download PDF
                 </button>
             </div>
           </div>
           
           <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* ─── Left: Editor Panel (55%) ─── */}
              <div style={{ width: '55%', overflowY: 'auto', padding: '20px 24px' }} className="custom-scrollbar">

                {/* Header Block */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={sectionLabel}>Header Block</span>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><label style={labelStyle}>First Name</label><input className="form-input" style={inputStyle} placeholder="First Name" value={stagedProfile?.first_name || ''} onChange={e => setStagedProfile({...stagedProfile, first_name: e.target.value})} /></div>
                      <div><label style={labelStyle}>Last Name</label><input className="form-input" style={inputStyle} placeholder="Last Name" value={stagedProfile?.last_name || ''} onChange={e => setStagedProfile({...stagedProfile, last_name: e.target.value})} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><label style={labelStyle}>Location</label><input className="form-input" style={inputStyle} placeholder="e.g. Kolkata, India" value={stagedProfile?.location || ''} onChange={e => setStagedProfile({...stagedProfile, location: e.target.value})} /></div>
                      <div><label style={labelStyle}>Email</label><input className="form-input" style={inputStyle} placeholder="email@example.com" value={stagedProfile?.email || ''} onChange={e => setStagedProfile({...stagedProfile, email: e.target.value})} /></div>
                    </div>
                    <div><label style={labelStyle}>Phone</label><input className="form-input" style={inputStyle} placeholder="+91 XXXXX XXXXX" value={stagedProfile?.phone || ''} onChange={e => setStagedProfile({...stagedProfile, phone: e.target.value})} /></div>
                    <div><label style={labelStyle}>Professional Summary</label><textarea className="form-input" style={{...inputStyle, minHeight: '70px'}} placeholder="Brief professional summary..." value={stagedProfile?.summary || ''} onChange={e => setStagedProfile({...stagedProfile, summary: e.target.value})} /></div>
                  </div>
                </div>

                {/* Social / Portfolio Links */}
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
                      <div><label style={labelStyle}>Skills (comma-separated)</label><textarea className="form-input" style={{...inputStyle, minHeight: '50px'}} placeholder="JavaScript, Python, Java..." value={sg.skills.join(', ')} onChange={e => { const u = [...stagedSkills]; u[idx].skills = e.target.value.split(',').map(s => s.trim()); setStagedSkills(u); }} /></div>
                    </div>
                  ))}
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setStagedSkills([...stagedSkills, { category: '', skills: [] }])}>+ Add Skill Category</button>
                </div>

                {/* Experience */}
                {stagedExps.length > 0 && <span style={{...sectionLabel, display: 'block', marginTop: '4px'}}>Experience</span>}
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
                          <textarea className="form-input" value={b} onChange={(e) => updateStagedExpBullet(idx, bIdx, e.target.value)} style={{ flex: 1, minHeight: '46px', lineHeight: 1.5, fontSize: '0.88rem', padding: '8px 12px' }} />
                          <button style={{ ...removeBtn, marginTop: '8px', flexShrink: 0 }} onClick={() => { const u = [...stagedExps]; u[idx].stagedBullets.splice(bIdx, 1); setStagedExps(u); }}>✕</button>
                        </div>
                      ))}
                      <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.78rem', padding: '5px 12px', marginTop: '4px' }} onClick={() => { const u = [...stagedExps]; u[idx].stagedBullets.push(''); setStagedExps(u); }}>+ Add Bullet</button>
                    </div>
                  </div>
                ))}

                {/* Projects */}
                {stagedProjs.length > 0 && <span style={{...sectionLabel, display: 'block', marginTop: '8px'}}>Projects</span>}
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
                          <textarea className="form-input" value={b} onChange={(e) => updateStagedProjBullet(idx, bIdx, e.target.value)} style={{ flex: 1, minHeight: '46px', lineHeight: 1.5, fontSize: '0.88rem', padding: '8px 12px' }} />
                          <button style={{ ...removeBtn, marginTop: '8px', flexShrink: 0 }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.splice(bIdx, 1); setStagedProjs(u); }}>✕</button>
                        </div>
                      ))}
                      <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.78rem', padding: '5px 12px', marginTop: '4px' }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.push(''); setStagedProjs(u); }}>+ Add Bullet</button>
                    </div>
                  </div>
                ))}

              </div>
             
              {/* ─── Right: PDF Preview (45%) ─── */}
             <div style={{ width: '45%', background: '#525659', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                {/* PDF mini toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', background: '#323639', borderBottom: '1px solid rgba(0,0,0,0.5)' }}>
                  <h3 style={{ fontSize: '0.85rem', color: '#ccc', margin: 0, fontWeight: 500 }}>PDF Preview</h3>
                  {pdfPreviewUrl && <span style={{ fontSize: '0.7rem', color: '#6c6', background: 'rgba(0,200,100,0.1)', padding: '2px 8px', borderRadius: '20px' }}>● Live</span>}
                </div>
                
                {/* PDF Content — iframe clipped to remove bottom whitespace */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  {isPreviewLoading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(50,54,57,0.85)', zIndex: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--success)', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Compiling LaTeX...</span>
                      </div>
                    </div>
                  )}
                  {pdfPreviewUrl ? (
                    <iframe
                      src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                      title="Resume PDF Preview"
                      scrolling="no"
                    />
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
      )}
    </>
  );
}
