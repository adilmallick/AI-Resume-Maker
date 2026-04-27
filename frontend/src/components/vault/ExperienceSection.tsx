import { useState } from 'react';
import Modal from '@/components/Modal';
import RichTextEditor from '@/components/RichTextEditor';

interface ExperienceSectionProps {
  experiences: any[];
  onSave: (data: any, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY = { company_name: '', job_title: '', location: '', start_date: '', end_date: '', raw_description: '' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' };

export default function ExperienceSection({ experiences, onSave, onDelete }: ExperienceSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setIsOpen(true); };
  const openEdit = (exp: any) => {
    setEditingId(exp.id);
    setForm({ company_name: exp.company_name || '', job_title: exp.job_title || '', location: exp.location || '', start_date: exp.start_date || '', end_date: exp.end_date || '', raw_description: exp.raw_description || '' });
    setIsOpen(true);
  };
  const close = () => { setIsOpen(false); setEditingId(null); setForm(EMPTY); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try { await onSave(form, editingId); close(); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ marginTop: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Experiences</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openAdd}>+ Add Exp</button>
      </div>

      <Modal isOpen={isOpen} onClose={close} title={editingId ? 'Edit Experience' : 'Add New Experience'}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" placeholder="Company Name *" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} required />
            <input className="form-input" placeholder="Job Title *" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Raw Bullet Points or Description</label>
            <RichTextEditor value={form.raw_description} onChange={val => setForm({ ...form, raw_description: val })} placeholder="Raw Bullet Points or Description" />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Experience'}</button>
            <button className="btn btn-secondary" type="button" onClick={close} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div className="dashboard-list" style={{ width: '100%' }}>
        {experiences.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No experiences logged.</div>}
        {experiences.map(exp => (
          <div key={exp.id} className="glass-card" style={{ padding: '24px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                {exp.job_title} <span style={{ color: 'var(--accent-light)', fontWeight: 400 }}>@ {exp.company_name}</span>
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge">{exp.start_date} - {exp.end_date || 'Present'}</span>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => openEdit(exp)}>Edit</button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => onDelete(exp.id)}>Delete</button>
              </div>
            </div>
            {exp.raw_description && (
              <div className="prose prose-sm prose-invert max-w-none mt-2 text-sm text-[var(--text-muted)]" dangerouslySetInnerHTML={{ __html: exp.raw_description }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
