import Modal from '@/components/Modal';
import RichTextEditor from '@/components/RichTextEditor';
import { useState } from 'react';

interface ProfileSectionProps {
  profile: any;
  onSave: (data: any) => Promise<any>;
}

export default function ProfileSection({ profile, onSave }: ProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    summary: profile.summary || '',
  });

  // Keep form in sync when profile updates from parent
  const openEdit = () => {
    setForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      summary: profile.summary || '',
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try { await onSave(form); setIsEditing(false); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ marginTop: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Profile Core</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={openEdit}>
          Edit Profile
        </button>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Profile">
        <form onSubmit={handleSubmit}>
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="First Name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Last Name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
          <input className="form-input" type="email" style={{ width: '100%', marginBottom: '10px' }} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <input className="form-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <div style={{ marginBottom: '10px' }}>
            <RichTextEditor value={form.summary} onChange={val => setForm({ ...form, summary: val })} placeholder="Summary" />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: '10px' }} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setIsEditing(false)} style={{ padding: '10px' }} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Name</span>
          <p style={{ fontWeight: 500, fontSize: '1.05rem' }}>{profile.first_name || 'N/A'} {profile.last_name || ''}</p>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email</span>
          <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', fontSize: '0.95rem' }}>{profile.email || 'Not Set'}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '10px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Location</span>
            <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', fontSize: '0.9rem' }}>{profile.location || 'Not Set'}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone</span>
            <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', fontSize: '0.9rem' }}>{profile.phone || 'Not Set'}</p>
          </div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bio / Summary</span>
          <div className="prose prose-sm prose-invert max-w-none text-[var(--text-muted)]" dangerouslySetInnerHTML={{ __html: profile.summary || 'No summary provided.' }} />
        </div>
      </div>
    </div>
  );
}
