"use client";

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useVault(token: string | null, userId?: string) {
  const VAULT_CACHE_KEY = `vault_cache_${userId ?? 'anon'}`;

  const [profile, setProfile] = useState<any>({});
  const [experiences, setExperiences] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [educations, setEducations] = useState<any[]>([]);
  const [socials, setSocials] = useState<any[]>([]);

  const saveVaultCache = (data: { profile: any; experiences: any[]; projects: any[]; skills: any[]; educations: any[]; socials: any[] }) => {
    try { sessionStorage.setItem(VAULT_CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() })); } catch { /* quota exceeded */ }
  };

  const loadVaultCache = () => {
    try { const raw = sessionStorage.getItem(VAULT_CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };

  const bustVaultCache = () => sessionStorage.removeItem(VAULT_CACHE_KEY);

  const fetchVault = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = loadVaultCache();
      if (cached) {
        setProfile(cached.profile ?? {});
        setExperiences(cached.experiences ?? []);
        setProjects(cached.projects ?? []);
        setSkills(cached.skills ?? []);
        setEducations(cached.educations ?? []);
        setSocials(cached.socials ?? []);
        return;
      }
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let p = {};
      const profRes = await fetch(`${API_URL}/api/vault/profile`, { headers });
      if (profRes.ok) { p = await profRes.json(); setProfile(p); }
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
      saveVaultCache({ profile: p, experiences: exps, projects: projs, skills: skls, educations: edus, socials: socs });
    } catch (e) { console.error(e); }
  };

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ── Profile ──────────────────────────────────────────────────────────────────
  const updateProfile = async (data: any) => {
    const res = await fetch(`${API_URL}/api/vault/profile`, { method: 'PUT', headers, body: JSON.stringify(data) });
    if (res.ok) {
      const updated = await res.json();
      setProfile(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, profile: updated });
      return updated;
    }
  };

  // ── Experiences ──────────────────────────────────────────────────────────────
  const saveExperience = async (data: any, editingId: string | null) => {
    const url = editingId ? `${API_URL}/api/vault/experiences/${editingId}` : `${API_URL}/api/vault/experiences`;
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify({ ...data, start_date: data.start_date || new Date().toISOString().split('T')[0], end_date: data.end_date || null }) });
    if (res.ok) {
      const saved = await res.json();
      const updated = editingId ? experiences.map(e => e.id === editingId ? saved : e) : [...experiences, saved];
      setExperiences(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, experiences: updated });
    }
  };

  const deleteExperience = async (id: string) => {
    const res = await fetch(`${API_URL}/api/vault/experiences/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const updated = experiences.filter(e => e.id !== id);
      setExperiences(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, experiences: updated });
    }
  };

  // ── Projects ─────────────────────────────────────────────────────────────────
  const saveProject = async (data: any, editingId: string | null) => {
    const url = editingId ? `${API_URL}/api/vault/projects/${editingId}` : `${API_URL}/api/vault/projects`;
    const techStackArr = typeof data.tech_stack === 'string' ? data.tech_stack.split(',').map((s: string) => s.trim()).filter((s: string) => s) : data.tech_stack;
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify({ ...data, start_date: data.start_date || null, end_date: data.end_date || null, tech_stack: techStackArr }) });
    if (res.ok) {
      const saved = await res.json();
      const updated = editingId ? projects.map(p => p.id === editingId ? saved : p) : [...projects, saved];
      setProjects(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, projects: updated });
    }
  };

  const deleteProject = async (id: string) => {
    const res = await fetch(`${API_URL}/api/vault/projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, projects: updated });
    }
  };

  // ── Education ─────────────────────────────────────────────────────────────────
  const saveEducation = async (data: any, editingId: string | null) => {
    const url = editingId ? `${API_URL}/api/vault/educations/${editingId}` : `${API_URL}/api/vault/educations`;
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify({ ...data, end_date: data.end_date || null }) });
    if (res.ok) {
      const saved = await res.json();
      const updated = editingId ? educations.map(e => e.id === editingId ? saved : e) : [...educations, saved];
      setEducations(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, educations: updated });
    }
  };

  const deleteEducation = async (id: string) => {
    const res = await fetch(`${API_URL}/api/vault/educations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const updated = educations.filter(e => e.id !== id);
      setEducations(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, educations: updated });
    }
  };

  // ── Skills ────────────────────────────────────────────────────────────────────
  const saveSkill = async (data: any, editingId: string | null) => {
    if (editingId) {
      const res = await fetch(`${API_URL}/api/vault/skills/${editingId}`, { method: 'PUT', headers, body: JSON.stringify({ skill_name: data.skill_name, category: data.category }) });
      if (res.ok) {
        const saved = await res.json();
        const updated = skills.map(s => s.id === editingId ? saved : s);
        setSkills(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, skills: updated });
      }
    } else {
      const skillsToAdd = data.skill_name.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      const newSkills: any[] = [];
      for (const s of skillsToAdd) {
        const res = await fetch(`${API_URL}/api/vault/skills`, { method: 'POST', headers, body: JSON.stringify({ skill_name: s, category: data.category }) });
        if (res.ok) newSkills.push(await res.json());
      }
      if (newSkills.length > 0) {
        const updated = [...skills, ...newSkills];
        setSkills(updated);
        const cached = loadVaultCache() || {};
        saveVaultCache({ ...cached, skills: updated });
      }
    }
  };

  const deleteSkill = async (id: string) => {
    const res = await fetch(`${API_URL}/api/vault/skills/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const updated = skills.filter(s => s.id !== id);
      setSkills(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, skills: updated });
    }
  };

  // ── Socials ───────────────────────────────────────────────────────────────────
  const saveSocial = async (data: any, editingId: string | null) => {
    const url = editingId ? `${API_URL}/api/vault/socials/${editingId}` : `${API_URL}/api/vault/socials`;
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify(data) });
    if (res.ok) {
      const saved = await res.json();
      const updated = editingId ? socials.map(s => s.id === editingId ? saved : s) : [...socials, saved];
      setSocials(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, socials: updated });
    }
  };

  const deleteSocial = async (id: string) => {
    const res = await fetch(`${API_URL}/api/vault/socials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const updated = socials.filter(s => s.id !== id);
      setSocials(updated);
      const cached = loadVaultCache() || {};
      saveVaultCache({ ...cached, socials: updated });
    }
  };

  return {
    profile, experiences, projects, skills, educations, socials,
    setProfile, setExperiences, setProjects, setSkills, setEducations, setSocials,
    fetchVault, bustVaultCache, loadVaultCache, saveVaultCache,
    updateProfile,
    saveExperience, deleteExperience,
    saveProject, deleteProject,
    saveEducation, deleteEducation,
    saveSkill, deleteSkill,
    saveSocial, deleteSocial,
  };
}
