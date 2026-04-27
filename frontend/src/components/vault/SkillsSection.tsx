import { useState } from 'react';
import Modal from '@/components/Modal';

interface SkillsSectionProps {
  skills: any[];
  onSave: (data: any, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY = { skill_name: '', category: '' };

export default function SkillsSection({ skills, onSave, onDelete }: SkillsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setIsOpen(true); };
  const close = () => { setIsOpen(false); setEditingId(null); setForm(EMPTY); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try { await onSave(form, editingId); close(); } finally { setIsSaving(false); }
  };

  const grouped: Record<string, any[]> = skills.reduce((acc, skill) => {
    const cat = skill.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Technical Skills</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openAdd}>+ Map Categories</button>
      </div>

      <Modal isOpen={isOpen} onClose={close} title={editingId ? 'Edit Skill' : 'Batch Add Technical Skills'}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" style={{ width: '200px' }} placeholder="Category (e.g. Languages) *" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required />
            <input className="form-input" style={{ flex: 1 }} placeholder="Comma Separated Skills *" value={form.skill_name} onChange={e => setForm({ ...form, skill_name: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Skills'}</button>
            <button className="btn btn-secondary" type="button" onClick={close} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        {skills.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No skills tracked.</div>}
        {Object.entries(grouped).map(([cat, sks]) => (
          <div key={`v-skill-${cat}`} className="glass-card" style={{ padding: '15px' }}>
            <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '5px' }}>{cat}</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sks.map(skill => (
                <span key={skill.id} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {skill.skill_name}
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} onClick={() => onDelete(skill.id)}>×</button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
