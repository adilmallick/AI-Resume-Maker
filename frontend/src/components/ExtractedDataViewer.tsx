import React from 'react';

export default function ExtractedDataViewer({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Profile Section */}
      {data.profile && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Name</span>
              <p style={{ fontWeight: 500, fontSize: '1.05rem', margin: 0 }}>{data.profile.first_name || ''} {data.profile.last_name || ''}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email</span>
              <p style={{ fontSize: '0.95rem', margin: 0 }}>{data.profile.email || 'N/A'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone</span>
              <p style={{ fontSize: '0.95rem', margin: 0 }}>{data.profile.phone || 'N/A'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Location</span>
              <p style={{ fontSize: '0.95rem', margin: 0 }}>{data.profile.location || 'N/A'}</p>
            </div>
          </div>
          {data.profile.summary && (
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Summary</span>
              <div style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: 0, color: 'var(--text-main)' }} dangerouslySetInnerHTML={{ __html: data.profile.summary }} />
            </div>
          )}
        </div>
      )}

      {/* Experiences Section */}
      {data.experiences && data.experiences.length > 0 && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Experiences ({data.experiences.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.experiences.map((exp: any, idx: number) => (
              <div key={idx} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{exp.job_title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{exp.company_name}</span>
                      {exp.location && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>• {exp.location}</span>}
                    </div>
                  </div>
                  <span className="badge">{exp.start_date || 'N/A'} - {exp.end_date || (exp.is_current ? 'Present' : 'N/A')}</span>
                </div>
                {exp.raw_description && (
                  <div 
                    style={{ marginTop: '12px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-muted)', paddingLeft: '16px' }} 
                    dangerouslySetInnerHTML={{ __html: exp.raw_description }} 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education Section */}
      {data.educations && data.educations.length > 0 && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Education ({data.educations.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.educations.map((edu: any, idx: number) => (
              <div key={idx} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', margin: '0 0 4px 0' }}>{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}</h4>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{edu.institution}</span>
                </div>
                <span className="badge">{edu.start_date || 'N/A'} - {edu.end_date || 'Present'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects Section */}
      {data.projects && data.projects.length > 0 && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Projects ({data.projects.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {data.projects.map((proj: any, idx: number) => (
              <div key={idx} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', margin: '0 0 4px 0' }}>{proj.title}</h4>
                    {proj.role && <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{proj.role}</span>}
                  </div>
                  <span className="badge">{proj.start_date || 'N/A'} - {proj.end_date || 'Present'}</span>
                </div>
                {proj.tech_stack && proj.tech_stack.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {proj.tech_stack.map((tech: string, i: number) => (
                      <span key={i} className="badge" style={{ fontSize: '0.75rem', background: 'var(--border-color)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>{tech}</span>
                    ))}
                  </div>
                )}
                {proj.raw_description && (
                  <div 
                    style={{ marginTop: '12px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-muted)', paddingLeft: '16px' }} 
                    dangerouslySetInnerHTML={{ __html: proj.raw_description }} 
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Section */}
      {data.skills && data.skills.length > 0 && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--accent-light)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Skills</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {Object.entries(
              data.skills.reduce((acc: any, skill: any) => {
                const cat = skill.category || "Other";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(skill.skill_name);
                return acc;
              }, {})
            ).map(([cat, skillsArr]: [string, any], idx: number) => (
              <div key={idx} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '8px' }}>{cat}</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {skillsArr.map((skillName: string, i: number) => (
                    <span key={i} className="badge" style={{ fontSize: '0.85rem', background: 'var(--glass-hover)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>{skillName}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
}
