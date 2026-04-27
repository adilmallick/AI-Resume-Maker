const TABS = ['profile', 'experience', 'projects', 'education', 'skills'];

interface VaultTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function VaultTabs({ activeTab, onTabChange }: VaultTabsProps) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
      {TABS.map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          style={{
            padding: '12px 24px',
            background: activeTab === tab ? 'var(--accent-glow)' : 'transparent',
            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid',
            borderColor: activeTab === tab ? 'var(--accent)' : 'transparent',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'capitalize',
            transition: 'all 0.2s ease',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
