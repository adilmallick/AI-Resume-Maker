"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useVault } from '@/hooks/useVault';

import VaultHeader from '@/components/vault/VaultHeader';
import GenerateResumePanel from '@/components/vault/GenerateResumePanel';
import VaultTabs from '@/components/vault/VaultTabs';
import ProfileSection from '@/components/vault/ProfileSection';
import SocialsSection from '@/components/vault/SocialsSection';
import ExperienceSection from '@/components/vault/ExperienceSection';
import ProjectSection from '@/components/vault/ProjectSection';
import EducationSection from '@/components/vault/EducationSection';
import SkillsSection from '@/components/vault/SkillsSection';
import ReviewWorkspace from '@/components/vault/ReviewWorkspace';
import ResumeImportViewer from '@/components/vault/ResumeImportViewer';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();

  const vault = useVault(token, user?.id);

  // UI
  const [activeTab, setActiveTab] = useState('profile');

  // AI Generation
  const [url, setUrl] = useState('');
  const [genStatus, setGenStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [genError, setGenError] = useState<string | null>(null);

  // Review / staging
  const [isReviewing, setIsReviewing] = useState(false);
  const [stagedProfile, setStagedProfile] = useState<any>(null);
  const [stagedExps, setStagedExps] = useState<any[]>([]);
  const [stagedProjs, setStagedProjs] = useState<any[]>([]);
  const [stagedEducations, setStagedEducations] = useState<any[]>([]);
  const [stagedSkills, setStagedSkills] = useState<{ category: string; skills: string[] }[]>([]);
  const [stagedSocials, setStagedSocials] = useState<any[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const stagingInitialized = useRef(false);
  const compiledSnapshot = useRef<string>('');

  // Resume upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [isPreviewingResume, setIsPreviewingResume] = useState(false);
  const [extractedResumeData, setExtractedResumeData] = useState<any>(null);
  const [resumeMergeStrategy, setResumeMergeStrategy] = useState<'append' | 'overwrite'>('append');

  // ── Dirty-check helpers ───────────────────────────────────────────────────
  const buildSnapshot = (p: any, e: any[], pr: any[], ed: any[], sk: any[], so: any[]) =>
    JSON.stringify({ p, e, pr, ed, sk, so });

  useEffect(() => {
    if (isReviewing) { stagingInitialized.current = false; setIsDirty(false); }
  }, [isReviewing]);

  useEffect(() => {
    if (!isReviewing) return;
    const current = buildSnapshot(stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials);
    if (!stagingInitialized.current) { compiledSnapshot.current = current; stagingInitialized.current = true; return; }
    setIsDirty(current !== compiledSnapshot.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    vault.fetchVault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, router]);

  // ── AI Generation ─────────────────────────────────────────────────────────
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = url.trim();
    if (!inputVal || !token) return;

    const applyGeneratedData = (data: any) => {
      setStagedProfile({
        first_name: vault.profile.first_name || '',
        last_name: vault.profile.last_name || '',
        location: vault.profile.location || '',
        email: user?.email || '',
        phone: vault.profile.phone || '',
        summary: data.summary || vault.profile.summary || '',
      });
      setStagedSocials([...vault.socials]);

      if (data.technical_skills?.length > 0) {
        setStagedSkills(data.technical_skills);
      } else {
        const grouped = vault.skills.reduce((acc: any, skill: any) => {
          const cat = skill.category || 'Other';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(skill.skill_name);
          return acc;
        }, {});
        setStagedSkills(Object.keys(grouped).map(cat => ({ category: cat, skills: grouped[cat] })));
      }

      setStagedEducations(vault.educations.length > 0
        ? vault.educations.map((edu: any) => ({ ...edu, dates: edu.dates || `${edu.start_date || ''} -- ${edu.end_date || 'Present'}` }))
        : [{ institution: 'University Name', degree: 'Bachelor of Science', dates: 'Aug. 2018 -- May 2022' }]
      );

      const aiExpMap: Record<string, string[]> = {};
      (data.experiences || []).forEach((ae: any) => { if (ae.company) aiExpMap[ae.company.toLowerCase()] = ae.bullets || []; });
      setStagedExps(vault.experiences.map((exp: any) => {
        const key = (exp.company_name || '').toLowerCase();
        const aiBullets = aiExpMap[key];
        return { ...exp, stagedBullets: aiBullets?.length > 0 ? aiBullets : (exp.raw_description ? exp.raw_description.split('\n').filter((s: string) => s.trim()) : []) };
      }));

      const aiProjMap: Record<string, string[]> = {};
      (data.projects || []).forEach((ap: any) => { if (ap.title) aiProjMap[ap.title.toLowerCase()] = ap.bullets || []; });
      setStagedProjs(vault.projects.map((proj: any) => {
        const key = (proj.title || '').toLowerCase();
        const aiBullets = aiProjMap[key];
        return { ...proj, tech_stack: proj.tech_stack ? proj.tech_stack.join(', ') : '', stagedBullets: aiBullets?.length > 0 ? aiBullets : (proj.raw_description ? proj.raw_description.split('\n').filter((s: string) => s.trim()) : []) };
      }));

      setIsReviewing(true);
      setGenStatus('idle');
    };

    setGenStatus('loading');
    setGenError(null);
    const isUrl = inputVal.startsWith('http://') || inputVal.startsWith('https://');
    const payload = isUrl ? { job_url: inputVal } : { job_text: inputVal };

    try {
      const res = await fetch(`${API_URL}/generate-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to generate AI outline.'); }
      applyGeneratedData(await res.json());
    } catch (err: any) {
      setGenError(err.message || 'Failed to analyze target job.');
      setGenStatus('error');
    }
  };

  // ── PDF Preview ────────────────────────────────────────────────────────────
  const handleGeneratePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const payload = {
        candidate_name: `${stagedProfile?.first_name || ''} ${stagedProfile?.last_name || ''}`.trim(),
        candidate_email: stagedProfile?.email || '',
        candidate_location: stagedProfile?.location || '',
        candidate_phone: stagedProfile?.phone || '',
        candidate_summary: stagedProfile?.summary || '',
        experiences: stagedExps.map(exp => ({
          company: exp.company_name || '', title: exp.job_title || '',
          dates: `${exp.start_date || ''} -- ${exp.end_date || 'Present'}`,
          location: exp.location || '', bullets: (exp.stagedBullets || []).filter((s: string) => s.trim()),
        })),
        projects: stagedProjs.map(proj => ({
          title: proj.title || '', role: proj.role || '',
          dates: proj.start_date ? `${proj.start_date} -- ${proj.end_date || 'Present'}` : '',
          tech_stack: proj.tech_stack || '', repository_url: proj.repository_url || '',
          live_demo_url: proj.live_demo_url || '', bullets: (proj.stagedBullets || []).filter((s: string) => s.trim()),
        })),
        education_blocks: stagedEducations.filter(e => e.institution?.trim() !== '').map(e => ({
          institution: e.institution || '', degree: e.degree || '',
          dates: e.dates || `${e.start_date || ''} -- ${e.end_date || 'Present'}`,
        })),
        grouped_skills: stagedSkills,
        social_links: stagedSocials,
      };

      const res = await fetch(`${API_URL}/generate-resume-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to compile LaTeX PDF.');

      const blob = await res.blob();
      setPdfPreviewUrl(window.URL.createObjectURL(blob));
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
    if (isReviewing && !pdfPreviewUrl) handleGeneratePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewing]);

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    const a = document.createElement('a');
    a.href = pdfPreviewUrl;
    a.download = `Tailored_Resume_${vault.profile.first_name || 'vault'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setGenStatus('success');
    setUrl('');
  };

  // ── Resume Import ─────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploadStatus('loading');
    setResumeUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/api/vault/resume/extract`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Failed to extract resume'); }
      setExtractedResumeData(await res.json());
      setIsPreviewingResume(true);
      setResumeUploadStatus('idle');
    } catch (err: any) {
      setResumeUploadError(err.message);
      setResumeUploadStatus('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveExtractedData = async () => {
    try {
      setResumeUploadStatus('loading');
      const res = await fetch(`${API_URL}/api/vault/resume/save-extracted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strategy: resumeMergeStrategy, data: extractedResumeData }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Failed to save extracted data'); }
      setIsPreviewingResume(false);
      setExtractedResumeData(null);
      setResumeUploadStatus('idle');
      vault.bustVaultCache();
      vault.fetchVault(true);
    } catch (err: any) {
      setResumeUploadError(err.message);
      setResumeUploadStatus('error');
    }
  };

  if (!token) return null;

  return (
    <>
      <div className="container" style={{ marginTop: '40px' }}>
        <VaultHeader
          resumeUploadStatus={resumeUploadStatus}
          resumeUploadError={resumeUploadError}
          fileInputRef={fileInputRef}
          onFileChange={handleFileUpload}
        />

        <GenerateResumePanel
          url={url}
          genStatus={genStatus}
          genError={genError}
          onUrlChange={setUrl}
          onSubmit={handleGenerate}
        />

        <VaultTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'stretch', width: '100%' }}>

          {/* Profile Tab */}
          <div style={{ display: activeTab === 'profile' ? 'flex' : 'none', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <ProfileSection profile={vault.profile} onSave={vault.updateProfile} />
            <SocialsSection socials={vault.socials} onSave={vault.saveSocial} onDelete={vault.deleteSocial} />
          </div>

          {/* Experience Tab */}
          <div style={{ display: activeTab === 'experience' ? 'block' : 'none', width: '100%' }}>
            <ExperienceSection experiences={vault.experiences} onSave={vault.saveExperience} onDelete={vault.deleteExperience} />
          </div>

          {/* Projects Tab */}
          <div style={{ display: activeTab === 'projects' ? 'block' : 'none', width: '100%' }}>
            <ProjectSection projects={vault.projects} onSave={vault.saveProject} onDelete={vault.deleteProject} />
          </div>

          {/* Education Tab */}
          <div style={{ display: activeTab === 'education' ? 'block' : 'none', width: '100%' }}>
            <EducationSection educations={vault.educations} onSave={vault.saveEducation} onDelete={vault.deleteEducation} />
          </div>

          {/* Skills Tab */}
          <div style={{ display: activeTab === 'skills' ? 'block' : 'none', width: '100%' }}>
            <SkillsSection skills={vault.skills} onSave={vault.saveSkill} onDelete={vault.deleteSkill} />
          </div>

        </div>
      </div>

      {/* Review Workspace Overlay */}
      {isReviewing && (
        <ReviewWorkspace
          stagedProfile={stagedProfile}
          stagedExps={stagedExps}
          stagedProjs={stagedProjs}
          stagedEducations={stagedEducations}
          stagedSkills={stagedSkills}
          stagedSocials={stagedSocials}
          setStagedProfile={setStagedProfile}
          setStagedExps={setStagedExps}
          setStagedProjs={setStagedProjs}
          setStagedEducations={setStagedEducations}
          setStagedSkills={setStagedSkills}
          setStagedSocials={setStagedSocials}
          pdfPreviewUrl={pdfPreviewUrl}
          isPreviewLoading={isPreviewLoading}
          isDirty={isDirty}
          genError={genError}
          onRecompile={handleGeneratePreview}
          onDownload={handleDownloadPdf}
          onClose={() => setIsReviewing(false)}
        />
      )}

      {/* Resume Import Overlay */}
      {isPreviewingResume && extractedResumeData && (
        <ResumeImportViewer
          extractedResumeData={extractedResumeData}
          resumeUploadStatus={resumeUploadStatus}
          resumeUploadError={resumeUploadError}
          resumeMergeStrategy={resumeMergeStrategy}
          onStrategyChange={setResumeMergeStrategy}
          onSave={handleSaveExtractedData}
          onClose={() => setIsPreviewingResume(false)}
        />
      )}
    </>
  );
}
