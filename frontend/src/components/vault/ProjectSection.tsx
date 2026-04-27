import { useState } from 'react';
import Modal from '@/components/Modal';
import RichTextEditor from '@/components/RichTextEditor';

interface ProjectSectionProps {
  projects: any[];
  onSave: (data: any, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY = { title: '', role: '', tech_stack: '', repository_url: '', live_demo_url: '', start_date: '', end_date: '', raw_description: '' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' };

export default function ProjectSection({ projects, onSave, onDelete }: ProjectSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setIsOpen(true); };
  const openEdit = (proj: any) => {
    setEditingId(proj.id);
    setForm({ title: proj.title || '', role: proj.role || '', tech_stack: (proj.tech_stack || []).join(', '), repository_url: proj.repository_url || '', live_demo_url: proj.live_demo_url || '', start_date: proj.start_date || '', end_date: proj.end_date || '', raw_description: proj.raw_description || '' });
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
        <h2 style={{ fontSize: '1.5rem' }}>Projects</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openAdd}>+ Add Project</button>
      </div>

      <Modal isOpen={isOpen} onClose={close} title={editingId ? 'Edit Project' : 'Add New Project'}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" placeholder="Project Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            <input className="form-input" placeholder="Your Role (Optional)" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input className="form-input" placeholder="Repository URL" value={form.repository_url} onChange={e => setForm({ ...form, repository_url: e.target.value })} />
            <input className="form-input" placeholder="Live Demo URL" value={form.live_demo_url} onChange={e => setForm({ ...form, live_demo_url: e.target.value })} />
          </div>
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Tech Stack (comma separated)" value={form.tech_stack} onChange={e => setForm({ ...form, tech_stack: e.target.value })} />
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Project Description or Bullets</label>
            <RichTextEditor value={form.raw_description} onChange={val => setForm({ ...form, raw_description: val })} placeholder="Project Description or Bullets" />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Project'}</button>
            <button className="btn btn-secondary" type="button" onClick={close} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {projects.length === 0 && <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No projects logged.</div>}
        {projects.map(proj => (
          <div key={proj.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{proj.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{proj.role}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => openEdit(proj)}>Edit</button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => onDelete(proj.id)}>Delete</button>
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
  );
}
