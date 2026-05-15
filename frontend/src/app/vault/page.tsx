"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/components/RichTextEditor';
import Modal from '@/components/Modal';
import LaTeXEditor from '@/components/LaTeXEditor';
import { ATSResult } from '@/types/ats';
import { formatDateRange } from '@/lib/dateUtils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function VaultPage() {
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

  // Saving States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingExp, setIsSavingExp] = useState(false);
  const [isSavingProj, setIsSavingProj] = useState(false);
  const [isSavingEdu, setIsSavingEdu] = useState(false);
  const [isSavingSkill, setIsSavingSkill] = useState(false);
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Editing States
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Form States
  const [profForm, setProfForm] = useState({ first_name: '', last_name: '', email: '', location: '', phone: '', summary: '' });
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
  const [stagedSkills, setStagedSkills] = useState<{ category: string, skills: string[] }[]>([]);
  const [stagedSocials, setStagedSocials] = useState<any[]>([]);
  const [stagedTemplateConfig, setStagedTemplateConfig] = useState<{ font_size: string, font_family: string, section_order: string[] }>({ font_size: "11pt", font_family: "sans-serif", section_order: ["summary", "experiences", "education", "skills", "projects"] });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "latex">("visual");
  const [rawLatex, setRawLatex] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const stagingInitialized = useRef(false);
  // Stores JSON of staged data at the time of last compile (or initial load)
  const compiledSnapshot = useRef<string>('');

  // ATS
  const [atsStatus, setAtsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [isAtsDirty, setIsAtsDirty] = useState(false);
  const [openTitleIdx, setOpenTitleIdx] = useState<number | null>(null);
  const [isAtsPanelOpen, setIsAtsPanelOpen] = useState(true);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const atsSnapshot = useRef<string>('');
  const atsInitialized = useRef(false);

  // Resume Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);

  // Resume Preview State
  const [isPreviewingResume, setIsPreviewingResume] = useState(false);
  const [extractedResumeData, setExtractedResumeData] = useState<any>(null);
  const [tailoredResumeData, setTailoredResumeData] = useState<any>(null);
  const [activeReviewMode, setActiveReviewMode] = useState<'ai' | 'original'>('ai');
  // Strategy is always overwrite now

  // Section Ordering Drag and Drop State
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
    const newOrder = [...(stagedTemplateConfig.section_order || [])];
    const draggedItemContent = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOverItem.current, 0, draggedItemContent);
    setStagedTemplateConfig({ ...stagedTemplateConfig, section_order: newOrder });
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Bullet Ordering Drag and Drop State
  const [bulletDraggedItem, setBulletDraggedItem] = useState<{ type: 'exp' | 'proj', parentIdx: number, bulletIdx: number } | null>(null);
  const [bulletDragOverItem, setBulletDragOverItem] = useState<{ type: 'exp' | 'proj', parentIdx: number, bulletIdx: number } | null>(null);
  const [bulletDragEnabledId, setBulletDragEnabledId] = useState<string | null>(null);

  const handleBulletDragStart = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}-${parentIdx}-${bulletIdx}`);
    setBulletDraggedItem({ type, parentIdx, bulletIdx });
  };

  const handleBulletDragOver = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.preventDefault();
    if (bulletDraggedItem && bulletDraggedItem.type === type && bulletDraggedItem.parentIdx === parentIdx) {
      setBulletDragOverItem({ type, parentIdx, bulletIdx });
    }
  };

  const handleBulletDrop = (e: React.DragEvent, type: 'exp' | 'proj', parentIdx: number, bulletIdx: number) => {
    e.preventDefault();
    if (bulletDraggedItem && bulletDraggedItem.type === type && bulletDraggedItem.parentIdx === parentIdx && bulletDraggedItem.bulletIdx !== bulletIdx) {
      if (type === 'exp') {
        const u = [...stagedExps];
        const items = [...u[parentIdx].stagedBullets];
        const [reorderedItem] = items.splice(bulletDraggedItem.bulletIdx, 1);
        items.splice(bulletIdx, 0, reorderedItem);
        u[parentIdx].stagedBullets = items;
        setStagedExps(u);
      } else {
        const u = [...stagedProjs];
        const items = [...u[parentIdx].stagedBullets];
        const [reorderedItem] = items.splice(bulletDraggedItem.bulletIdx, 1);
        items.splice(bulletIdx, 0, reorderedItem);
        u[parentIdx].stagedBullets = items;
        setStagedProjs(u);
      }
    }
    setBulletDraggedItem(null);
    setBulletDragOverItem(null);
  };

  const handleBulletDragEnd = () => {
    setBulletDraggedItem(null);
    setBulletDragOverItem(null);
    setBulletDragEnabledId(null);
  };

  const buildSnapshot = (profile: any, exps: any[], projs: any[], edus: any[], skills: any[], socials: any[], tconfig: any) =>
    JSON.stringify({ profile, exps, projs, edus, skills, socials, tconfig });

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
    const current = buildSnapshot(stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials, stagedTemplateConfig);
    if (!stagingInitialized.current) {
      // Capture the baseline (initial AI-generated staging)
      compiledSnapshot.current = current;
      stagingInitialized.current = true;
      return;
    }
    setIsDirty(current !== compiledSnapshot.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials, stagedTemplateConfig]);

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

  const fetchVault = async (forceRefresh = true) => {
    // Always fetch from server to prevent desync bugs with ghost IDs
    /*
    if (!forceRefresh) {
      const cached = loadVaultCache();
      if (cached) {
        setProfile(cached.profile ?? {});
        setProfForm({
          first_name: cached.profile?.first_name || '',
          last_name: cached.profile?.last_name || '',
          email: cached.profile?.email || '',
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
    */
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let p = {};
      const profRes = await fetch(`${API_URL}/api/vault/profile`, { headers });
      if (profRes.ok) {
        p = await profRes.json();
        setProfile(p);
        setProfForm({ first_name: (p as any).first_name || '', last_name: (p as any).last_name || '', email: (p as any).email || '', location: (p as any).location || '', phone: (p as any).phone || '', summary: (p as any).summary || '' });
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
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/vault/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profForm)
      });
      if (res.ok) {
        const updatedProfile = await res.json();
        setProfile(updatedProfile);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, profile: updatedProfile });
        setIsEditingProfile(false);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveExp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExp(true);
    try {
      const url = editingExpId ? `${API_URL}/api/vault/experiences/${editingExpId}` : `${API_URL}/api/vault/experiences`;
      const method = editingExpId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...expForm,
          start_date: expForm.start_date || new Date().toISOString().split('T')[0],
          end_date: expForm.end_date || null
        })
      });
      if (res.ok) {
        const savedExp = await res.json();
        const updated = editingExpId ? experiences.map(exp => exp.id === editingExpId ? savedExp : exp) : [...experiences, savedExp];
        setExperiences(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, experiences: updated });
        setIsAddingExp(false);
        setEditingExpId(null);
        setExpForm({ company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' });
      }
    } finally {
      setIsSavingExp(false);
    }
  };

  const handleEditExp = (exp: any) => {
    setEditingExpId(exp.id);
    setExpForm({
      company_name: exp.company_name || '',
      job_title: exp.job_title || '',
      location: exp.location || '',
      start_date: exp.start_date || '',
      end_date: exp.end_date || '',
      raw_description: exp.raw_description || ''
    });
    setIsAddingExp(true);
  };

  const handleDeleteExp = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this experience?")) return;
    try {
      const res = await fetch(`${API_URL}/api/vault/experiences/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updated = experiences.filter(e => e.id !== id);
        setExperiences(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, experiences: updated });
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveProj = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProj(true);
    try {
      const url = editingProjId ? `${API_URL}/api/vault/projects/${editingProjId}` : `${API_URL}/api/vault/projects`;
      const method = editingProjId ? 'PUT' : 'POST';
      const techStackArr = typeof projForm.tech_stack === 'string' ? projForm.tech_stack.split(',').map(s => s.trim()).filter(s => s) : projForm.tech_stack;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...projForm,
          start_date: projForm.start_date || null,
          end_date: projForm.end_date || null,
          tech_stack: techStackArr
        })
      });
      if (res.ok) {
        const savedProj = await res.json();
        const updated = editingProjId ? projects.map(p => p.id === editingProjId ? savedProj : p) : [...projects, savedProj];
        setProjects(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, projects: updated });
        setIsAddingProj(false);
        setEditingProjId(null);
        setProjForm({ title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' });
      }
    } finally {
      setIsSavingProj(false);
    }
  };

  const handleEditProj = (proj: any) => {
    setEditingProjId(proj.id);
    setProjForm({
      title: proj.title || '',
      role: proj.role || '',
      tech_stack: (proj.tech_stack || []).join(', '),
      repository_url: proj.repository_url || '',
      live_demo_url: proj.live_demo_url || '',
      start_date: proj.start_date || '',
      end_date: proj.end_date || '',
      raw_description: proj.raw_description || ''
    });
    setIsAddingProj(true);
  };

  const handleDeleteProj = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch(`${API_URL}/api/vault/projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, projects: updated });
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdu(true);
    try {
      const url = editingEduId ? `${API_URL}/api/vault/educations/${editingEduId}` : `${API_URL}/api/vault/educations`;
      const method = editingEduId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...eduForm, end_date: eduForm.end_date || null })
      });
      if (res.ok) {
        const savedEdu = await res.json();
        const updated = editingEduId ? educations.map(e => e.id === editingEduId ? savedEdu : e) : [...educations, savedEdu];
        setEducations(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, educations: updated });
        setIsAddingEdu(false);
        setEditingEduId(null);
        setEduForm({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' });
      }
    } finally {
      setIsSavingEdu(false);
    }
  };

  const handleEditEdu = (edu: any) => {
    setEditingEduId(edu.id);
    setEduForm({
      institution: edu.institution || '',
      degree: edu.degree || '',
      field_of_study: edu.field_of_study || '',
      start_date: edu.start_date || '',
      end_date: edu.end_date || ''
    });
    setIsAddingEdu(true);
  };

  const handleDeleteEdu = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this education entry?")) return;
    try {
      const res = await fetch(`${API_URL}/api/vault/educations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updated = educations.filter(e => e.id !== id);
        setEducations(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, educations: updated });
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSocial(true);
    try {
      const url = editingSocialId ? `${API_URL}/api/vault/socials/${editingSocialId}` : `${API_URL}/api/vault/socials`;
      const method = editingSocialId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(socialForm)
      });
      if (res.ok) {
        const savedSocial = await res.json();
        const updated = editingSocialId ? socials.map(s => s.id === editingSocialId ? savedSocial : s) : [...socials, savedSocial];
        setSocials(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, socials: updated });
        setIsAddingSocial(false);
        setEditingSocialId(null);
        setSocialForm({ platform_name: '', url: '', display_text: '' });
      }
    } finally {
      setIsSavingSocial(false);
    }
  };

  const handleEditSocial = (soc: any) => {
    setEditingSocialId(soc.id);
    setSocialForm({
      platform_name: soc.platform_name || '',
      url: soc.url || '',
      display_text: soc.display_text || ''
    });
    setIsAddingSocial(true);
  };

  const handleDeleteSocial = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this social link?")) return;
    try {
      const res = await fetch(`${API_URL}/api/vault/socials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updated = socials.filter(s => s.id !== id);
        setSocials(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, socials: updated });
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSkill(true);
    try {
      if (editingSkillId) {
        const res = await fetch(`${API_URL}/api/vault/skills/${editingSkillId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ skill_name: skillForm.skill_name, category: skillForm.category })
        });
        if (res.ok) {
          const savedSkill = await res.json();
          const updated = skills.map(s => s.id === editingSkillId ? savedSkill : s);
          setSkills(updated);
          const cached = loadVaultCache() || {};
          saveVaultCache({ ...cached, skills: updated });
        }
      } else {
        // Allow comma separated skills addition for faster grouping
        const skillsToAdd = skillForm.skill_name.split(',').map(s => s.trim()).filter(s => s);
        const newSkills: any[] = [];
        for (const s of skillsToAdd) {
          const res = await fetch(`${API_URL}/api/vault/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ skill_name: s, category: skillForm.category })
          });
          if (res.ok) {
            newSkills.push(await res.json());
          }
        }
        if (newSkills.length > 0) {
          const updated = [...skills, ...newSkills];
          setSkills(updated);
          const cached = loadVaultCache() || {};
          saveVaultCache({ ...cached, skills: updated });
        }
      }
      setIsAddingSkill(false);
      setEditingSkillId(null);
      setSkillForm({ skill_name: '', category: '' });
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleEditSkill = (skill: any) => {
    setEditingSkillId(skill.id);
    setSkillForm({ skill_name: skill.skill_name || '', category: skill.category || '' });
    setIsAddingSkill(true);
  };

  const handleDeleteSkill = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this skill?")) return;
    try {
      const res = await fetch(`${API_URL}/api/vault/skills/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const updated = skills.filter(s => s.id !== id);
        setSkills(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, skills: updated });
      }
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeUploadStatus("loading");
    setResumeUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/vault/resume/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to extract resume");
      }

      const data = await res.json();
      setExtractedResumeData(data);
      setIsPreviewingResume(true);
      setResumeUploadStatus("idle");
    } catch (err: any) {
      setResumeUploadError(err.message);
      setResumeUploadStatus("error");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveExtractedData = async () => {
    try {
      setResumeUploadStatus("loading");
      const res = await fetch(`${API_URL}/api/vault/resume/save-extracted`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          strategy: "overwrite",
          data: extractedResumeData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save extracted data");
      }

      setIsPreviewingResume(false);
      setExtractedResumeData(null);
      setResumeUploadStatus("idle");
      bustVaultCache();
      fetchVault(true);
    } catch (err: any) {
      setResumeUploadError(err.message);
      setResumeUploadStatus("error");
    }
  };

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
    setActiveReviewMode('ai');
    setPdfPreviewUrl(null);
  };

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
    if (!atsInitialized.current) return;
    setIsAtsDirty(current !== atsSnapshot.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedProfile?.summary, stagedSkills, stagedExps, stagedProjs]);

  const handleCheckATS = async () => {
    if (!token) return;
    setAtsStatus('loading');
    setIsAtsPanelOpen(true);
    try {
      const payload = {
        job_input: tailoredResumeData?.job_description || url,
        resume_data: {
          profile: stagedProfile,
          experiences: stagedExps,
          projects: stagedProjs,
          educations: stagedEducations,
          skills: stagedSkills
        }
      };

      const res = await fetch(`${API_URL}/api/ats/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("ATS Score error:", err);
        setAtsStatus('error');
        return;
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

  useEffect(() => {
    if (isReviewing && url) {
      handleCheckATS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewing]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = url.trim();
    if (!inputVal || !token) return;

    setGenStatus("loading");
    setGenError(null);

    const isUrl = inputVal.startsWith("http://") || inputVal.startsWith("https://");
    const payload = isUrl ? { job_url: inputVal } : { job_text: inputVal };

    try {
      const res = await fetch(`${API_URL}/generate-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate AI outline.");
      }

      const data = await res.json();
      setTailoredResumeData(data);
      applyGeneratedData(data);
    } catch (err: any) {
      setGenError(err.message || "Failed to analyze target job.");
      setGenStatus("error");
    }
  };
  const extractBulletsFromHtml = (htmlStr: string | null | undefined): string[] => {
    if (!htmlStr) return [];

    // Quick plain text check
    if (!htmlStr.includes('<')) {
      return htmlStr.split('\n').filter(s => s.trim() !== '');
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlStr, 'text/html');

      const lis = doc.querySelectorAll('li');
      if (lis.length > 0) return Array.from(lis).map(li => li.innerHTML.trim());

      const ps = doc.querySelectorAll('p');
      if (ps.length > 0) return Array.from(ps).map(p => p.innerHTML.trim());

      return doc.body.innerHTML.split(/<br\s*\/?>/).map(s => s.trim()).filter(s => s);
    } catch (e) {
      return htmlStr.replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim() !== '');
    }
  };

  const handlePreviewVault = () => {
    setStagedProfile(profile);
    setStagedExps(experiences.map(e => ({ ...e, stagedBullets: e.bullets ? [...e.bullets] : extractBulletsFromHtml(e.raw_description) })));
    setStagedProjs(projects.map(p => ({ ...p, stagedBullets: p.bullets ? [...p.bullets] : extractBulletsFromHtml(p.raw_description) })));
    setStagedEducations(educations);

    const grouped = skills.reduce((acc: any, skill: any) => {
      const cat = skill.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill.skill_name);
      return acc;
    }, {});
    setStagedSkills(Object.keys(grouped).map(cat => ({ category: cat, skills: grouped[cat] })));

    setStagedSocials(socials);
    setIsReviewing(true);
    setGenStatus("success");
    setActiveReviewMode('original');
    setPdfPreviewUrl(null);
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

  const formatDisplayDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    return dateStr.replace(/\b(\d{4}-\d{2}(?:-\d{2})?)\b/g, (match) => {
      const d = new Date(match);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      return match;
    });
  };

  const buildPdfPayload = () => {
    const formattedExps = stagedExps.map((exp) => ({
      company: exp.company_name || '',
      title: exp.job_title || '',
      dates: `${formatDisplayDate(exp.start_date)} -- ${formatDisplayDate(exp.end_date) || 'Present'}`.replace(/^ -- /, ''),
      location: exp.location || '',
      bullets: (exp.stagedBullets || []).filter((s: string) => s.trim())
    }));

    const formattedProjs = stagedProjs.map((proj) => ({
      title: proj.title || '',
      role: proj.role || '',
      dates: proj.start_date ? `${formatDisplayDate(proj.start_date)} -- ${formatDisplayDate(proj.end_date) || 'Present'}` : '',
      tech_stack: Array.isArray(proj.tech_stack) ? proj.tech_stack.join(', ') : (proj.tech_stack || ''),
      repository_url: proj.repository_url || '',
      live_demo_url: proj.live_demo_url || '',
      bullets: (proj.stagedBullets || []).filter((s: string) => s.trim())
    }));

    return {
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
        dates: formatDisplayDate(e.dates) || `${formatDisplayDate(e.start_date)} -- ${formatDisplayDate(e.end_date) || 'Present'}`.replace(/^ -- /, '')
      })),
      grouped_skills: stagedSkills,
      social_links: stagedSocials,
      template_config: stagedTemplateConfig
    };
  };

  const toggleEditorMode = async (mode: "visual" | "latex") => {
    if (mode === "latex") {
      setIsPreviewLoading(true);
      try {
        const payload = buildPdfPayload();
        const res = await fetch(`${API_URL}/preview-latex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          setRawLatex(data.latex);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsPreviewLoading(false);
      }
    }
    setEditorMode(mode);
  };

  const handleGeneratePreview = async () => {
    setIsPreviewLoading(true);
    try {
      if (editorMode === "latex") {
        const res = await fetch(`${API_URL}/compile-raw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latex_source: rawLatex })
        });
        if (!res.ok) throw new Error("Failed to compile raw LaTeX.");
        const blob = await res.blob();
        const newUrl = window.URL.createObjectURL(blob);
        setPdfPreviewUrl(newUrl);
      } else {
        const payload = buildPdfPayload();
        const res = await fetch(`${API_URL}/generate-resume-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to compile LaTeX PDF.");
        const blob = await res.blob();
        const newUrl = window.URL.createObjectURL(blob);
        setPdfPreviewUrl(newUrl);
      }

      compiledSnapshot.current = buildSnapshot(stagedProfile, stagedExps, stagedProjs, stagedEducations, stagedSkills, stagedSocials, stagedTemplateConfig);
      setIsDirty(false);
      setGenError(null);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (isReviewing && !pdfPreviewUrl && stagedProfile) {
      handleGeneratePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewing, pdfPreviewUrl]);

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
  const subCardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' };
  const subCardLabel: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const removeBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.72rem', opacity: 0.8 };

  return (
    <>
      <div className="container" style={{ marginTop: '40px' }}>
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 className="title-main" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Career Vault</h1>
            <p className="title-sub">Manage the master copy of your professional journey here.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }} />
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={resumeUploadStatus === "loading"} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {resumeUploadStatus === "loading" ? "⏳ Analyzing Resume..." : "📄 Upload Resume"}
              </button>
              {resumeUploadStatus === "error" && resumeUploadError && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', textAlign: 'right' }}>{resumeUploadError}</p>}
            </div>
            <button className="btn btn-primary" onClick={handlePreviewVault} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)' }}>
              👁 Preview Resume
            </button>
          </div>
        </div>

        <div className="dashboard-grid">

          {/* Profile Column */}
          <div className="profile-column">
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h3 style={{ marginBottom: '20px', color: 'var(--accent-light)' }}>Profile Core</h3>

              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile}>
                  <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="First Name" value={profForm.first_name} onChange={e => setProfForm({ ...profForm, first_name: e.target.value })} required />
                  <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Last Name" value={profForm.last_name} onChange={e => setProfForm({ ...profForm, last_name: e.target.value })} required />
                  <input className="form-input" type="email" style={{ width: '100%', marginBottom: '10px' }} placeholder="Email" value={profForm.email} onChange={e => setProfForm({ ...profForm, email: e.target.value })} />
                  <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Location" value={profForm.location} onChange={e => setProfForm({ ...profForm, location: e.target.value })} />
                  <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Phone" value={profForm.phone} onChange={e => setProfForm({ ...profForm, phone: e.target.value })} />
                  <div style={{ marginBottom: '10px' }}>
                    <RichTextEditor value={profForm.summary} onChange={(val) => setProfForm({ ...profForm, summary: val })} placeholder="Summary" />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '10px' }} disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save"}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setIsEditingProfile(false)} style={{ padding: '10px' }} disabled={isSavingProfile}>Cancel</button>
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
                    <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: profile.summary || 'No summary provided.' }} />
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
                <form onSubmit={handleSaveSocial} style={{ marginBottom: '15px' }}>
                  <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="Platform (e.g. GitHub)" value={socialForm.platform_name} onChange={e => setSocialForm({ ...socialForm, platform_name: e.target.value })} required />
                  <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="URL *" value={socialForm.url} onChange={e => setSocialForm({ ...socialForm, url: e.target.value })} required />
                  <input className="form-input" style={{ width: '100%', marginBottom: '8px', padding: '8px' }} placeholder="Display Text (Optional)" value={socialForm.display_text} onChange={e => setSocialForm({ ...socialForm, display_text: e.target.value })} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '4px' }} disabled={isSavingSocial}>{isSavingSocial ? "Saving..." : "Save"}</button>
                    <button className="btn btn-secondary" type="button" onClick={() => { setIsAddingSocial(false); setEditingSocialId(null); setSocialForm({ platform_name: '', url: '', display_text: '' }); }} style={{ flex: 1, padding: '4px' }} disabled={isSavingSocial}>Cancel</button>
                  </div>
                </form>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {socials.length === 0 && !isAddingSocial ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No socials listed.</p> : null}
                {socials.map(soc => (
                  <div key={soc.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>{soc.platform_name}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleEditSocial(soc)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDeleteSocial(soc.id)}>Del</button>
                      </div>
                    </div>
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

              <form onSubmit={handleGenerate} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
                <textarea
                  className="form-input"
                  style={{ flex: 1, minHeight: '60px', maxHeight: '300px', resize: 'vertical' }}
                  placeholder="Paste Target Job URL (e.g., https://...) OR raw Job Description text"
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
                <Modal isOpen={isAddingExp} onClose={() => { setIsAddingExp(false); setEditingExpId(null); setExpForm({ company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' }); }} title={editingExpId ? 'Edit Experience' : 'Add New Experience'}>
                  <form onSubmit={handleSaveExp} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" placeholder="Company Name *" value={expForm.company_name} onChange={e => setExpForm({ ...expForm, company_name: e.target.value })} required />
                      <input className="form-input" placeholder="Job Title *" value={expForm.job_title} onChange={e => setExpForm({ ...expForm, job_title: e.target.value })} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" placeholder="Location" value={expForm.location} onChange={e => setExpForm({ ...expForm, location: e.target.value })} />
                      <input className="form-input" type="date" placeholder="Start Date" value={expForm.start_date} onChange={e => setExpForm({ ...expForm, start_date: e.target.value })} required />
                      <input className="form-input" type="date" placeholder="End Date" value={expForm.end_date} onChange={e => setExpForm({ ...expForm, end_date: e.target.value })} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={labelStyle}>Raw Bullet Points or Description</label>
                      <RichTextEditor value={expForm.raw_description} onChange={(val) => setExpForm({ ...expForm, raw_description: val })} placeholder="Raw Bullet Points or Description" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" type="submit" disabled={isSavingExp}>{isSavingExp ? "Saving..." : "Save Experience"}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => { setIsAddingExp(false); setEditingExpId(null); setExpForm({ company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' }); }} disabled={isSavingExp}>Cancel</button>
                    </div>
                  </form>
                </Modal>
              )}

              <div className="dashboard-list">
                {experiences.length === 0 && !isAddingExp ? (
                  <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No experiences logged.</div>
                ) : null}
                {experiences.map(exp => (
                  <div key={exp.id} className="glass-card" style={{ padding: '24px 40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{exp.job_title} <span style={{ color: 'var(--accent-light)', fontWeight: 400 }}>@ {exp.company_name}</span></h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge">{formatDateRange(exp.start_date, exp.end_date)}</span>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleEditExp(exp)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDeleteExp(exp.id)}>Delete</button>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: exp.raw_description || '' }} />
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
                <Modal isOpen={isAddingProj} onClose={() => { setIsAddingProj(false); setEditingProjId(null); setProjForm({ title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' }); }} title={editingProjId ? 'Edit Project' : 'Add New Project'}>
                  <form onSubmit={handleSaveProj} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" placeholder="Project Title *" value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} required />
                      <input className="form-input" placeholder="Your Role (Optional)" value={projForm.role} onChange={e => setProjForm({ ...projForm, role: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" type="date" placeholder="Start Date" value={projForm.start_date} onChange={e => setProjForm({ ...projForm, start_date: e.target.value })} />
                      <input className="form-input" type="date" placeholder="End Date" value={projForm.end_date} onChange={e => setProjForm({ ...projForm, end_date: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" placeholder="Repository URL (e.g. GitHub)" value={projForm.repository_url} onChange={e => setProjForm({ ...projForm, repository_url: e.target.value })} />
                      <input className="form-input" placeholder="Live Demo URL (Optional)" value={projForm.live_demo_url} onChange={e => setProjForm({ ...projForm, live_demo_url: e.target.value })} />
                    </div>
                    <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Tech Stack (comma separated: React, Node.js, NextJS)" value={projForm.tech_stack} onChange={e => setProjForm({ ...projForm, tech_stack: e.target.value })} />
                    <div style={{ marginBottom: '15px' }}>
                      <label style={labelStyle}>Project Description or Bullets</label>
                      <RichTextEditor value={projForm.raw_description} onChange={(val) => setProjForm({ ...projForm, raw_description: val })} placeholder="Project Description or Bullets" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" type="submit" disabled={isSavingProj}>{isSavingProj ? "Saving..." : "Save Project"}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => { setIsAddingProj(false); setEditingProjId(null); setProjForm({ title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' }); }} disabled={isSavingProj}>Cancel</button>
                    </div>
                  </form>
                </Modal>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {projects.length === 0 && !isAddingProj ? (
                  <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No projects logged.</div>
                ) : null}
                {projects.map(proj => (
                  <div key={proj.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px 40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{proj.title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0' }}>{proj.role}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleEditProj(proj)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDeleteProj(proj.id)}>Delete</button>
                      </div>
                    </div>
                    {proj.raw_description && (
                      <div className="prose prose-sm prose-invert max-w-none mt-2 text-sm text-[var(--text-muted)]" dangerouslySetInnerHTML={{ __html: proj.raw_description }} />
                    )}
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {proj.tech_stack.map((tech: string) => (
                          <span key={tech} className="badge" style={{ fontSize: '0.75rem', background: 'var(--border-color)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>{tech}</span>
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
                <Modal isOpen={isAddingEdu} onClose={() => { setIsAddingEdu(false); setEditingEduId(null); setEduForm({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' }); }} title={editingEduId ? 'Edit Education Route' : 'Add Education Route'}>
                  <form onSubmit={handleSaveEdu} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-input" placeholder="Institution *" value={eduForm.institution} onChange={e => setEduForm({ ...eduForm, institution: e.target.value })} required />
                      <input className="form-input" placeholder="Degree *" value={eduForm.degree} onChange={e => setEduForm({ ...eduForm, degree: e.target.value })} required />
                    </div>
                    <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Field of Study *" value={eduForm.field_of_study} onChange={e => setEduForm({ ...eduForm, field_of_study: e.target.value })} required />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                      <input className="form-input" type="date" placeholder="Start Date *" value={eduForm.start_date} onChange={e => setEduForm({ ...eduForm, start_date: e.target.value })} required />
                      <input className="form-input" type="date" placeholder="End Date (Optional)" value={eduForm.end_date} onChange={e => setEduForm({ ...eduForm, end_date: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" type="submit" disabled={isSavingEdu}>{isSavingEdu ? "Saving..." : "Save Education"}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => { setIsAddingEdu(false); setEditingEduId(null); setEduForm({ institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' }); }} disabled={isSavingEdu}>Cancel</button>
                    </div>
                  </form>
                </Modal>
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
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge">{formatDateRange(edu.start_date, edu.end_date)}</span>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleEditEdu(edu)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => handleDeleteEdu(edu.id)}>Delete</button>
                      </div>
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
                <Modal isOpen={isAddingSkill} onClose={() => { setIsAddingSkill(false); setEditingSkillId(null); setSkillForm({ skill_name: '', category: '' }); }} title={editingSkillId ? 'Edit Skill' : 'Batch Add Technical Skills'}>
                  <form onSubmit={handleSaveSkill} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <input className="form-input" style={{ width: '200px' }} placeholder="Category (e.g. Languages) *" value={skillForm.category} onChange={e => setSkillForm({ ...skillForm, category: e.target.value })} required />
                      <input className="form-input" style={{ flex: 1 }} placeholder="Comma Separated Skills *" value={skillForm.skill_name} onChange={e => setSkillForm({ ...skillForm, skill_name: e.target.value })} required />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" type="submit" disabled={isSavingSkill}>{isSavingSkill ? "Saving..." : "Save Skills"}</button>
                      <button className="btn btn-secondary" type="button" onClick={() => { setIsAddingSkill(false); setEditingSkillId(null); setSkillForm({ skill_name: '', category: '' }); }} disabled={isSavingSkill}>Cancel</button>
                    </div>
                  </form>
                </Modal>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                {skills.length === 0 && !isAddingSkill ? <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No skills tracked.</div> : null}
                {Object.entries(
                  skills.reduce((acc: any, skill: any) => {
                    const cat = skill.category || "Other";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(skill);
                    return acc;
                  }, {})
                ).map(([cat, sks]: [string, any]) => (
                  <div key={`v-skill-${cat}`} className="glass-card" style={{ padding: '15px' }}>
                    <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '5px' }}>{cat}</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(sks as any[]).map(skill => (
                        <span key={skill.id} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {skill.skill_name}
                          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} onClick={() => handleDeleteSkill(skill.id)}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {isReviewing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>

          <div className="review-header" style={{ padding: '15px 30px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '1.4rem' }}>✨</span> Review PDF Outline</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Edits will NOT overwrite your master Vault.</span>
            </div>
            <div className="review-header-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsReviewing(false)} style={{ padding: '6px 15px', fontSize: '0.9rem' }}>Cancel</button>
              
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

          <div className="review-workspace-layout">

            {/* ─── Left: Editor Panel (55%) ─── */}
            <div className="review-editor-panel custom-scrollbar">

              {/* Job Details Accordion */}
              {url && (
                <div style={{ marginBottom: '20px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', position: 'relative' }}>
                  <div 
                    role="button"
                    tabIndex={0}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'transparent', cursor: 'pointer', textAlign: 'left', userSelect: 'none', transition: 'background 0.2s ease', borderRadius: isJobDetailsOpen ? '9px 9px 0 0' : '9px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(108, 93, 211, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={(e) => { e.stopPropagation(); setIsJobDetailsOpen(!isJobDetailsOpen); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsJobDetailsOpen(!isJobDetailsOpen); } }}
                  >
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      Target Job Details
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isJobDetailsOpen ? '▲ Hide' : '▼ Show'}</span>
                  </div>

                  {isJobDetailsOpen && (
                    <div style={{ padding: '0 16px 16px', fontSize: '0.85rem', color: 'var(--text-muted)', maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
                      {url.startsWith('http') && (
                        <div style={{ marginBottom: '12px' }}>
                          <strong>Job URL:</strong> <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{url}</a>
                        </div>
                      )}
                      
                      {tailoredResumeData?.job_data ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {tailoredResumeData.job_data.title && <span style={{ background: 'rgba(108,93,211,0.15)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>{tailoredResumeData.job_data.title}</span>}
                            {tailoredResumeData.job_data.company && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>🏢 {tailoredResumeData.job_data.company}</span>}
                            {tailoredResumeData.job_data.location && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>📍 {tailoredResumeData.job_data.location}</span>}
                            {tailoredResumeData.job_data.job_type && <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>💼 {tailoredResumeData.job_data.job_type}</span>}
                            {tailoredResumeData.job_data.salary && <span style={{ background: 'rgba(56,226,152,0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '12px' }}>💰 {tailoredResumeData.job_data.salary}</span>}
                          </div>
                          
                          {tailoredResumeData.job_data.description && (
                            <div>
                              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Overview</strong>
                              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap' }}>
                                {tailoredResumeData.job_data.description}
                              </div>
                            </div>
                          )}

                          {tailoredResumeData.job_data.requirements?.length > 0 && (
                            <div>
                              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Requirements</strong>
                              <ul style={{ margin: 0, paddingLeft: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 10px 10px 30px' }}>
                                {tailoredResumeData.job_data.requirements.map((req: string, i: number) => (
                                  <li key={i} style={{ marginBottom: '4px' }}>{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <strong style={{ color: 'var(--text-main)' }}>Extracted Job Description:</strong><br />
                          <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap' }}>
                            {tailoredResumeData?.job_description || (url.startsWith('http') ? 'Loading job description...' : url)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ATS Score Panel */}
              {(atsStatus === 'loading' || atsResult || atsStatus === 'error') && (
                <div style={{ marginBottom: '20px', background: 'rgba(108, 93, 211, 0.08)', border: '1px solid var(--accent)', borderRadius: '10px', position: 'relative' }}>
                  <div 
                    role="button"
                    tabIndex={0}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'transparent', cursor: 'pointer', textAlign: 'left', userSelect: 'none', transition: 'background 0.2s ease', borderRadius: isAtsPanelOpen ? '9px 9px 0 0' : '9px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(108, 93, 211, 0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={(e) => { e.stopPropagation(); setIsAtsPanelOpen(!isAtsPanelOpen); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsAtsPanelOpen(!isAtsPanelOpen); } }}
                  >
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-light)' }}>
                      ATS Match Score {atsResult ? `(${atsResult.overall_score}%)` : ''}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAtsPanelOpen ? '▲ Hide' : '▼ Show'}</span>
                  </div>

                  {isAtsPanelOpen && (
                    <div style={{ padding: '0 16px 16px' }}>
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
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                {/* Mode Toggle */}
                <div style={{ display: 'flex', background: 'var(--glass-bg)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '3px' }}>
                  <button onClick={() => toggleEditorMode('visual')} style={{ padding: '5px 16px', fontSize: '0.85rem', borderRadius: '16px', background: editorMode === 'visual' ? 'var(--accent)' : 'transparent', color: editorMode === 'visual' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    Visual Editor
                  </button>
                  <button onClick={() => toggleEditorMode('latex')} style={{ padding: '5px 16px', fontSize: '0.85rem', borderRadius: '16px', background: editorMode === 'latex' ? 'var(--accent)' : 'transparent', color: editorMode === 'latex' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    Advanced (LaTeX)
                  </button>
                </div>

                {/* Data Content Toggle */}
                {tailoredResumeData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Data:</span>
                    <div style={{ display: 'flex', background: 'var(--glass-bg)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '3px' }}>
                      <button onClick={handlePreviewVault} style={{ padding: '4px 14px', fontSize: '0.8rem', borderRadius: '16px', background: activeReviewMode === 'original' ? 'var(--accent)' : 'transparent', color: activeReviewMode === 'original' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        Original
                      </button>
                      <button onClick={() => applyGeneratedData(tailoredResumeData)} style={{ padding: '4px 14px', fontSize: '0.8rem', borderRadius: '16px', background: activeReviewMode === 'ai' ? 'var(--success)' : 'transparent', color: activeReviewMode === 'ai' ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                        AI Tailored
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {editorMode === 'visual' ? (
                <>
                  {/* Template Settings Block */}
                  <div style={{ marginBottom: '20px' }}>
                    <span style={sectionLabel}>Template Settings</span>
                    <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Font Style</label>
                          <select className="form-input" style={inputStyle} value={stagedTemplateConfig.font_family} onChange={e => setStagedTemplateConfig({ ...stagedTemplateConfig, font_family: e.target.value })}>
                            <option value="sans-serif">Modern (Sans-Serif)</option>
                            <option value="serif">Classic (Serif)</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Font Size</label>
                          <select className="form-input" style={inputStyle} value={stagedTemplateConfig.font_size} onChange={e => setStagedTemplateConfig({ ...stagedTemplateConfig, font_size: e.target.value })}>
                            <option value="10pt">Small (10pt)</option>
                            <option value="11pt">Medium (11pt)</option>
                            <option value="12pt">Large (12pt)</option>
                          </select>
                        </div>
                      </div>

                      {/* Section Ordering UI */}
                      <div>
                        <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Section Order (Drag to Reorder)</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {stagedTemplateConfig.section_order?.map((secName, idx) => (
                            <div 
                              key={secName} 
                              draggable
                              onDragStart={() => (dragItem.current = idx)}
                              onDragEnter={() => (dragOverItem.current = idx)}
                              onDragEnd={handleSort}
                              onDragOver={(e) => e.preventDefault()}
                              style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--border-color)', cursor: 'grab', transition: 'transform 0.1s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            >
                              <span style={{ color: 'var(--text-muted)', marginRight: '6px', fontSize: '0.9rem' }}>⣿</span>
                              <span style={{ textTransform: 'capitalize', fontSize: '0.85rem', fontWeight: 500 }}>{secName}</span>
                              <div style={{ display: 'flex', marginLeft: '6px', opacity: 0.7 }}>
                                <button title="Move Left" style={{ padding: '0px 4px', fontSize: '0.9rem', background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border-color)' : 'var(--text-main)' }} disabled={idx === 0} onClick={() => {
                                  const newArr = [...stagedTemplateConfig.section_order];
                                  [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
                                  setStagedTemplateConfig({ ...stagedTemplateConfig, section_order: newArr });
                                }}>‹</button>
                                <button title="Move Right" style={{ padding: '0px 4px', fontSize: '0.9rem', background: 'transparent', border: 'none', cursor: idx === stagedTemplateConfig.section_order.length - 1 ? 'default' : 'pointer', color: idx === stagedTemplateConfig.section_order.length - 1 ? 'var(--border-color)' : 'var(--text-main)' }} disabled={idx === stagedTemplateConfig.section_order.length - 1} onClick={() => {
                                  const newArr = [...stagedTemplateConfig.section_order];
                                  [newArr[idx + 1], newArr[idx]] = [newArr[idx], newArr[idx + 1]];
                                  setStagedTemplateConfig({ ...stagedTemplateConfig, section_order: newArr });
                                }}>›</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

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
                      <div><label style={labelStyle}>Professional Summary</label><RichTextEditor value={stagedProfile?.summary || ''} onChange={(val) => setStagedProfile({ ...stagedProfile, summary: val })} placeholder="Brief professional summary..." minHeight="70px" /></div>
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
                          <div><label style={labelStyle}>Institution</label><input className="form-input" style={inputStyle} placeholder="University Name" value={edu.institution || ''} onChange={e => { const u = [...stagedEducations]; u[idx].institution = e.target.value; setStagedEducations(u); }} /></div>
                          <div><label style={labelStyle}>Degree</label><input className="form-input" style={inputStyle} placeholder="B.Tech in CS" value={edu.degree || ''} onChange={e => { const u = [...stagedEducations]; u[idx].degree = e.target.value; setStagedEducations(u); }} /></div>
                        </div>
                        <div><label style={labelStyle}>Dates</label><input className="form-input" style={inputStyle} placeholder="Aug 2019 – Jun 2023" value={edu.dates || ''} onChange={e => { const u = [...stagedEducations]; u[idx].dates = e.target.value; setStagedEducations(u); }} /></div>
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
                        <div><label style={labelStyle}>Job Title</label><input className="form-input" style={inputStyle} value={exp.job_title || ''} onChange={e => updateStagedExp(idx, 'job_title', e.target.value)} placeholder="e.g. Software Engineer" /></div>
                        <div><label style={labelStyle}>Company</label><input className="form-input" style={inputStyle} value={exp.company_name || ''} onChange={e => updateStagedExp(idx, 'company_name', e.target.value)} placeholder="e.g. Google" /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div><label style={labelStyle}>Start Date</label><input className="form-input" style={inputStyle} value={exp.start_date || ''} onChange={e => updateStagedExp(idx, 'start_date', e.target.value)} placeholder="e.g. 2022-01" /></div>
                        <div><label style={labelStyle}>End Date</label><input className="form-input" style={inputStyle} value={exp.end_date || ''} onChange={e => updateStagedExp(idx, 'end_date', e.target.value)} placeholder="Leave blank if current" /></div>
                      </div>
                      <label style={labelStyle}>Bullet Points</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {(exp.stagedBullets || []).map((b: string, bIdx: number) => (
                          <div 
                            key={`b-${bIdx}`} 
                            draggable={bulletDragEnabledId === `exp-${idx}-${bIdx}`}
                            onDragStart={(e) => handleBulletDragStart(e, 'exp', idx, bIdx)}
                            onDragOver={(e) => handleBulletDragOver(e, 'exp', idx, bIdx)}
                            onDrop={(e) => handleBulletDrop(e, 'exp', idx, bIdx)}
                            onDragEnd={handleBulletDragEnd}
                            style={{ 
                              display: 'flex', gap: '8px', alignItems: 'flex-start',
                              opacity: bulletDraggedItem?.type === 'exp' && bulletDraggedItem.parentIdx === idx && bulletDraggedItem.bulletIdx === bIdx ? 0.5 : 1,
                              borderTop: bulletDragOverItem?.type === 'exp' && bulletDragOverItem.parentIdx === idx && bulletDragOverItem.bulletIdx === bIdx && bulletDraggedItem && bulletDraggedItem.bulletIdx > bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                              borderBottom: bulletDragOverItem?.type === 'exp' && bulletDragOverItem.parentIdx === idx && bulletDragOverItem.bulletIdx === bIdx && bulletDraggedItem && bulletDraggedItem.bulletIdx < bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                              padding: '2px 0',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div 
                              onMouseEnter={() => setBulletDragEnabledId(`exp-${idx}-${bIdx}`)}
                              onMouseLeave={() => setBulletDragEnabledId(null)}
                              style={{ marginTop: '10px', color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} 
                              title="Drag to reorder"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                              <RichTextEditor value={b} onChange={(val) => updateStagedExpBullet(idx, bIdx, val)} minHeight="46px" />
                            </div>
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
                        <div><label style={labelStyle}>Project Title</label><input className="form-input" style={inputStyle} value={proj.title || ''} onChange={e => updateStagedProj(idx, 'title', e.target.value)} placeholder="e.g. Book Store App" /></div>
                        <div><label style={labelStyle}>Tech Stack</label><input className="form-input" style={inputStyle} value={proj.tech_stack || ''} onChange={e => updateStagedProj(idx, 'tech_stack', e.target.value)} placeholder="React, Node.js, MongoDB" /></div>
                      </div>
                      <label style={labelStyle}>Bullet Points</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {(proj.stagedBullets || []).map((b: string, bIdx: number) => (
                          <div 
                            key={`proj-b-${bIdx}`} 
                            draggable={bulletDragEnabledId === `proj-${idx}-${bIdx}`}
                            onDragStart={(e) => handleBulletDragStart(e, 'proj', idx, bIdx)}
                            onDragOver={(e) => handleBulletDragOver(e, 'proj', idx, bIdx)}
                            onDrop={(e) => handleBulletDrop(e, 'proj', idx, bIdx)}
                            onDragEnd={handleBulletDragEnd}
                            style={{ 
                              display: 'flex', gap: '8px', alignItems: 'flex-start',
                              opacity: bulletDraggedItem?.type === 'proj' && bulletDraggedItem.parentIdx === idx && bulletDraggedItem.bulletIdx === bIdx ? 0.5 : 1,
                              borderTop: bulletDragOverItem?.type === 'proj' && bulletDragOverItem.parentIdx === idx && bulletDragOverItem.bulletIdx === bIdx && bulletDraggedItem && bulletDraggedItem.bulletIdx > bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                              borderBottom: bulletDragOverItem?.type === 'proj' && bulletDragOverItem.parentIdx === idx && bulletDragOverItem.bulletIdx === bIdx && bulletDraggedItem && bulletDraggedItem.bulletIdx < bIdx ? '2px solid var(--accent)' : '2px solid transparent',
                              padding: '2px 0',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div 
                              onMouseEnter={() => setBulletDragEnabledId(`proj-${idx}-${bIdx}`)}
                              onMouseLeave={() => setBulletDragEnabledId(null)}
                              style={{ marginTop: '10px', color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} 
                              title="Drag to reorder"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                              <RichTextEditor value={b} onChange={(val) => updateStagedProjBullet(idx, bIdx, val)} minHeight="46px" />
                            </div>
                            <button style={{ ...removeBtn, marginTop: '8px', flexShrink: 0 }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.splice(bIdx, 1); setStagedProjs(u); }}>✕</button>
                          </div>
                        ))}
                        <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.78rem', padding: '5px 12px', marginTop: '4px' }} onClick={() => { const u = [...stagedProjs]; u[idx].stagedBullets.push(''); setStagedProjs(u); }}>+ Add Bullet</button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="alert alert-warning" style={{ marginBottom: '15px' }}>
                    <strong>Warning:</strong> Changes made here will not be synced back to the visual editor or your Vault.
                  </div>
                  <LaTeXEditor value={rawLatex} onChange={(val) => { setRawLatex(val || ''); setIsDirty(true); }} />
                </div>
              )}

            </div>

            {/* ─── Right: PDF Preview (45%) ─── */}
            <div className="review-preview-panel">
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
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--success)', animation: 'spin 1s linear infinite' }}></div>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>Compiling LaTeX...</span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888', gap: '10px', padding: '20px', textAlign: 'center' }}>
                    <span style={{ fontSize: '2rem' }}>📄</span>
                    <p style={{ fontSize: '0.9rem' }}>No preview yet</p>
                    {genError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '15px', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem', maxWidth: '80%' }}>
                        <strong style={{ display: 'block', marginBottom: '5px' }}>Compilation Error:</strong>
                        {genError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {isPreviewingResume && extractedResumeData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Review Extracted Data</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saving this data will overwrite your existing Vault.</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setIsPreviewingResume(false)} disabled={resumeUploadStatus === "loading"}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveExtractedData} disabled={resumeUploadStatus === "loading"}>
                {resumeUploadStatus === "loading" ? "Saving..." : "Overwrite Vault"}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }} className="custom-scrollbar">
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {resumeUploadStatus === "error" && resumeUploadError && (
                <div className="alert alert-error" style={{ marginBottom: '20px' }}>{resumeUploadError}</div>
              )}
              
              {extractedResumeData && (
                <div style={{ background: 'var(--glass-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📄</span> Parsed Resume Content
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Please review the data extracted from your PDF below before overwriting your Vault.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '600px', overflowY: 'auto', paddingRight: '10px' }} className="custom-scrollbar">
                    {extractedResumeData.profile && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '1rem' }}>Profile</h4>
                        <p style={{ margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>{extractedResumeData.profile.first_name} {extractedResumeData.profile.last_name}</p>
                        <p style={{ margin: '4px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {[extractedResumeData.profile.email, extractedResumeData.profile.phone, extractedResumeData.profile.location].filter(Boolean).join(' • ')}
                        </p>
                        {extractedResumeData.profile.summary && <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{extractedResumeData.profile.summary}</p>}
                      </div>
                    )}
                    
                    {extractedResumeData.experiences?.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '1rem' }}>Experience</h4>
                        {extractedResumeData.experiences.map((exp: any, i: number) => (
                          <div key={i} style={{ marginBottom: i < extractedResumeData.experiences.length - 1 ? '16px' : 0, paddingBottom: i < extractedResumeData.experiences.length - 1 ? '16px' : 0, borderBottom: i < extractedResumeData.experiences.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{exp.job_title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>at</span> {exp.company_name}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '10px' }}>{formatDateRange(exp.start_date, exp.end_date)}</span>
                            </div>
                            {exp.location && <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {exp.location}</p>}
                            {exp.raw_description && (
                              <div 
                                style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
                                className="html-description"
                                dangerouslySetInnerHTML={{ __html: exp.raw_description }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {extractedResumeData.projects?.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '1rem' }}>Projects</h4>
                        {extractedResumeData.projects.map((proj: any, i: number) => (
                          <div key={i} style={{ marginBottom: i < extractedResumeData.projects.length - 1 ? '16px' : 0, paddingBottom: i < extractedResumeData.projects.length - 1 ? '16px' : 0, borderBottom: i < extractedResumeData.projects.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{proj.title}</strong>
                            </div>
                            {proj.tech_stack?.length > 0 && <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--accent)' }}>{proj.tech_stack.join(", ")}</p>}
                            {proj.raw_description && (
                              <div 
                                style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
                                className="html-description"
                                dangerouslySetInnerHTML={{ __html: proj.raw_description }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {extractedResumeData.skills?.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '1rem' }}>Skills</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Object.entries(
                            extractedResumeData.skills.reduce((acc: any, skill: any) => {
                              if (typeof skill === 'string') {
                                if (!acc['Other']) acc['Other'] = [];
                                acc['Other'].push(skill);
                                return acc;
                              }
                              const cat = skill.category || 'Other';
                              if (!acc[cat]) acc[cat] = [];
                              acc[cat].push(skill.skill_name);
                              return acc;
                            }, {})
                          ).map(([category, skills]: [string, any], i: number) => (
                            <div key={i}>
                              <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{category}</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {skills.map((s: string, j: number) => (
                                  <span key={j} style={{ background: 'rgba(108,93,211,0.15)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--text-main)' }}>{s}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {extractedResumeData.educations?.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent)', fontSize: '1rem' }}>Education</h4>
                        {extractedResumeData.educations.map((edu: any, i: number) => (
                          <div key={i} style={{ marginBottom: i < extractedResumeData.educations.length - 1 ? '16px' : 0, paddingBottom: i < extractedResumeData.educations.length - 1 ? '16px' : 0, borderBottom: i < extractedResumeData.educations.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '10px' }}>{formatDateRange(edu.start_date, edu.end_date)}</span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{edu.institution} {edu.location ? `• ${edu.location}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
