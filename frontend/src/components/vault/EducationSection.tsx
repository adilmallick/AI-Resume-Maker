import { useState } from 'react';
import Modal from '@/components/Modal';
import { formatDateRange } from '@/lib/dateUtils';

interface EducationSectionProps {
  educations: any[];
  onSave: (data: any, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY = { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' };

export default function EducationSection({ educations, onSave, onDelete }: EducationSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setIsOpen(true); };
  const openEdit = (edu: any) => {
    setEditingId(edu.id);
    setForm({ institution: edu.institution || '', degree: edu.degree || '', field_of_study: edu.field_of_study || '', start_date: edu.start_date || '', end_date: edu.end_date || '' });
    setIsOpen(true);
  };
  const close = () => { setIsOpen(false); setEditingId(null); setForm(EMPTY); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try { await onSave(form, editingId); close(); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Education</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openAdd}>+ Add Education</button>
      </div>

      <Modal isOpen={isOpen} onClose={close} title={editingId ? 'Edit Education' : 'Add Education'}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" placeholder="Institution *" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} required />
            <input className="form-input" placeholder="Degree *" value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} required />
          </div>
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Field of Study *" value={form.field_of_study} onChange={e => setForm({ ...form, field_of_study: e.target.value })} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <input className="form-input" type="date" placeholder="Start Date *" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            <input className="form-input" type="date" placeholder="End Date (Optional)" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Education'}</button>
            <button className="btn btn-secondary" type="button" onClick={close} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {educations.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No education logged.</div>}
        {educations.map(edu => (
          <div key={edu.id} className="glass-card" style={{ padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', margin: '0 0 5px 0' }}>{edu.degree} in {edu.field_of_study}</h4>
                <p style={{ color: 'var(--accent-light)', margin: 0, fontSize: '0.9rem' }}>{edu.institution}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge">{formatDateRange(edu.start_date, edu.end_date)}</span>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => openEdit(edu)}>Edit</button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => onDelete(edu.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
