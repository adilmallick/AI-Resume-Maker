import { useState } from 'react';
import Modal from '@/components/Modal';

interface SocialsSectionProps {
  socials: any[];
  onSave: (data: any, editingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY_FORM = { platform_name: '', url: '', display_text: '' };

export default function SocialsSection({ socials, onSave, onDelete }: SocialsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setIsOpen(true); };
  const openEdit = (soc: any) => { setEditingId(soc.id); setForm({ platform_name: soc.platform_name || '', url: soc.url || '', display_text: soc.display_text || '' }); setIsOpen(true); };
  const close = () => { setIsOpen(false); setEditingId(null); setForm(EMPTY_FORM); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try { await onSave(form, editingId); close(); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ marginTop: '10px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Socials</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openAdd}>+ Add Social</button>
      </div>

      <Modal isOpen={isOpen} onClose={close} title={editingId ? 'Edit Social' : 'Add Social'}>
        <form onSubmit={handleSubmit} style={{ marginBottom: '15px' }}>
          <input className="form-input" style={{ width: '100%', marginBottom: '8px' }} placeholder="Platform (e.g. GitHub)" value={form.platform_name} onChange={e => setForm({ ...form, platform_name: e.target.value })} required />
          <input className="form-input" style={{ width: '100%', marginBottom: '8px' }} placeholder="URL *" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
          <input className="form-input" style={{ width: '100%', marginBottom: '8px' }} placeholder="Display Text (Optional)" value={form.display_text} onChange={e => setForm({ ...form, display_text: e.target.value })} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '10px' }} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-secondary" type="button" onClick={close} style={{ flex: 1, padding: '10px' }} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {socials.length === 0 && <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No socials listed.</div>}
        {socials.map(soc => (
          <div key={soc.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>{soc.platform_name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => openEdit(soc)}>Edit</button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => onDelete(soc.id)}>Delete</button>
              </div>
            </div>
            <a href={soc.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: 'var(--accent-light)', textDecoration: 'underline', wordBreak: 'break-all' }}>
              {soc.display_text || soc.url}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
